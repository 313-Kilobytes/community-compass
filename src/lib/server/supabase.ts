import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";
import { getServerEnv } from "./env";

export const createServerSupabaseClient = () => {
  const supabaseUrl = getServerEnv("VITE_SUPABASE_URL", "SUPABASE_URL");
  const serviceRoleKey = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
