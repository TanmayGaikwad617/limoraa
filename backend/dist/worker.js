import "dotenv/config";
import { env } from "./config/env.js";
import { startBoss, stopBoss } from "./lib/pgboss.js";
import { closeDb } from "./lib/db.js";
import { ensureWorkerQueues } from "./worker/queues.js";
import { registerFetchMetadataHandler } from "./worker/handlers/fetchMetadata.js";
import { registerAnalyzeVideoHandler } from "./worker/handlers/analyzeVideo.js";
import { registerIndexVideoHandler } from "./worker/handlers/indexVideo.js";
import { registerRefreshSmartCollectionsHandler } from "./worker/handlers/refreshSmartCollections.js";
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
    const boss = await startBoss();
    await ensureWorkerQueues(boss);
    await registerFetchMetadataHandler(boss);
    await registerAnalyzeVideoHandler(boss);
    await registerIndexVideoHandler(boss);
    await registerRefreshSmartCollectionsHandler(boss);
    console.log(JSON.stringify({
        level: "info",
        message: "pg-boss worker started",
        schema: env.PG_BOSS_SCHEMA,
        environment: env.NODE_ENV,
    }));
}
void main().catch((error) => {
    console.error(JSON.stringify({ level: "error", message: "worker failed to start", error }));
    process.exit(1);
});
