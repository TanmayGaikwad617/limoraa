import { z } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import { createSupabaseAnonClient } from "../lib/supabase.js";
const SessionSchema = z.object({
    email: z.string().email().optional(),
    password: z.string().min(1).optional(),
    refresh_token: z.string().min(1).optional(),
});
const PasswordResetSchema = z.object({
    email: z.string().email(),
    redirect_to: z.string().url().optional(),
});
export const authRoutes = async (app) => {
    app.post("/auth/session", async (request) => {
        const body = SessionSchema.parse(request.body ?? {});
        const client = createSupabaseAnonClient();
        if (body.refresh_token) {
            const { data, error } = await client.auth.refreshSession({
                refresh_token: body.refresh_token,
            });
            if (error || !data.session) {
                throw new AppError(401, "invalid_session", error?.message ?? "Failed to refresh session");
            }
            return {
                session: data.session,
                user: data.session.user,
            };
        }
        if (!body.email || !body.password) {
            throw new AppError(400, "invalid_request", "Provide email/password or refresh_token");
        }
        const { data, error } = await client.auth.signInWithPassword({
            email: body.email,
            password: body.password,
        });
        if (error || !data.session || !data.user) {
            throw new AppError(401, "invalid_credentials", error?.message ?? "Invalid credentials");
        }
        return {
            session: data.session,
            user: data.user,
        };
    });
    app.post("/auth/logout", async (request) => {
        const body = SessionSchema.pick({
            refresh_token: true,
        }).parse(request.body ?? {});
        if (!body.refresh_token) {
            throw new AppError(400, "invalid_request", "refresh_token is required to log out");
        }
        const client = createSupabaseAnonClient();
        const { data: refreshData, error: refreshError } = await client.auth.refreshSession({
            refresh_token: body.refresh_token,
        });
        if (refreshError || !refreshData.session) {
            throw new AppError(401, "invalid_session", refreshError?.message ?? "Invalid session");
        }
        await client.auth.setSession({
            access_token: refreshData.session.access_token,
            refresh_token: body.refresh_token,
        });
        const { error } = await client.auth.signOut({ scope: "global" });
        if (error) {
            throw new AppError(400, "logout_failed", error.message);
        }
        return {
            ok: true,
        };
    });
    app.post("/auth/password-reset", async (request) => {
        const body = PasswordResetSchema.parse(request.body ?? {});
        const client = createSupabaseAnonClient();
        const redirectTo = body.redirect_to ?? env.SUPABASE_URL;
        const { error } = await client.auth.resetPasswordForEmail(body.email, {
            redirectTo,
        });
        if (error) {
            throw new AppError(400, "password_reset_failed", error.message);
        }
        return {
            ok: true,
            sent: true,
            email: body.email,
        };
    });
};
