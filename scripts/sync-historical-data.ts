#!/usr/bin/env node
/**
 * Sync historical crypto data from CoinGecko and CoinCap
 *
 * Usage:
 *   npx tsx scripts/sync-historical-data.ts
 *
 * This script syncs ~1 year of historical OHLC data for all supported coins.
 * Uses CoinGecko as primary source (no rate limits) with CoinCap fallback.
 * Data is processed incrementally to handle large datasets efficiently.
 *
 * Requires:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *   - Coins already initialized via scripts/init-crypto-coins.ts
 *
 * Troubleshooting:
 *   - Network error: Check your internet connection and firewall
 *   - Rate limit (429): Script will retry automatically. If persistent, check:
 *     * Are you running multiple sync scripts simultaneously? Stop them.
 *     * Try again in a few minutes
 *   - Database error: Ensure SUPABASE_SERVICE_ROLE_KEY is valid
 *   - Missing coins: Run scripts/init-crypto-coins.ts first
 */

import "dotenv/config";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { coincapClient } from "@/services/coincap/client";
import { calculateAllMetrics } from "@/services/metrics";
import * as queries from "@/database/queries";

interface CoinConfig {
  symbol: string;
  name: string;
  coincapId: string;
  coingeckoId: string;
}

const COINS: CoinConfig[] = [
  { symbol: "BTC", name: "Bitcoin", coincapId: "bitcoin", coingeckoId: "bitcoin" },
  { symbol: "ETH", name: "Ethereum", coincapId: "ethereum", coingeckoId: "ethereum" },
  { symbol: "SOL", name: "Solana", coincapId: "solana", coingeckoId: "solana" },
  { symbol: "BNB", name: "Binance Coin", coincapId: "binance-coin", coingeckoId: "binancecoin" },
  { symbol: "ADA", name: "Cardano", coincapId: "cardano", coingeckoId: "cardano" },
  { symbol: "XRP", name: "XRP", coincapId: "xrp", coingeckoId: "ripple" },
  { symbol: "DOGE", name: "Dogecoin", coincapId: "dogecoin", coingeckoId: "dogecoin" },
  { symbol: "LINK", name: "Chainlink", coincapId: "chainlink", coingeckoId: "chainlink" },
  { symbol: "USDT", name: "Tether", coincapId: "tether", coingeckoId: "tether" },
  { symbol: "USDC", name: "USD Coin", coincapId: "usd-coin", coingeckoId: "usd-coin" },
];

const BATCH_SIZE = 50; // Insert candles in batches
const RETRY_ATTEMPTS = 3;
const DELAY_BETWEEN_COINS = 1000; // 1s between coins (polite to APIs)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface DailyCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

async function fetchFromCoinGecko(coingeckoId: string): Promise<DailyCandle[] | null> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=365&interval=daily`;
    const response = await fetch(url);

    if (response.status === 404) {
      console.warn(
        `⚠️  CoinGecko: Coin "${coingeckoId}" not found (404)`
      );
      return null;
    }

    if (!response.ok) {
      console.warn(`⚠️  CoinGecko: HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { prices: Array<[number, number]> };

    if (!data.prices || data.prices.length === 0) {
      console.warn(`⚠️  CoinGecko: No price data returned`);
      return null;
    }

    const candles = data.prices
      .map(([timestamp, price]) => ({
        date: new Date(timestamp).toISOString().split("T")[0],
        price,
      }))
      .reduce((acc, h) => {
        const date = h.date;
        const existing = acc.find((c) => c.date === date);

        if (existing) {
          existing.high = Math.max(existing.high, h.price);
          existing.low = Math.min(existing.low, h.price);
          existing.close = h.price;
        } else {
          acc.push({
            date,
            open: h.price,
            high: h.price,
            low: h.price,
            close: h.price,
          });
        }

        return acc;
      }, [] as DailyCandle[])
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return candles;
  } catch (error) {
    console.warn(
      `⚠️  CoinGecko fetch failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

async function fetchFromCoinCap(
  coincapId: string
): Promise<DailyCandle[] | null> {
  try {
    console.log(`  → Trying CoinCap fallback...`);
    const history = await coincapClient.fetchCoinHistory(coincapId, "d1", 365);

    if (!history || history.length === 0) {
      console.warn(`⚠️  CoinCap: No data returned`);
      return null;
    }

    interface CoinCapPoint {
      time: number;
      priceUsd: string;
    }

    const candles = (history as CoinCapPoint[])
      .map((h) => ({
        date: new Date(h.time).toISOString().split("T")[0],
        price: Number(h.priceUsd),
      }))
      .reduce((acc, h) => {
        const date = h.date;
        const existing = acc.find((c) => c.date === date);

        if (existing) {
          existing.high = Math.max(existing.high, h.price);
          existing.low = Math.min(existing.low, h.price);
          existing.close = h.price;
        } else {
          acc.push({
            date,
            open: h.price,
            high: h.price,
            low: h.price,
            close: h.price,
          });
        }

        return acc;
      }, [] as DailyCandle[])
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return candles;
  } catch (error) {
    console.warn(
      `⚠️  CoinCap fallback failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

async function syncCoin(coin: CoinConfig): Promise<{
  success: boolean;
  symbol: string;
  message: string;
  priceCount?: number;
}> {
  const supabase = getSupabaseServiceClient();

  try {
    console.log(`\n🔄 ${coin.symbol.padEnd(6)} Syncing...`);

    // Get or create coin
    let dbCoin = await queries.getCoinBySymbol(coin.symbol);

    if (!dbCoin) {
      console.log(`  ℹ️  Coin not found. Creating...`);
      const { data, error } = await supabase
        .from("coins")
        .insert({
          symbol: coin.symbol,
          name: coin.name,
          coincap_id: coin.coincapId,
          coingecko_id: coin.coingeckoId,
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          symbol: coin.symbol,
          message: `Failed to create coin: ${error.message}`,
        };
      }

      dbCoin = data;
    }

    // Check if already synced
    const { count: existingCount } = await supabase
      .from("price_daily")
      .select("*", { count: "exact", head: true })
      .eq("coin_id", dbCoin.id);

    if (existingCount && existingCount > 200) {
      console.log(`  ✓ Already synced (${existingCount} days) — skipping`);
      return {
        success: true,
        symbol: coin.symbol,
        message: "Already synced",
        priceCount: 0,
      };
    }

    // Try CoinGecko first (better rate limits)
    console.log(`  📡 Fetching from CoinGecko...`);
    let candles = await fetchFromCoinGecko(coin.coingeckoId);

    // Fallback to CoinCap if CoinGecko fails
    if (!candles) {
      candles = await fetchFromCoinCap(coin.coincapId);
    }

    if (!candles || candles.length === 0) {
      return {
        success: false,
        symbol: coin.symbol,
        message: "No data from CoinGecko or CoinCap. Check if coin IDs are correct.",
      };
    }

    console.log(`  ✓ Got ${candles.length} daily candles`);

    // Insert in batches
    console.log(`  💾 Inserting to Supabase...`);
    let insertedCount = 0;

    for (let i = 0; i < candles.length; i += BATCH_SIZE) {
      const batch = candles.slice(
        i,
        Math.min(i + BATCH_SIZE, candles.length)
      );

      const { error } = await supabase.from("price_daily").upsert(
        batch.map((candle) => ({
          coin_id: dbCoin.id,
          date: candle.date,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: null,
          market_cap: null,
        })),
        { onConflict: "coin_id,date" }
      );

      if (error) {
        console.warn(
          `  ⚠️  Batch insert error: ${error.message}`
        );
      } else {
        insertedCount += batch.length;
      }

      // Progress indicator
      const progress = Math.min(i + BATCH_SIZE, candles.length);
      process.stdout.write(`\r  Progress: ${progress}/${candles.length}`);
    }

    console.log(""); // New line after progress

    // Calculate metrics
    console.log(`  📊 Calculating metrics...`);
    const metrics = calculateAllMetrics(candles);
    const latestCandle = candles[candles.length - 1];

    const { error: metricsError } = await supabase
      .from("coin_metrics")
      .upsert(
        {
          coin_id: dbCoin.id,
          current_price: latestCandle.close,
          ytd_return: metrics.ytdReturn,
          return_1m: metrics.return1m,
          return_3m: metrics.return3m,
          return_6m: metrics.return6m,
          return_1y: metrics.return1y,
          ath: metrics.ath,
          ath_date: metrics.athDate,
          drawdown: metrics.drawdown,
          ema20: metrics.ema20,
          ema50: metrics.ema50,
          ema200: metrics.ema200,
          rsi14: metrics.rsi14,
          volatility: metrics.volatility,
          market_cap: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "coin_id" }
      );

    if (metricsError) {
      console.warn(`  ⚠️  Metrics error: ${metricsError.message}`);
    } else {
      console.log(`  ✓ Metrics updated`);
    }

    console.log(`✅ ${coin.symbol} complete (${insertedCount} candles)`);

    return {
      success: true,
      symbol: coin.symbol,
      message: `Synced successfully`,
      priceCount: insertedCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error(`❌ ${coin.symbol} failed:`, message);

    return {
      success: false,
      symbol: coin.symbol,
      message,
    };
  }
}

async function main() {
  console.log("═".repeat(60));
  console.log("🚀 Historical Crypto Data Sync");
  console.log("═".repeat(60));

  // Validate environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      "\n❌ Missing environment variables:\n" +
        (process.env.SUPABASE_URL ? "" : "   - SUPABASE_URL\n") +
        (process.env.SUPABASE_SERVICE_ROLE_KEY ? "" : "   - SUPABASE_SERVICE_ROLE_KEY\n")
    );
    process.exit(1);
  }

  console.log(`📍 Supabase: ${process.env.SUPABASE_URL}`);
  console.log(`📊 Coins: ${COINS.length}`);
  console.log(`⏱️  Strategy: CoinGecko (primary) → CoinCap (fallback)`);
  console.log("═".repeat(60));

  const results = [];

  for (let i = 0; i < COINS.length; i++) {
    const coin = COINS[i];
    const result = await syncCoin(coin);
    results.push(result);

    // Delay between coins (be nice to APIs)
    if (i < COINS.length - 1) {
      await sleep(DELAY_BETWEEN_COINS);
    }
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("📈 SYNC RESULTS");
  console.log("═".repeat(60));

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  succeeded.forEach((r) => {
    const count = r.priceCount || "N/A";
    console.log(`  ✅ ${r.symbol.padEnd(6)} ${count} candles — ${r.message}`);
  });

  failed.forEach((r) => {
    console.log(`  ❌ ${r.symbol.padEnd(6)} ${r.message}`);
  });

  console.log("═".repeat(60));
  console.log(`Result: ${succeeded.length}/${COINS.length} coins synced successfully`);

  if (failed.length > 0) {
    console.log("\n📋 Troubleshooting failed coins:");
    console.log("  1. Check coin IDs in COINS array (coincapId, coingeckoId)");
    console.log("  2. Verify network connectivity");
    console.log("  3. Check that coins were initialized: npx tsx scripts/init-crypto-coins.ts");
    console.log("  4. Review error messages above for specific issues");
    console.log("  5. Try running again in a few minutes (may be rate limited)");
    process.exit(1);
  }

  console.log("\n✨ All coins synced successfully!");
  console.log("═".repeat(60));
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error);
  process.exit(1);
});
