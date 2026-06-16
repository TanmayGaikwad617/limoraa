import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import fastify from "fastify";
import { env } from "./config/env.js";
import { authPlugin } from "./middleware/auth.js";
import { isAppError } from "./lib/errors.js";
import { routes } from "./routes/index.js";
function parseCorsOrigins(value) {
    if (value.trim() === "*") {
        return true;
    }
    return value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
}
export function buildApp() {
    const app = fastify({
        logger: {
            level: env.LOG_LEVEL,
        },
        trustProxy: true,
        disableRequestLogging: false,
    });
    app.register(cors, {
        origin: parseCorsOrigins(env.CORS_ORIGIN),
        credentials: true,
    });
    app.register(sensible);
    app.register(authPlugin);
    app.setErrorHandler((error, request, reply) => {
        request.log.error({ err: error }, "request failed");
        if (isAppError(error)) {
            reply.code(error.statusCode).send({
                error: {
                    code: error.code,
                    message: error.message,
                    requestId: request.id,
                    details: error.details ?? null,
                },
            });
            return;
        }
        const genericError = error instanceof Error ? error : new Error("An unexpected error occurred");
        const statusCodeCandidate = error;
        const statusCode = typeof statusCodeCandidate.statusCode === "number" &&
            statusCodeCandidate.statusCode >= 400
            ? statusCodeCandidate.statusCode
            : 500;
        reply.code(statusCode).send({
            error: {
                code: statusCode >= 500 ? "internal_server_error" : "request_error",
                message: statusCode >= 500 ? "An unexpected error occurred" : genericError.message,
                requestId: request.id,
            },
        });
    });
    app.setNotFoundHandler((request, reply) => {
        reply.code(404).send({
            error: {
                code: "not_found",
                message: "Route not found",
                requestId: request.id,
            },
        });
    });
    app.register(routes);
    return app;
}
