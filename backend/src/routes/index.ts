import type { FastifyPluginAsync } from "fastify";
import { healthRoutes } from "./health.js";

export const routes: FastifyPluginAsync = async (app) => {
  await app.register(healthRoutes);
};
