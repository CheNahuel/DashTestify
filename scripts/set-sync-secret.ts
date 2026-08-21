#!/usr/bin/env node
/**
 * Set the INTERNAL_SYNC_SECRET in Supabase database
 *
 * Usage:
 *   npx ts-node scripts/set-sync-secret.ts
 *
 * Requires environment variables:
 *   SUPABASE_URL              (your Supabase URL)
 *   SUPABASE_SERVICE_ROLE_KEY (your service role key)
 *   INTERNAL_SYNC_SECRET      (your generated secret)
 */

import { execSync } from "child_process";

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const syncSecret = process.env.INTERNAL_SYNC_SECRET;

  // Validate env vars
  if (!supabaseUrl || !serviceRoleKey || !syncSecret) {
    console.error("❌ Missing required environment variables:\n");
    if (!supabaseUrl) console.error("   SUPABASE_URL");
    if (!serviceRoleKey) console.error("   SUPABASE_SERVICE_ROLE_KEY");
    if (!syncSecret) console.error("   INTERNAL_SYNC_SECRET");
    console.error("\nExample:");
    console.error('  export SUPABASE_URL="https://kayzrduiqcxvwwjftttk.supabase.co"');
    console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
    console.error('  export INTERNAL_SYNC_SECRET="your-generated-secret"');
    console.error("  npx ts-node scripts/set-sync-secret.ts");
    process.exit(1);
  }

  console.log("🔧 Setting sync secret in Supabase...\n");
  console.log(`📍 URL: ${supabaseUrl}`);
  console.log(`🔑 Secret: ${syncSecret.substring(0, 8)}...`);

  try {
    // Extract connection info from URL
    const url = new URL(supabaseUrl);
    const projectId = url.hostname.split(".")[0];

    // Build PostgreSQL connection string
    // Format: postgresql://user:password@host:port/database
    const connString = `postgresql://postgres:${serviceRoleKey}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

    console.log("\n⏳ Connecting to database...");

    // Execute SQL command using psql
    const sql = `ALTER DATABASE postgres SET "app.internal_sync_secret" = '${syncSecret.replace(/'/g, "''")}'`;

    // Option 1: Try using psql if available
    try {
      console.log("  Attempting with psql...");
      execSync(`psql "${connString}" -c "${sql.replace(/"/g, '\\"')}"`, {
        stdio: "pipe",
      });
      console.log("✅ Secret configured successfully!");
      console.log(`\n📝 The INTERNAL_SYNC_SECRET is now set in your database.`);
      console.log(`   Next: Run pg_cron setup and initialize coins.`);
      process.exit(0);
    } catch (psqlError) {
      console.log("  psql not available, trying alternative method...");

      // Option 2: If psql doesn't work, provide instructions for manual setup
      console.log("\n⚠️  psql not found. Use one of these alternatives:\n");

      console.log("Option A: Install psql and run:");
      console.log(`  psql "${connString}"`);
      console.log(`  Then in psql prompt, paste:`);
      console.log(`    ALTER DATABASE postgres SET "app.internal_sync_secret" = '${syncSecret}';`);
      console.log(`    \\q  (to exit psql)\n`);

      console.log("Option B: Use Supabase CLI:");
      console.log(`  supabase db execute --db-url "${connString}" -- "${sql}"\n`);

      console.log("Option C: Use SQL Editor in Supabase Dashboard:");
      console.log(`  1. Go to SQL Editor`);
      console.log(`  2. Create new query`);
      console.log(`  3. Paste this command:`);
      console.log(`     ALTER DATABASE postgres SET "app.internal_sync_secret" = '${syncSecret}';`);
      console.log(`  4. Execute\n`);

      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
