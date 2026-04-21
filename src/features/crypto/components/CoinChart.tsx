"use client";

import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  YAxis,
} from "recharts";
import { CoinHistory } from "../types/coin";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatXAxis = (value: number) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

const formatTooltipLabel = (value: number) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const formatTooltipValue = (
  value: string | number | readonly (string | number)[] | undefined
) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);

  return Number.isFinite(numericValue)
    ? currencyFormatter.format(numericValue)
    : "";
};

export const CoinChart = ({ data }: { data: CoinHistory | undefined }) => {
  const formatted =
    data?.prices.map(([timestamp, price]) => ({
      time: timestamp,
      price,
    })) ?? [];

  if (!formatted.length) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-3xl border border-white/10 bg-slate-950/40 text-sm text-slate-400">
        No historical data available for this selection.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={formatted} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <XAxis
          dataKey="time"
          tickFormatter={formatXAxis}
          minTickGap={32}
          stroke="#94a3b8"
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
          width={64}
          stroke="#94a3b8"
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(value) => formatTooltipValue(value)}
          labelFormatter={(value) => formatTooltipLabel(Number(value))}
          contentStyle={{
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: "16px",
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            color: "#e2e8f0",
          }}
        />
        <Line
          type="monotone"
          dataKey="price"
          dot={false}
          stroke="#38bdf8"
          strokeWidth={3}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};
