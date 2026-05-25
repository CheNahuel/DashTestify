import { createClient } from "@supabase/supabase-js";

let cachedSupabase: ReturnType<typeof createClient> | null = null;

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "http://127.0.0.1:3000";
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_KEY ||
    "test-key";

  return { supabaseUrl, supabaseKey };
}

export function getSupabaseClient() {
  if (!cachedSupabase) {
    const { supabaseUrl, supabaseKey } = getSupabaseConfig();
    cachedSupabase = createClient(supabaseUrl, supabaseKey);
  }

  return cachedSupabase;
}
