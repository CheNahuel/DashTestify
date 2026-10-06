import { expect, test } from "@playwright/test";
import { SIX_HOURS_MS, toSixHourPrices } from "../../../src/services/crypto/providers/six-hour-prices";

const END = Date.parse("2026-10-06T12:00:00.000Z");
const START = END - 7 * 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function hourlySeries(from: number, to: number) {
  const rows = [];
  for (let time = from; time < to; time += HOUR) {
    rows.push({ timestamp: new Date(time).toISOString(), price: time });
  }
  return rows;
}

test("h6 keeps one real point per filled 6-hour bucket across 7 days", () => {
  const prices = toSixHourPrices(hourlySeries(START, END), new Date(START), new Date(END));

  expect(prices).toHaveLength(28);
  expect(prices.map(([time]) => time)).toEqual(
    Array.from({ length: 28 }, (_, index) => START + (index + 1) * SIX_HOURS_MS - HOUR),
  );
});

test("6-hour buckets are deterministic and keep the last stored price", () => {
  const start = Date.parse("2026-10-06T00:00:00.000Z");
  const end = start + SIX_HOURS_MS;
  const rows = [
    { timestamp: new Date(start + HOUR).toISOString(), price: 1 },
    { timestamp: new Date(start + 4 * HOUR).toISOString(), price: 4 },
    { timestamp: new Date(start + 2 * HOUR).toISOString(), price: 2 },
  ];

  const first = toSixHourPrices(rows, new Date(start), new Date(end));
  const second = toSixHourPrices([...rows].reverse(), new Date(start), new Date(end));

  expect(first).toEqual([[start + 4 * HOUR, 4]]);
  expect(second).toEqual(first);
});

test("equal timestamps keep the later input row", () => {
  const time = Date.parse("2026-10-06T01:00:00.000Z");
  const start = Date.parse("2026-10-06T00:00:00.000Z");
  const end = start + SIX_HOURS_MS;
  const prices = toSixHourPrices(
    [
      { timestamp: new Date(time).toISOString(), price: 1 },
      { timestamp: new Date(time).toISOString(), price: 2 },
    ],
    new Date(start),
    new Date(end),
  );

  expect(prices).toEqual([[time, 2]]);
});

test("6-hour output is ascending and has no duplicate timestamps", () => {
  const rows = hourlySeries(START, END).reverse();
  const prices = toSixHourPrices(rows, new Date(START), new Date(END));
  const times = prices.map(([time]) => time);

  expect(times).toEqual([...times].sort((left, right) => left - right));
  expect(new Set(times).size).toBe(times.length);
  for (const time of times) {
    expect(time).toBeGreaterThanOrEqual(START);
    expect(time).toBeLessThanOrEqual(END);
  }
});

test("points outside the 7-day range are excluded", () => {
  const prices = toSixHourPrices(
    [
      { timestamp: new Date(START - HOUR).toISOString(), price: 1 },
      { timestamp: new Date(START + HOUR).toISOString(), price: 2 },
      { timestamp: new Date(END + HOUR).toISOString(), price: 3 },
    ],
    new Date(START),
    new Date(END),
  );

  expect(prices).toEqual([[START + HOUR, 2]]);
});

test("a 6-hour bucket with no stored point is omitted", () => {
  const gapStart = START + 2 * SIX_HOURS_MS;
  const rows = hourlySeries(START, END).filter((row) => {
    const time = Date.parse(row.timestamp);
    return time < gapStart || time >= gapStart + SIX_HOURS_MS;
  });
  const prices = toSixHourPrices(rows, new Date(START), new Date(END));
  const times = prices.map(([time]) => time);

  expect(prices).toHaveLength(27);
  expect(times.some((time) => time >= gapStart && time < gapStart + SIX_HOURS_MS)).toBe(false);
});
