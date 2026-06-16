import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { withRlsUser } from "../lib/db.js";
import { requireAuth } from "../lib/request.js";
const CheckoutSchema = z.object({
    product_id: z.string().min(1).optional(),
    entitlement_id: z.string().min(1).optional(),
});
const RevenueCatWebhookSchema = z.object({
    type: z.enum(["INITIAL_PURCHASE", "RENEWAL", "CANCELLATION", "EXPIRATION"]),
    app_user_id: z.string().min(1),
    product_id: z.string().min(1).optional(),
    expiration_at_ms: z.number().int().positive().optional(),
});
export const billingRoutes = async (app) => {
    app.get("/billing/plan", { preHandler: app.authenticate }, async (request) => {
        const auth = requireAuth(request);
        return withRlsUser(auth.user, async (client) => {
            const profileResult = await client.query(`
          select
            id,
            plan,
            monthly_save_count,
            monthly_ai_count,
            monthly_save_limit,
            monthly_ai_limit
          from public.profiles
          where id = $1
        `, [auth.user.id]);
            const subscriptionResult = await client.query(`
          select
            id,
            provider,
            entitlement_id,
            product_id,
            subscription_status,
            plan,
            original_app_user_id,
            current_period_start,
            current_period_end
          from public.subscriptions
          where user_id = $1
        `, [auth.user.id]);
            return {
                profile: profileResult.rows[0] ?? null,
                subscription: subscriptionResult.rows[0] ?? null,
            };
        });
    });
    app.post("/billing/checkout", { preHandler: app.authenticate }, async (request) => {
        const auth = requireAuth(request);
        const body = CheckoutSchema.parse(request.body ?? {});
        return withRlsUser(auth.user, async (client) => {
            const existing = await client.query(`select id from public.subscriptions where user_id = $1`, [auth.user.id]);
            if (existing.rows[0]) {
                const updated = await client.query(`
            update public.subscriptions
            set
              product_id = coalesce($2, product_id),
              entitlement_id = coalesce($3, entitlement_id),
              original_app_user_id = coalesce($4, original_app_user_id),
              updated_at = now()
            where user_id = $1
            returning
              id,
              provider,
              entitlement_id,
              product_id,
              subscription_status,
              plan,
              original_app_user_id,
              current_period_start,
              current_period_end
          `, [auth.user.id, body.product_id ?? null, body.entitlement_id ?? null, auth.user.id]);
                return {
                    checkout_ready: true,
                    subscription: updated.rows[0] ?? null,
                };
            }
            const created = await client.query(`
          insert into public.subscriptions (
            user_id,
            provider,
            entitlement_id,
            product_id,
            subscription_status,
            plan,
            original_app_user_id
          )
          values ($1, 'revenuecat', $2, $3, 'inactive', 'free', $4)
          returning
            id,
            provider,
            entitlement_id,
            product_id,
            subscription_status,
            plan,
            original_app_user_id,
            current_period_start,
            current_period_end
        `, [auth.user.id, body.entitlement_id ?? null, body.product_id ?? null, auth.user.id]);
            return {
                checkout_ready: true,
                subscription: created.rows[0] ?? null,
            };
        });
    });
    app.post("/billing/webhook", async (request) => {
        const body = RevenueCatWebhookSchema.parse(request.body ?? {});
        const subscriptionResult = await withRlsUser({ id: body.app_user_id }, async (client) => {
            const existing = await client.query(`
          select id, user_id, plan
          from public.subscriptions
          where user_id = $1 or original_app_user_id = $1
          limit 1
        `, [body.app_user_id]);
            const subscription = existing.rows[0];
            if (!subscription) {
                throw new AppError(404, "subscription_not_found", "Subscription not found for RevenueCat user");
            }
            const expiration = body.expiration_at_ms ? new Date(body.expiration_at_ms) : null;
            switch (body.type) {
                case "INITIAL_PURCHASE":
                case "RENEWAL": {
                    await client.query(`
              update public.subscriptions
              set
                plan = 'pro',
                subscription_status = 'active',
                product_id = coalesce($2, product_id),
                current_period_end = coalesce($3, current_period_end),
                original_app_user_id = coalesce($4, original_app_user_id),
                updated_at = now()
              where id = $1
            `, [subscription.id, body.product_id ?? null, expiration, body.app_user_id]);
                    await client.query(`update public.profiles set plan = 'pro', updated_at = now() where id = $1`, [subscription.user_id]);
                    break;
                }
                case "CANCELLATION": {
                    await client.query(`
              update public.subscriptions
              set
                subscription_status = 'cancelled',
                updated_at = now()
              where id = $1
            `, [subscription.id]);
                    break;
                }
                case "EXPIRATION": {
                    await client.query(`
              update public.subscriptions
              set
                plan = 'free',
                subscription_status = 'expired',
                current_period_end = coalesce($2, current_period_end),
                updated_at = now()
              where id = $1
            `, [subscription.id, expiration]);
                    await client.query(`update public.profiles set plan = 'free', updated_at = now() where id = $1`, [subscription.user_id]);
                    break;
                }
            }
            return {
                ok: true,
            };
        });
        return subscriptionResult;
    });
};
