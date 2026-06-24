import { PgBoss } from "pg-boss";
import type { ConstructorOptions } from "pg-boss";
import { env } from "../config/env.js";

let boss: PgBoss | null = null;

type BossLogger = {
  error: (bindings: Record<string, unknown>, message: string) => void;
  warn: (bindings: Record<string, unknown>, message: string) => void;
  info: (bindings: Record<string, unknown>, message: string) => void;
};

export type BossConnectionInfo = {
  host: string | null;
  port: string | null;
  type: "direct" | "pooler" | "local" | "unknown";
  sslEnabled: boolean;
  schema: string;
};

function getBossConnectionInfo(): BossConnectionInfo {
  const connectionString = env.PG_BOSS_DATABASE_URL ?? env.DATABASE_URL;

  try {
    const url = new URL(connectionString);
    const host = url.hostname || null;
    const port = url.port || null;
    const type = host?.endsWith(".pooler.supabase.com")
      ? "pooler"
      : host?.startsWith("db.") && host.endsWith(".supabase.co")
        ? "direct"
        : host === "localhost" || host === "127.0.0.1"
          ? "local"
          : "unknown";

    return {
      host,
      port,
      type,
      sslEnabled: env.DATABASE_SSL,
      schema: env.PG_BOSS_SCHEMA,
    };
  } catch {
    return {
      host: null,
      port: null,
      type: "unknown",
      sslEnabled: env.DATABASE_SSL,
      schema: env.PG_BOSS_SCHEMA,
    };
  }
}

export function buildBossConfig(): ConstructorOptions {
  return {
    connectionString: env.PG_BOSS_DATABASE_URL ?? env.DATABASE_URL,
    schema: env.PG_BOSS_SCHEMA,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    application_name: "contentcategorize-backend",
  };
}

function normalizeBossError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    return error as Record<string, unknown>;
  }

  return { error };
}

function attachBossErrorListeners(instance: PgBoss, logger?: BossLogger): void {
  instance.on("error", (error) => {
    const payload = {
      err: normalizeBossError(error),
      connection: getBossConnectionInfo(),
    };

    if (logger) {
      logger.error(payload, "pg-boss error");
      return;
    }

    console.error(JSON.stringify({ level: "error", message: "pg-boss error", ...payload }));
  });

  instance.on("warning", (warning) => {
    const payload = {
      warning,
      connection: getBossConnectionInfo(),
    };

    if (logger) {
      logger.warn(payload, "pg-boss warning");
      return;
    }

    console.warn(JSON.stringify({ level: "warn", message: "pg-boss warning", ...payload }));
  });
}

export function createBoss(logger?: BossLogger): PgBoss {
  const instance = new PgBoss(buildBossConfig());
  attachBossErrorListeners(instance, logger);
  return instance;
}

export function getBoss(): PgBoss {
  if (!boss) {
    boss = createBoss();
  }

  return boss;
}

export async function startBoss(logger?: BossLogger): Promise<PgBoss> {
  if (!boss) {
    boss = createBoss(logger);
  }

  const instance = boss;
  await instance.start();
  logger?.info({ connection: getBossConnectionInfo() }, "pg-boss started");
  return instance;
}

export async function stopBoss(): Promise<void> {
  if (!boss) {
    return;
  }

  const instance = boss;
  boss = null;
  await instance.stop();
}
