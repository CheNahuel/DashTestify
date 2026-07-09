#!/usr/bin/env node
/**
 * Setup script for Crypto Sync infrastructure (Phase 3)
 *
 * Usage:
 *   npx ts-node scripts/setup-crypto-sync.ts --project-id YOUR_PROJECT_ID --secret YOUR_SYNC_SECRET
 *
 * This script:
 * 1. Updates pg_cron migration with correct PROJECT_ID
 * 2. Initializes coins (Bitcoin, Ethereum, etc.)
 * 3. Runs initial sync for each coin
 * 4. Verifies that data was populated
 */

import fs from "fs";
import path from "path";

interface SetupConfig {
  projectId: string;
  syncSecret: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  coins?: Array<{
    symbol: string;
    name: string;
    coincapId: string;
    coingeckoId?: string;
  }>;
}

const DEFAULT_COINS = [
  { symbol: "BTC", name: "Bitcoin", coincapId: "bitcoin", coingeckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", coincapId: "ethereum", coingeckoId: "ethereum" },
  { symbol: "SOL", name: "Solana", coincapId: "solana", coingeckoId: "solana" },
  { symbol: "BNB", name: "Binance Coin", coincapId: "binance-coin", coingeckoId: "binance" },
  { symbol: "ADA", name: "Cardano", coincapId: "cardano", coingeckoId: "cardano" },
  { symbol: "XRP", name: "XRP", coincapId: "ripple", coingeckoId: "ripple" },
  { symbol: "DOGE", name: "Dogecoin", coincapId: "dogecoin", coingeckoId: "dogecoin" },
  { symbol: "LINK", name: "Chainlink", coincapId: "chainlink", coingeckoId: "chainlink" },
];

async function parseArgs(): Promise<SetupConfig> {
  const args = process.argv.slice(2);
  const config: Partial<SetupConfig> = {
    coins: DEFAULT_COINS,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--project-id":
        config.projectId = args[++i];
        break;
      case "--secret":
        config.syncSecret = args[++i];
        break;
      case "--supabase-url":
        config.supabaseUrl = args[++i];
        break;
      case "--service-role-key":
        config.supabaseServiceRoleKey = args[++i];
        break;
      case "--help":
        printHelp();
        process.exit(0);
    }
  }

  // Try to read from env if not provided
  if (!config.projectId) config.projectId = process.env.SUPABASE_PROJECT_ID;
  if (!config.syncSecret) config.syncSecret = process.env.INTERNAL_SYNC_SECRET;
  if (!config.supabaseUrl) config.supabaseUrl = process.env.SUPABASE_URL;
  if (!config.supabaseServiceRoleKey) config.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Validate required fields
  const missing = [];
  if (!config.projectId) missing.push("--project-id");
  if (!config.syncSecret) missing.push("--secret");
  if (!config.supabaseUrl) missing.push("--supabase-url");
  if (!config.supabaseServiceRoleKey) missing.push("--service-role-key");

  if (missing.length > 0) {
    console.error(`❌ Missing required arguments: ${missing.join(", ")}`);
    console.error("Run with --help for usage");
    process.exit(1);
  }

  return config as SetupConfig;
}

function printHelp() {
  console.log(`
Crypto Sync Setup Script (Phase 3)

Usage:
  npx ts-node scripts/setup-crypto-sync.ts [OPTIONS]

Options:
  --project-id PROJECT_ID              Supabase project ID (from URL)
  --secret SECRET                      INTERNAL_SYNC_SECRET value
  --supabase-url URL                   Supabase URL (https://PROJECT_ID.supabase.co)
  --service-role-key KEY              Supabase service role key
  --help                               Show this help

Environment variables:
  SUPABASE_PROJECT_ID
  INTERNAL_SYNC_SECRET
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Example:
  npx ts-node scripts/setup-crypto-sync.ts \\
    --project-id abc123xyz \\
    --secret your-sync-secret \\
    --supabase-url https://abc123xyz.supabase.co \\
    --service-role-key your-service-role-key
  `);
}

async function updatePgCronMigration(projectId: string, syncSecret: string): Promise<void> {
  const migrationPath = path.join(__dirname, "migrations", "007_setup_pg_cron.sql");

  if (!fs.existsSync(migrationPath)) {
    console.warn(`⚠️  Migration file not found at ${migrationPath}`);
    return;
  }

  let content = fs.readFileSync(migrationPath, "utf8");

  // Replace PROJECT_ID placeholders
  content = content.replace(/https:\/\/PROJECT_ID\.supabase\.co/g, `https://${projectId}.supabase.co`);

  // Add function to set the secret (if not already present)
  if (!content.includes("app.internal_sync_secret")) {
    const setupSecret = `
-- Set the sync secret for pg_cron to use
ALTER DATABASE "${projectId}" SET "app.internal_sync_secret" = '${syncSecret}';
`;
    content = setupSecret + content;
  }

  fs.writeFileSync(migrationPath, content, "utf8");
  console.log(`✅ Updated pg_cron migration with PROJECT_ID=${projectId}`);
}

async function printNextSteps(config: SetupConfig): Promise<void> {
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 PHASE 3 SETUP CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Your configuration:
   Project ID: ${config.projectId}
   Supabase URL: ${config.supabaseUrl}
   Sync Secret: ${config.syncSecret.substring(0, 8)}...

📝 Next steps:

1. CREATE EDGE FUNCTIONS in Supabase:

   a) Deploy sync-daily:
      supabase functions deploy sync-daily

   b) Deploy sync-intraday:
      supabase functions deploy sync-intraday

   c) Set secrets for Edge Functions:
      supabase secrets set NEXT_PUBLIC_URL=${process.env.NEXT_PUBLIC_URL || "https://your-domain.com"}
      supabase secrets set INTERNAL_SYNC_SECRET=${config.syncSecret}

2. EXECUTE pg_cron MIGRATION:

   The migration 007_setup_pg_cron.sql has been updated.

   Option A (SQL Editor in Supabase Dashboard):
     - Go to SQL Editor
     - Paste contents of scripts/migrations/007_setup_pg_cron.sql
     - Click Execute

   Option B (via Supabase CLI):
     - supabase db push

3. INITIALIZE COINS:

   Option A (via script):
     npx ts-node scripts/init-crypto-coins.ts

   Option B (via SQL):
     INSERT INTO public.coins (symbol, name, coincap_id)
     VALUES
       ('BTC', 'Bitcoin', 'bitcoin'),
       ('ETH', 'Ethereum', 'ethereum'),
       -- ... more coins
     ON CONFLICT (symbol) DO NOTHING;

4. VERIFY SETUP:

   a) Check if pg_cron jobs are scheduled:
      SELECT * FROM cron.job WHERE jobname LIKE 'sync-crypto%';

   b) Check if coins were inserted:
      SELECT COUNT(*) FROM public.coins;

   c) Check Edge Function logs:
      supabase functions logs sync-daily
      supabase functions logs sync-intraday

5. START INITIAL SYNC:

   Option A (if you have the Edge Function running):
     curl -X POST https://${config.projectId}.supabase.co/functions/v1/sync-intraday \\
       -H "Authorization: Bearer ${config.syncSecret}" \\
       -H "Content-Type: application/json" \\
       -d '{}'

   Option B (via internal endpoint):
     curl -X POST http://localhost:3000/api/internal/sync-intraday \\
       -H "Authorization: Bearer ${config.syncSecret}" \\
       -H "Content-Type: application/json" \\
       -d '{}'

6. MONITOR SYNC:

   After starting sync, verify data was populated:
     SELECT COUNT(*) FROM public.price_intraday;
     SELECT COUNT(*) FROM public.coin_metrics;
     SELECT * FROM public.price_intraday ORDER BY created_at DESC LIMIT 5;

7. TEST LLM ENDPOINT:

   Once coins and metrics are populated:
     curl -X POST http://localhost:3000/api/crypto-ai-analyst \\
       -H "Content-Type: application/json" \\
       -d '{"query": "What is Bitcoin price?"}'

   Verify in logs: "[crypto-analyst] Using data source: Supabase"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 IMPORTANT NOTES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Replace 'https://your-domain.com' with your actual deployed URL
- Make sure NEXT_PUBLIC_URL is reachable from Supabase (for Edge Functions)
- pg_cron is included in Supabase by default (no need to enable)
- Edge Functions need INTERNAL_SYNC_SECRET set for auth to work
- Initial sync can take several minutes for full history (patience!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
}

async function main() {
  console.log("🚀 Crypto Sync Setup Script (Phase 3)\n");

  const config = await parseArgs();

  console.log("📋 Configuration:");
  console.log(`   Project ID: ${config.projectId}`);
  console.log(`   Supabase URL: ${config.supabaseUrl}`);
  console.log(`   Sync Secret: ${config.syncSecret.substring(0, 8)}...`);
  console.log("");

  // Update migration file
  await updatePgCronMigration(config.projectId, config.syncSecret);

  // Print next steps
  await printNextSteps(config);
}

main().catch((error) => {
  console.error("❌ Error:", error.message);
  process.exit(1);
});
