export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export type TimedPrice = {
  timestamp: string | number | Date;
  price: string | number;
};

/**
 * Keep the last stored price in each UTC 6-hour bucket.
 * The returned timestamp is that observation, not a synthesized boundary.
 * A bucket with no stored point is omitted. Ties on the same timestamp keep
 * the later row in input order.
 */
export function toSixHourPrices(
  rows: TimedPrice[],
  start: Date,
  end: Date,
): Array<[number, number]> {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const chosen = new Map<number, { time: number; price: number; order: number }>();

  rows.forEach((row, order) => {
    const time = new Date(row.timestamp).getTime();
    const price = Number(row.price);
    if (!Number.isFinite(time) || !Number.isFinite(price)) return;
    if (time < startMs || time > endMs) return;

    const bucket = Math.floor(time / SIX_HOURS_MS) * SIX_HOURS_MS;
    const current = chosen.get(bucket);
    if (!current || time > current.time || (time === current.time && order > current.order)) {
      chosen.set(bucket, { time, price, order });
    }
  });

  return [...chosen.values()]
    .sort((left, right) => left.time - right.time || left.order - right.order)
    .map((point) => [point.time, point.price]);
}
