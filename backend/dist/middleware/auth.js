import { AppError } from "../lib/errors.js";
import { verifySupabaseJwt } from "../lib/supabase.js";
export async function authenticate(request) {
    const authorization = request.headers.authorization;
    const bearerPrefix = "Bearer ";
    if (!authorization?.startsWith(bearerPrefix)) {
        throw new AppError(401, "missing_authorization", "Missing Bearer token");
    }
    const accessToken = authorization.slice(bearerPrefix.length).trim();
    if (!accessToken) {
        throw new AppError(401, "missing_authorization", "Missing Bearer token");
    }
    const user = await verifySupabaseJwt(accessToken);
    request.auth = { user, accessToken };
}
export const authPlugin = async (app) => {
    app.decorateRequest("auth", null);
    app.decorate("authenticate", authenticate);
};
