import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./http";
import { getEnv } from "./env";

export function getServiceSupabase() {
  const url = getEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new HttpError(
      "Supabase server credentials are missing. Configure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      500,
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
