import { PgBoss } from "pg-boss";
import { env } from "../config/env.js";

export function createBoss(): PgBoss {
  return new PgBoss({
    connectionString: env.DATABASE_URL,
    schema: env.PG_BOSS_SCHEMA,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    application_name: "contentcategorize-backend",
  });
}
