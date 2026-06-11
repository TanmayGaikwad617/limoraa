import type { FastifyRequest } from "fastify";
import { AppError } from "./errors.js";
import type { AuthContext } from "../middleware/auth.js";

export function requireAuth(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new AppError(401, "unauthorized", "Authentication required");
  }

  return request.auth;
}
