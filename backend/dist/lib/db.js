import { Pool } from "pg";
import { env } from "../config/env.js";
let pool = null;
function buildPoolConfig() {
    return {
        connectionString: env.DATABASE_URL,
        application_name: "contentcategorize-backend",
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
        keepAlive: true,
        keepAliveInitialDelayMillis: 10_000,
        ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    };
}
export function getPool() {
    if (!pool) {
        pool = new Pool(buildPoolConfig());
        pool.on("connect", (client) => {
            void client.query("SET statement_timeout = '15000'").catch((error) => {
                console.warn(JSON.stringify({
                    level: "warn",
                    message: "failed to set postgres statement_timeout",
                    error: error instanceof Error ? error.message : String(error),
                }));
            });
        });
    }
    return pool;
}
export async function query(text, values) {
    const result = await getPool().query(text, values);
    return result.rows;
}
export async function withDbClient(fn) {
    let client;
    try {
        client = await getPool().connect();
    }
    catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
        client = await getPool().connect();
    }
    try {
        return await fn(client);
    }
    finally {
        client.release();
    }
}
export async function withTransaction(fn) {
    return withDbClient(async (client) => {
        await client.query("begin");
        try {
            const result = await fn(client);
            await client.query("commit");
            return result;
        }
        catch (error) {
            await client.query("rollback");
            throw error;
        }
    });
}
export async function withRlsUser(_user, fn) {
    return withTransaction(fn);
}
export async function closeDb() {
    if (!pool) {
        return;
    }
    const currentPool = pool;
    pool = null;
    await currentPool.end();
}
