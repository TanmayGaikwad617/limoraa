import type { AuthContext } from "../middleware/auth.js";
import type { preHandlerHookHandler } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext | null;
  }

  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
  }
}

export {};
