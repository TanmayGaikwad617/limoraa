import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

function createBaseClient(apiKey: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseAnonClient(): SupabaseClient {
  return createBaseClient(env.SUPABASE_ANON_KEY);
}

export function createSupabaseServiceClient(): SupabaseClient {
  return createBaseClient(env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function verifySupabaseJwt(accessToken: string): Promise<User> {
  const client = createSupabaseAnonClient();
  const { data, error } = await client.auth.getUser(accessToken);

  if (error || !data.user) {
    throw new AppError(401, "invalid_supabase_jwt", "Invalid or expired Supabase session");
  }

  return data.user;
}
