import "dotenv/config";
import { env } from "./config/env.js";
import { startBoss, stopBoss } from "./lib/pgboss.js";
import { closeDb } from "./lib/db.js";
async function shutdown(signal) {
    console.log(JSON.stringify({ level: "info", signal, message: "shutting down worker" }));
    await stopBoss();
    await closeDb();
}
async function main() {
    const signals = ["SIGINT", "SIGTERM"];
    for (const signal of signals) {
        process.on(signal, () => {
            void shutdown(signal).finally(() => process.exit(0));
        });
    }
    await startBoss();
    console.log(JSON.stringify({
        level: "info",
        message: "pg-boss worker started",
        schema: env.PG_BOSS_SCHEMA,
        environment: env.NODE_ENV,
    }));
    // Job handlers will be registered here as the save/enrichment flows land.
    // The queue foundation is in place now so the API can enqueue work without
    // waiting for the rest of the feature set.
}
void main().catch((error) => {
    console.error(JSON.stringify({ level: "error", message: "worker failed to start", error }));
    process.exit(1);
});
