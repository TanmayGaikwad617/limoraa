import "dotenv/config";
import { env } from "./config/env.js";
import { createBoss } from "./lib/pgboss.js";
import { closeDb } from "./lib/db.js";

const boss = createBoss();

async function shutdown(signal: string): Promise<void> {
  console.log(JSON.stringify({ level: "info", signal, message: "shutting down worker" }));
  await boss.stop();
  await closeDb();
}

async function main(): Promise<void> {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, () => {
      void shutdown(signal).finally(() => process.exit(0));
    });
  }

  await boss.start();
  console.log(
    JSON.stringify({
      level: "info",
      message: "pg-boss worker started",
      schema: env.PG_BOSS_SCHEMA,
      environment: env.NODE_ENV,
    }),
  );

  // Job handlers will be registered here as the save/enrichment flows land.
  // The queue foundation is in place now so the API can enqueue work without
  // waiting for the rest of the feature set.
}

void main().catch((error) => {
  console.error(JSON.stringify({ level: "error", message: "worker failed to start", error }));
  process.exit(1);
});
