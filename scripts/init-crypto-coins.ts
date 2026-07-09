#!/usr/bin/env node
/**
 * Initialize crypto coins in Supabase
 *
 * Usage:
 *   npx ts-node scripts/init-crypto-coins.ts
 *
 * This script inserts default coins into the coins table.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 */

import { createClient } from "@supabase/supabase-js";

const DEFAULT_COINS = [
  { symbol: "BTC", name: "Bitcoin", coincapId: "bitcoin", coingeckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", coincapId: "ethereum", coingeckoId: "ethereum" },
  { symbol: "SOL", name: "Solana", coincapId: "solana", coingeckoId: "solana" },
  { symbol: "BNB", name: "Binance Coin", coincapId: "binance-coin", coingeckoId: "binance" },
  { symbol: "ADA", name: "Cardano", coincapId: "cardano", coingeckoId: "cardano" },
  { symbol: "XRP", name: "XRP", coincapId: "ripple", coingeckoId: "ripple" },
  { symbol: "DOGE", name: "Dogecoin", coincapId: "dogecoin", coingeckoId: "dogecoin" },
  { symbol: "LINK", name: "Chainlink", coincapId: "chainlink", coingeckoId: "chainlink" },
  { symbol: "USDT", name: "Tether", coincapId: "tether", coingeckoId: "tether" },
  { symbol: "USDC", name: "USD Coin", coincapId: "usd-coin", coingeckoId: "usd-coin" },
];

async function initializeCoins() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("❌ Missing environment variables:");
    if (!supabaseUrl) console.error("   SUPABASE_URL");
    if (!serviceRoleKey) console.error("   SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  console.log("🚀 Initializing crypto coins...\n");
  console.log(`📍 Supabase URL: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Insert coins
    const { data, error } = await supabase
      .from("coins")
      .upsert(
        DEFAULT_COINS.map((coin) => ({
          symbol: coin.symbol,
          name: coin.name,
          coincap_id: coin.coincapId,
          coingecko_id: coin.coingeckoId,
        })),
        { onConflict: "symbol" }
      )
      .select();

    if (error) {
      console.error("❌ Error inserting coins:", error.message);
      process.exit(1);
    }

    console.log(`✅ Inserted/updated ${data?.length || 0} coins:\n`);

    if (data) {
      data.forEach((coin) => {
        console.log(`   ${coin.symbol.padEnd(6)} - ${coin.name.padEnd(20)} (${coin.coincap_id})`);
      });
    }

    console.log("\n✨ Coins initialized successfully!");
    console.log("\n📝 Next: Run initial sync for each coin");
    console.log("   npx ts-node scripts/sync-initial-coins.ts");
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

initializeCoins();
