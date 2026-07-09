import { createClient } from "@supabase/supabase-js";

let cachedSupabase: ReturnType<typeof createClient> | null = null;
let cachedSupabaseService: ReturnType<typeof createClient> | null = null;

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:3000";
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    "test-key";

  return { supabaseUrl, supabaseKey };
}

function getSupabaseServiceConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:3000";
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "test-service-key";

  return { supabaseUrl, serviceRoleKey };
}

export function getSupabaseClient() {
  if (!cachedSupabase) {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
    cachedSupabase = createClient(supabaseUrl, supabaseKey);
  }

  return cachedSupabase;
}

export function getSupabaseServiceClient() {
  if (!cachedSupabaseService) {
    const { supabaseUrl, serviceRoleKey } = getSupabaseServiceConfig();
    cachedSupabaseService = createClient(supabaseUrl, serviceRoleKey);
  }

  return cachedSupabaseService;
}
