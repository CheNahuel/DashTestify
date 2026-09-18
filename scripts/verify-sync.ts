#!/usr/bin/env node
/**
 * Verify that crypto data sync is complete
 *
 * Usage:
 *   npx tsx scripts/verify-sync.ts
 *
 * This script checks:
 * - All coins are initialized
 * - Historical data is populated
 * - Metrics are calculated
 */

import "dotenv/config";
import { getSupabaseServiceClient } from "@/lib/supabase";

const EXPECTED_COINS = 10;
const MIN_DAYS_REQUIRED = 200;

async function verifySyncStatus() {
  const supabase = getSupabaseServiceClient();

  console.log("═".repeat(60));
  console.log("🔍 Verifying Crypto Data Sync Status");
  console.log("═".repeat(60) + "\n");

  try {
    // Check coins
    console.log("📍 Checking coins...");
    const { data: coins, error: coinsError } = await (supabase
      .from("coins")
      .select("id, symbol, name") as any);

    if (coinsError) {
      console.error("❌ Error fetching coins:", coinsError.message);
      process.exit(1);
    }

    if (!coins || coins.length === 0) {
      console.log("⚠️  No coins found");
      console.log("   → Run: npx tsx scripts/init-crypto-coins.ts\n");
      process.exit(1);
    }

    console.log(`✅ Found ${(coins as any[]).length} coins\n`);

    // Check each coin's data
    console.log("📊 Checking data completeness...\n");

    let allGood = true;

    for (const coin of coins as any[]) {
      const { count: priceCount } = await (supabase
        .from("price_daily")
        .select("*", { count: "exact", head: true })
        .eq("coin_id", coin.id) as any);

      const { data: metrics } = await (supabase
        .from("coin_metrics")
        .select("*")
        .eq("coin_id", coin.id)
        .single() as any);

      const hasPrices = priceCount && priceCount >= MIN_DAYS_REQUIRED;
      const hasMetrics = metrics !== null;

      const priceStatus = hasPrices
        ? `✅ ${priceCount} days`
        : `⚠️  ${priceCount || 0} days (need ${MIN_DAYS_REQUIRED})`;

      const metricsStatus = hasMetrics ? "✅ calculated" : "⚠️  missing";

      console.log(`${(coin as any).symbol.padEnd(6)} prices: ${priceStatus.padEnd(30)} metrics: ${metricsStatus}`);

      if (!hasPrices || !hasMetrics) {
        allGood = false;
      }
    }

    console.log("\n" + "═".repeat(60));

    if (allGood) {
      console.log("✨ All systems green! Data is ready for use.");
      console.log("═".repeat(60) + "\n");
      process.exit(0);
    } else {
      console.log("⚠️  Some coins are missing data");
      console.log("═".repeat(60));
      console.log("\n📝 To fix:");
      console.log("   1. npx tsx scripts/init-crypto-coins.ts");
      console.log("   2. npx tsx scripts/sync-historical-data.ts\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

verifySyncStatus();
