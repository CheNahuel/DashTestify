import { expect, test } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  readPriceHistory,
  usesIntradayHistory,
  usesSixHourHistory,
} from "../../../src/services/crypto/providers/history-source";
import {
  MIN_LAST_HOUR_POINTS,
  intradayTailIsFresh,
  pointsFromMarketChart,
} from "../../../src/sync/intraday-points";

const NOW = Date.parse("2026-10-02T18:00:00.000Z");
const HOUR = 60 * 60 * 1000;

test("1H and 24H read raw intraday rows, 7D buckets them, and 30D/1Y stay daily", async () => {
  expect(usesIntradayHistory("m1")).toBe(true);
  expect(usesIntradayHistory("h1")).toBe(true);
  expect(usesIntradayHistory("h6")).toBe(false);
  expect(usesSixHourHistory("h6")).toBe(true);
  expect(usesSixHourHistory("m1")).toBe(false);
  expect(usesSixHourHistory("h1")).toBe(false);
  expect(usesIntradayHistory("h12")).toBe(false);
  expect(usesIntradayHistory("d1")).toBe(false);
  expect(usesSixHourHistory("h12")).toBe(false);
  expect(usesSixHourHistory("d1")).toBe(false);
});

test("1H history maps intraday timestamps and ignores daily closes", async () => {
  const calls: string[] = [];
  const history = await readPriceHistory(
    "coin-btc",
    { interval: "m1", start: NOW - HOUR, end: NOW },
    {
      getPriceDailyForCoin: async () => {
        calls.push("daily");
        return [{ date: "2026-10-02", close: "1" }];
      },
      getPriceIntradayForCoin: async () => {
        calls.push("intraday");
        return [{ timestamp: "2026-10-02T17:05:00.000Z", price: "100.5" }];
      },
      getPriceIntradaySeriesForCoin: async () => {
        calls.push("series");
        return [];
      },
    },
  );

  expect(calls).toEqual(["intraday"]);
  expect(history.prices).toEqual([[Date.parse("2026-10-02T17:05:00.000Z"), 100.5]]);
});

test("24H history reads price_intraday across the requested window", async () => {
  let range: { start: number; end: number } | null = null;
  const history = await readPriceHistory(
    "coin-eth",
    { interval: "h1", start: NOW - 24 * HOUR, end: NOW },
    {
      getPriceDailyForCoin: async () => [{ date: "2026-10-01", close: "9" }],
      getPriceIntradayForCoin: async (_coinId, start, end) => {
        range = { start: start.getTime(), end: end.getTime() };
        return [
          { timestamp: "2026-10-01T18:00:00.000Z", price: 200 },
          { timestamp: "2026-10-02T18:00:00.000Z", price: "210" },
        ];
      },
      getPriceIntradaySeriesForCoin: async () => {
        throw new Error("24H must not read the 7D series");
      },
    },
  );

  expect(range).toEqual({ start: NOW - 24 * HOUR, end: NOW });
  expect(history.prices).toEqual([
    [Date.parse("2026-10-01T18:00:00.000Z"), 200],
    [Date.parse("2026-10-02T18:00:00.000Z"), 210],
  ]);
});

test("30D and 1Y history keep using daily closes", async () => {
  const calls: string[] = [];
  const readers = {
    getPriceDailyForCoin: async () => {
      calls.push("daily");
      return [{ date: "2026-10-01", close: "42" }];
    },
    getPriceIntradayForCoin: async () => {
      calls.push("intraday");
      return [{ timestamp: "2026-10-02T17:05:00.000Z", price: "1" }];
    },
    getPriceIntradaySeriesForCoin: async () => {
      calls.push("series");
      return [{ timestamp: "2026-10-02T17:05:00.000Z", price: "9" }];
    },
  };

  const month = await readPriceHistory(
    "coin-btc",
    { interval: "h12", start: NOW - 30 * 24 * HOUR, end: NOW },
    readers,
  );
  const year = await readPriceHistory(
    "coin-btc",
    { interval: "d1", start: NOW - 365 * 24 * HOUR, end: NOW },
    readers,
  );

  expect(calls).toEqual(["daily", "daily"]);
  expect(month.prices).toEqual([[Date.parse("2026-10-01T00:00:00.000Z"), 42]]);
  expect(year.prices[0][1]).toBe(42);
});

test("7D history buckets stored intraday points and ignores daily closes", async () => {
  const calls: string[] = [];
  const history = await readPriceHistory(
    "coin-btc",
    { interval: "h6", start: NOW - 7 * 24 * HOUR, end: NOW },
    {
      getPriceDailyForCoin: async () => {
        calls.push("daily");
        return [{ date: "2026-10-01", close: "42" }];
      },
      getPriceIntradayForCoin: async () => {
        calls.push("intraday");
        return [{ timestamp: "2026-10-02T12:00:00.000Z", price: "1" }];
      },
      getPriceIntradaySeriesForCoin: async () => {
        calls.push("series");
        return [
          { timestamp: "2026-10-02T11:00:00.000Z", price: "10" },
          { timestamp: "2026-10-02T17:00:00.000Z", price: "12" },
        ];
      },
    },
  );

  expect(calls).toEqual(["series"]);
  expect(history.prices).toEqual([
    [Date.parse("2026-10-02T11:00:00.000Z"), 10],
    [Date.parse("2026-10-02T17:00:00.000Z"), 12],
  ]);
});

test("intraday refill runs unless the last hour already has enough recent points", () => {
  const fresh = new Date(NOW - 5 * 60 * 1000).toISOString();
  const stale = new Date(NOW - 20 * 60 * 1000).toISOString();

  expect(MIN_LAST_HOUR_POINTS).toBe(10);
  expect(intradayTailIsFresh(MIN_LAST_HOUR_POINTS, fresh, NOW)).toBe(true);
  expect(intradayTailIsFresh(MIN_LAST_HOUR_POINTS, stale, NOW)).toBe(false);
  expect(intradayTailIsFresh(MIN_LAST_HOUR_POINTS - 1, fresh, NOW)).toBe(false);
  expect(intradayTailIsFresh(48, fresh, NOW)).toBe(true);
  expect(intradayTailIsFresh(MIN_LAST_HOUR_POINTS, null, NOW)).toBe(false);
  expect(intradayTailIsFresh(null, fresh, NOW)).toBe(false);
});

test("sync-intraday counts the last hour before skipping the CoinGecko refill", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "supabase/functions/sync-intraday/index.ts"),
    "utf8",
  );

  expect(source).toContain("MIN_LAST_HOUR_POINTS = 10");
  expect(source).toContain('.gte("timestamp", hourStart)');
  expect(source).not.toContain("MIN_RECENT_POINTS");
});

test("market chart backfill keeps the last 24 hours of five-minute points", () => {
  const prices: Array<[number, number]> = [
    [NOW - 25 * HOUR, 1],
    [NOW - 30 * 60 * 1000, 2],
    [NOW - 25 * 60 * 1000, 3],
    [NOW - 25 * 60 * 1000, 3],
    [NOW + 5 * 60 * 1000, 4],
  ];

  const points = pointsFromMarketChart(
    {
      prices,
      market_caps: [[NOW - 30 * 60 * 1000, 500]],
      total_volumes: [[NOW - 30 * 60 * 1000, 80]],
    },
    NOW,
  );

  expect(points).toEqual([
    {
      timestamp: new Date(NOW - 30 * 60 * 1000).toISOString(),
      price: 2,
      market_cap: 500,
      volume_24h: 80,
    },
    {
      timestamp: new Date(NOW - 25 * 60 * 1000).toISOString(),
      price: 3,
      market_cap: null,
      volume_24h: null,
    },
  ]);
});
