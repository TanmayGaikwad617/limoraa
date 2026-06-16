import { PgBoss } from "pg-boss";
import { env } from "../config/env.js";
let boss = null;
export function createBoss() {
    return new PgBoss({
        connectionString: env.DATABASE_URL,
        schema: env.PG_BOSS_SCHEMA,
        ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
        application_name: "contentcategorize-backend",
    });
}
export function getBoss() {
    if (!boss) {
        boss = createBoss();
    }
    return boss;
}
export async function startBoss() {
    const instance = getBoss();
    await instance.start();
    return instance;
}
export async function stopBoss() {
    if (!boss) {
        return;
    }
    const instance = boss;
    boss = null;
    await instance.stop();
}
