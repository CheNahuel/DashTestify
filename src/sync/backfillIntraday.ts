/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseServiceClient } from "@/lib/supabase";
import * as queries from "@/database/queries";
import {
  intradayTailIsFresh,
  pointsFromMarketChart,
  type IntradayPoint,
  type MarketChartResponse,
} from "./intraday-points";

const COINGECKO_MARKET_CHART = "https://api.coingecko.com/api/v3/coins";
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

export type IntradayBackfillResult = {
  symbol: string;
  inserted: number;
  skipped: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchCoinGeckoDayChart(coingeckoId: string): Promise<IntradayPoint[]> {
  const url = `${COINGECKO_MARKET_CHART}/${coingeckoId}/market_chart?vs_currency=usd&days=1`;
  let response: Response | null = null;

  for (let attempt = 0; attempt < 4; attempt++) {
    response = await fetch(url);
    if (response.status !== 429) break;
    await sleep(15_000 * (attempt + 1));
  }

  if (!response || !response.ok) {
    throw new Error(
      `CoinGecko market_chart failed for ${coingeckoId}: ${response?.status ?? "no response"}`,
    );
  }

  const data = (await response.json()) as MarketChartResponse;
  return pointsFromMarketChart(data);
}

/**
 * Insert the last 24 hours of ~5-minute CoinGecko prices into price_intraday.
 * Existing timestamps are left in place, including the 5-minute spot snapshots.
 */
export async function backfillIntraday(): Promise<IntradayBackfillResult[]> {
  const supabase = getSupabaseServiceClient();
  const coins = await queries.getAllCoins();
  const results: IntradayBackfillResult[] = [];
  const windowStart = new Date(Date.now() - DAY_MS).toISOString();

  for (const coin of coins) {
    if (!coin.coingecko_id) {
      console.log(`${coin.symbol}: no coingecko_id, skipping intraday backfill`);
      results.push({ symbol: coin.symbol, inserted: 0, skipped: true });
      continue;
    }

    const { count, error: countError } = await (supabase as any)
      .from("price_intraday")
      .select("id", { count: "exact", head: true })
      .eq("coin_id", coin.id)
      .gte("timestamp", windowStart);

    let newestTimestamp: string | null = null;
    if (!countError) {
      const { data: latestRows, error: latestError } = await (supabase as any)
        .from("price_intraday")
        .select("timestamp")
        .eq("coin_id", coin.id)
        .order("timestamp", { ascending: false })
        .limit(1);

      if (!latestError) {
        newestTimestamp = latestRows?.[0]?.timestamp ?? null;
      }
    }

    if (!countError && intradayTailIsFresh(count ?? 0, newestTimestamp)) {
      console.log(`${coin.symbol}: ${count} recent intraday points and a fresh tail, skipping backfill`);
      results.push({ symbol: coin.symbol, inserted: 0, skipped: true });
      continue;
    }

    let points: IntradayPoint[];
    try {
      points = await fetchCoinGeckoDayChart(coin.coingecko_id);
    } catch (error) {
      console.error(`${coin.symbol}: intraday backfill fetch failed:`, error);
      results.push({ symbol: coin.symbol, inserted: 0, skipped: true });
      await sleep(8000);
      continue;
    }

    const { data: existing, error: existingError } = await (supabase as any)
      .from("price_intraday")
      .select("timestamp")
      .eq("coin_id", coin.id)
      .gte("timestamp", windowStart)
      .limit(1000);

    if (existingError) {
      console.error(`${coin.symbol}: failed to read existing intraday rows:`, existingError);
      results.push({ symbol: coin.symbol, inserted: 0, skipped: true });
      continue;
    }

    const existingTimes = new Set(
      (existing ?? []).map((row: { timestamp: string }) => new Date(row.timestamp).toISOString()),
    );
    const missing = points.filter((point) => !existingTimes.has(point.timestamp));

    let inserted = 0;
    for (let index = 0; index < missing.length; index += BATCH_SIZE) {
      const batch = missing.slice(index, index + BATCH_SIZE).map((point) => ({
        coin_id: coin.id,
        timestamp: point.timestamp,
        price: point.price,
        market_cap: point.market_cap,
        volume_24h: point.volume_24h,
        change_24h: null,
      }));

      const { error } = await (supabase as any).from("price_intraday").insert(batch);
      if (error) {
        console.error(`${coin.symbol}: failed to insert intraday batch:`, error);
        break;
      }

      inserted += batch.length;
    }

    console.log(`${coin.symbol}: inserted ${inserted} intraday points`);
    results.push({ symbol: coin.symbol, inserted, skipped: false });
    await sleep(4000);
  }

  return results;
}
