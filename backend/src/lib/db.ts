import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";
import { env } from "../config/env.js";

let pool: Pool | null = null;

function buildPoolConfig(): PoolConfig {
  return {
    connectionString: env.DATABASE_URL,
    application_name: "contentcategorize-backend",
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(buildPoolConfig());
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values);
  return result.rows;
}

export async function withDbClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withDbClient(async (client) => {
    await client.query("begin");
    try {
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  });
}

async function setRequestClaims(
  client: PoolClient,
  claims: Record<string, string>,
): Promise<void> {
  for (const [key, value] of Object.entries(claims)) {
    await client.query("select set_config($1, $2, true)", [key, value]);
  }
}

export async function withRlsUser<T>(
  user: { id: string; email?: string | null },
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withTransaction(async (client) => {
    await setRequestClaims(client, {
      "request.jwt.claim.sub": user.id,
      "request.jwt.claim.role": "authenticated",
      "request.jwt.claim.email": user.email ?? "",
    });

    return fn(client);
  });
}

export async function closeDb(): Promise<void> {
  if (!pool) {
    return;
  }

  const currentPool = pool;
  pool = null;
  await currentPool.end();
}
