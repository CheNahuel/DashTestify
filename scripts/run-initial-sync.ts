#!/usr/bin/env node
/**
 * Run initial historical sync for all crypto coins
 *
 * Usage:
 *   npx tsx scripts/run-initial-sync.ts
 *
 * This script fetches ~1 year of historical OHLC data from CoinCap for each
 * coin and populates price_daily and coin_metrics. Run once after seeding coins.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from "@supabase/supabase-js";
import { syncInitialBatch } from "@/sync/syncInitial";

const DEFAULT_COINS = [
  { symbol: "BTC", name: "Bitcoin", coincapId: "bitcoin", coingeckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", coincapId: "ethereum", coingeckoId: "ethereum" },
  { symbol: "SOL", name: "Solana", coincapId: "solana", coingeckoId: "solana" },
  { symbol: "BNB", name: "Binance Coin", coincapId: "binance-coin", coingeckoId: "binance" },
  { symbol: "ADA", name: "Cardano", coincapId: "cardano", coingeckoId: "cardano" },
  { symbol: "XRP", name: "XRP", coincapId: "xrp", coingeckoId: "ripple" },
  { symbol: "DOGE", name: "Dogecoin", coincapId: "dogecoin", coingeckoId: "dogecoin" },
  { symbol: "LINK", name: "Chainlink", coincapId: "chainlink", coingeckoId: "chainlink" },
  { symbol: "USDT", name: "Tether", coincapId: "tether", coingeckoId: "tether" },
  { symbol: "USDC", name: "USD Coin", coincapId: "usd-coin", coingeckoId: "usd-coin" },
];

async function runInitialSync() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Missing environment variables:");
    if (!supabaseUrl) console.error("   SUPABASE_URL");
    if (!serviceRoleKey) console.error("   SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log("🚀 Starting initial crypto data sync...\n");
  console.log(`📍 Supabase URL: ${supabaseUrl}`);
  console.log(`📊 Syncing ${DEFAULT_COINS.length} coins\n`);

  try {
    const results = await syncInitialBatch(DEFAULT_COINS);

    console.log("\n📈 Sync Results:\n");
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    succeeded.forEach((r) => {
      if (r.success) {
        console.log(`✅ ${r.coinId}: ${r.priceCount} daily candles`);
      }
    });

    failed.forEach((r) => {
      if (!r.success) {
        console.log(`❌ ${r.symbol}: ${r.error}`);
      }
    });

    console.log(
      `\n✨ Initial sync complete: ${succeeded.length}/${DEFAULT_COINS.length} succeeded`
    );

    if (failed.length > 0) {
      console.log("\n⚠️  Failed coins:");
      failed.forEach((f) => {
        if (!f.success) {
          console.log(`   - ${f.symbol}: ${f.error}`);
        }
      });
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

runInitialSync();
