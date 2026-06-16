import "dotenv/config";
import { env } from "./config/env.js";
import { buildApp } from "./app.js";
import { closeDb } from "./lib/db.js";
import { startBoss, stopBoss } from "./lib/pgboss.js";
const app = buildApp();
async function shutdown(signal) {
    app.log.info({ signal }, "shutting down backend");
    await stopBoss();
    await app.close();
    await closeDb();
}
async function main() {
    const signals = ["SIGINT", "SIGTERM"];
    for (const signal of signals) {
        process.on(signal, () => {
            void shutdown(signal).finally(() => process.exit(0));
        });
    }
    try {
        await startBoss();
        await app.listen({
            port: env.PORT,
            host: env.HOST,
        });
        app.log.info({
            host: env.HOST,
            port: env.PORT,
            environment: env.NODE_ENV,
        }, "backend listening");
    }
    catch (error) {
        app.log.error({ err: error }, "failed to start backend");
        process.exit(1);
    }
}
void main();
