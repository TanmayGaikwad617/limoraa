import assert from "node:assert/strict";
import test from "node:test";
import fastify, { type FastifyInstance } from "fastify";

process.env.DATABASE_URL ??= "postgres://localhost/test";
process.env.SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service-role-key";

const { authRoutes, createAuthRoutes } = await import("../src/routes/auth.js");
const { isAppError } = await import("../src/lib/errors.js");

type SupabaseSessionUser = {
  id: string;
  email: string | null;
};

function buildTestApp(plugin = authRoutes): FastifyInstance {
  const app = fastify();

  app.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      reply.code(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          requestId: request.id,
          details: error.details ?? null,
        },
      });
      return;
    }

    const genericError = error instanceof Error ? error : new Error("An unexpected error occurred");
    const statusCodeCandidate = error as { statusCode?: number };
    const statusCode =
      typeof statusCodeCandidate.statusCode === "number" && statusCodeCandidate.statusCode >= 400
        ? statusCodeCandidate.statusCode
        : 500;

    reply.code(statusCode).send({
      error: {
        code: statusCode >= 500 ? "internal_server_error" : "request_error",
        message: statusCode >= 500 ? "An unexpected error occurred" : genericError.message,
        requestId: request.id,
      },
    });
  });

  app.register(plugin);
  return app;
}

test("POST /auth/session validates a Supabase JWT and returns the current user", async () => {
  const verifiedTokens: string[] = [];
  const user: SupabaseSessionUser = {
    id: "user_123",
    email: "person@example.com",
  };

  const app = buildTestApp(
    createAuthRoutes({
      verifySupabaseJwt: async (accessToken) => {
        verifiedTokens.push(accessToken);
        return user as never;
      },
      createSupabaseServiceClient: () => {
        throw new Error("logout client should not be used in session test");
      },
    }),
  );

  const response = await app.inject({
    method: "POST",
    url: "/auth/session",
    headers: {
      authorization: "Bearer supabase-access-token",
    },
    payload: {},
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    user,
  });
  assert.deepEqual(verifiedTokens, ["supabase-access-token"]);

  await app.close();
});

test("POST /auth/session rejects invalid request bodies", async () => {
  const app = buildTestApp(
    createAuthRoutes({
      verifySupabaseJwt: async () => {
        throw new Error("verifySupabaseJwt should not be called for invalid request bodies");
      },
      createSupabaseServiceClient: () => {
        throw new Error("logout client should not be used in session test");
      },
    }),
  );

  const response = await app.inject({
    method: "POST",
    url: "/auth/session",
    headers: {
      authorization: "Bearer supabase-access-token",
    },
    payload: {
      unexpected: true,
    },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json() as {
    error: {
      code: string;
      message: string;
      details: { fieldErrors?: Record<string, string[]>; formErrors?: string[] } | null;
    };
  };
  assert.equal(body.error.code, "invalid_request");
  assert.equal(body.error.message, "This route does not accept a request body");
  assert.ok(body.error.details);

  await app.close();
});

test("POST /auth/session rejects missing authorization headers", async () => {
  const app = buildTestApp(
    createAuthRoutes({
      verifySupabaseJwt: async () => {
        throw new Error("verifySupabaseJwt should not be called when auth is missing");
      },
      createSupabaseServiceClient: () => {
        throw new Error("logout client should not be used in session test");
      },
    }),
  );

  const response = await app.inject({
    method: "POST",
    url: "/auth/session",
    payload: {},
  });

  assert.equal(response.statusCode, 401);
  assert.equal((response.json() as { error: { code: string } }).error.code, "missing_authorization");

  await app.close();
});

test("POST /auth/logout validates JWTs and revokes the current session", async () => {
  const verifiedTokens: string[] = [];
  const signOutCalls: Array<{ token: string; scope: string }> = [];

  const app = buildTestApp(
    createAuthRoutes({
      verifySupabaseJwt: async (accessToken) => {
        verifiedTokens.push(accessToken);
        return {
          id: "user_123",
          email: "person@example.com",
        } as never;
      },
      createSupabaseServiceClient: () =>
        ({
          auth: {
            admin: {
              signOut: async (token: string, scope: string) => {
                signOutCalls.push({ token, scope });
                return { error: null };
              },
            },
          },
        }) as never,
    }),
  );

  const response = await app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: {
      authorization: "Bearer supabase-access-token",
    },
    payload: {},
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
  });
  assert.deepEqual(verifiedTokens, ["supabase-access-token"]);
  assert.deepEqual(signOutCalls, [
    {
      token: "supabase-access-token",
      scope: "local",
    },
  ]);

  await app.close();
});

test("POST /auth/logout surfaces Supabase sign-out failures", async () => {
  const app = buildTestApp(
    createAuthRoutes({
      verifySupabaseJwt: async () => ({
        id: "user_123",
        email: "person@example.com",
      } as never),
      createSupabaseServiceClient: () =>
        ({
          auth: {
            admin: {
              signOut: async () => ({
                error: {
                  status: 500,
                  code: "server_error",
                  message: "sign-out failed",
                },
              }),
            },
          },
        }) as never,
    }),
  );

  const response = await app.inject({
    method: "POST",
    url: "/auth/logout",
    headers: {
      authorization: "Bearer supabase-access-token",
    },
    payload: {},
  });

  assert.equal(response.statusCode, 400);
  assert.equal((response.json() as { error: { code: string; message: string } }).error.code, "logout_failed");
  assert.equal((response.json() as { error: { code: string; message: string } }).error.message, "sign-out failed");

  await app.close();
});
