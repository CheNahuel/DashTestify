#!/usr/bin/env node
/**
 * One-time backfill of the last 24 hours into price_intraday.
 *
 * CoinGecko market_chart?days=1 returns about one price every five minutes.
 * Rows that already exist (including 5-minute spot snapshots) are left in place.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-intraday.ts
 */

import "dotenv/config";
import { backfillIntraday } from "@/sync/backfillIntraday";

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Load them from .env before running.",
    );
    process.exit(1);
  }

  console.log("Backfilling the last 24 hours into price_intraday...");
  const results = await backfillIntraday();
  const inserted = results.reduce((sum, result) => sum + result.inserted, 0);

  for (const result of results) {
    const status = result.skipped && result.inserted === 0 ? "skipped" : "written";
    console.log(`  ${result.symbol}: ${status} (${result.inserted})`);
  }

  console.log(`Done. Inserted ${inserted} intraday points.`);
}

main().catch((error) => {
  console.error("Intraday backfill failed:", error);
  process.exit(1);
});
