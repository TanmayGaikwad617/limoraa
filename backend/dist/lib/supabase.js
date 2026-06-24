import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";
const JWT_CACHE_TTL_MS = 60_000;
const jwtCache = new Map();
function createBaseClient(apiKey) {
    return createClient(env.SUPABASE_URL, apiKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
        },
    });
}
export function createSupabaseAnonClient() {
    return createBaseClient(env.SUPABASE_ANON_KEY);
}
export function createSupabaseServiceClient() {
    return createBaseClient(env.SUPABASE_SERVICE_ROLE_KEY);
}
function pruneJwtCache(now) {
    for (const [token, entry] of jwtCache.entries()) {
        if (entry.expiresAt <= now) {
            jwtCache.delete(token);
        }
    }
}
export async function verifySupabaseJwt(accessToken) {
    const now = Date.now();
    const cached = jwtCache.get(accessToken);
    if (cached && cached.expiresAt > now) {
        return cached.user;
    }
    const client = createSupabaseAnonClient();
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) {
        throw new AppError(401, "invalid_supabase_jwt", "Invalid or expired Supabase session");
    }
    pruneJwtCache(now);
    jwtCache.set(accessToken, {
        user: data.user,
        expiresAt: now + JWT_CACHE_TTL_MS,
    });
    return data.user;
}
