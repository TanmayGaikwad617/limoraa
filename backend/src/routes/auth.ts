import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";
import {
  createSupabaseAnonClient,
  createSupabaseServiceClient,
  verifySupabaseJwt,
} from "../lib/supabase.js";

const EmptyBodySchema = z.object({}).strict();

const AuthHeaderSchema = z
  .string()
  .trim()
  .regex(/^Bearer\s+\S+$/i, "Authorization must use a Bearer token");

interface AuthRoutesDeps {
  verifySupabaseJwt: typeof verifySupabaseJwt;
  createSupabaseServiceClient: typeof createSupabaseServiceClient;
}

const defaultDeps: AuthRoutesDeps = {
  verifySupabaseJwt,
  createSupabaseServiceClient,
};

function parseEmptyBody(body: unknown): void {
  const parsed = EmptyBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new AppError(
      400,
      "invalid_request",
      "This route does not accept a request body",
      parsed.error.flatten(),
    );
  }
}

function parseBearerToken(authorization: unknown): string {
  if (typeof authorization !== "string") {
    throw new AppError(401, "missing_authorization", "Missing Bearer token");
  }

  const parsed = AuthHeaderSchema.safeParse(authorization);
  if (!parsed.success) {
    throw new AppError(401, "invalid_authorization", "Authorization must use a Bearer token");
  }

  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new AppError(401, "invalid_authorization", "Authorization must use a Bearer token");
  }

  return token;
}

async function revokeCurrentSession(
  accessToken: string,
  deps: AuthRoutesDeps,
): Promise<void> {
  const client = deps.createSupabaseServiceClient();
  const { error } = await client.auth.admin.signOut(accessToken, "local");

  if (error && error.status !== 404) {
    throw new AppError(400, "logout_failed", error.message, {
      status: error.status ?? null,
      code: error.code ?? null,
    });
  }
}

export function createAuthRoutes(
  deps: Partial<AuthRoutesDeps> = {},
): FastifyPluginAsync {
  const resolvedDeps: AuthRoutesDeps = {
    ...defaultDeps,
    ...deps,
  };

  return async (app) => {
    app.post("/auth/session", async (request) => {
      parseEmptyBody(request.body);

      const accessToken = parseBearerToken(request.headers.authorization);
      const user = await resolvedDeps.verifySupabaseJwt(accessToken);

      return {
        ok: true,
        user,
      };
    });

    app.post("/auth/logout", async (request) => {
      parseEmptyBody(request.body);

      const accessToken = parseBearerToken(request.headers.authorization);
      await resolvedDeps.verifySupabaseJwt(accessToken);
      await revokeCurrentSession(accessToken, resolvedDeps);

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
}

export const authRoutes = createAuthRoutes();

const PasswordResetSchema = z.object({
  email: z.string().email(),
  redirect_to: z.string().url().optional(),
});
