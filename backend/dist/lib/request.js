import { AppError } from "./errors.js";
export function requireAuth(request) {
    if (!request.auth) {
        throw new AppError(401, "unauthorized", "Authentication required");
    }
    return request.auth;
}
