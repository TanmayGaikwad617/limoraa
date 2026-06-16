import { query } from "../lib/db.js";
export const healthRoutes = async (app) => {
    app.get("/health", async (request, reply) => {
        try {
            await query("select 1 as ok");
            return {
                status: "ok",
                service: "contentcategorize-backend",
                database: "up",
                uptimeSeconds: Math.round(process.uptime()),
                requestId: request.id,
                timestamp: new Date().toISOString(),
            };
        }
        catch (error) {
            request.log.error({ err: error }, "health check failed");
            reply.code(503);
            return {
                status: "degraded",
                service: "contentcategorize-backend",
                database: "down",
                uptimeSeconds: Math.round(process.uptime()),
                requestId: request.id,
                timestamp: new Date().toISOString(),
            };
        }
    });
};
