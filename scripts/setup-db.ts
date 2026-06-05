import "dotenv/config";

import { createClient } from "@supabase/supabase-js";

async function setupDatabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_KEY environment variables are required");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Setting up DashTestify database schema...");

  // Create test_runs table
  const createTableSQL = `
    create table if not exists public.test_runs (
      id uuid not null default gen_random_uuid (),
      created_at timestamp with time zone not null default now(),
      commit_sha text null,
      branch text null,
      total_tests bigint null,
      passed bigint null,
      failed bigint null,
      duration_ms bigint null,
      constraint test_runs_pkey primary key (id)
    ) TABLESPACE pg_default;

    -- Create indices for common queries
    create index if not exists test_runs_branch_created_at_idx on public.test_runs(branch, created_at desc);
    create index if not exists test_runs_created_at_idx on public.test_runs(created_at desc);
    create index if not exists test_runs_commit_sha_idx on public.test_runs(commit_sha);
  `;

  try {
    let result;
    try {
      result = await supabase.rpc("exec_sql", { sql: createTableSQL });
    } catch {
      throw new Error("RPC method not available. Use Supabase SQL Editor instead.");
    }

    if (result?.error) {
      throw result.error;
    }

    console.log("✓ Database schema created successfully");
    console.log("✓ test_runs table created");
    console.log("✓ Indices created for performance");
  } catch (error) {
    console.error("Error setting up database:");
    console.error(
      error instanceof Error ? error.message : "Unknown error. Please run the SQL migration manually."
    );
    console.log("\nTo set up the database manually:");
    console.log("1. Go to Supabase Dashboard > SQL Editor");
    console.log("2. Create a new query");
    console.log("3. Copy the contents from scripts/migrations/001_create_test_runs.sql");
    console.log("4. Execute the query");
    process.exit(1);
  }
}

setupDatabase();
