"use client";

import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, YAxis } from "recharts";
import { CoinHistory } from "../types/coin";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatSmallCurrency = (value: number) => {
  if (!Number.isFinite(value)) return "";

  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;

  if (Math.abs(value) < 1) {
    return `$${value.toFixed(8)}`; // keep tiny coin prices visible
  }

  return currencyFormatter.format(value);
};

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

const formatTooltipValue = (value: string | number | readonly (string | number)[] | undefined) => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);

  return Number.isFinite(numericValue) ? formatSmallCurrency(numericValue) : "";
};

export const CoinChart = ({ data }: { data: CoinHistory | undefined }) => {
  const formatted =
    data?.prices.map(([timestamp, price]) => ({
      time: timestamp,
      price,
    })) ?? [];

  if (!formatted.length) {
    return (
      <div
        data-testid="coin-chart-empty"
        className="flex h-[200px] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/40 px-4 text-center text-sm text-slate-400 sm:h-[240px] sm:rounded-3xl md:h-[260px]"
      >
        No historical data available for this selection.
      </div>
    );
  }

  return (
    <div data-testid="coin-chart" className="h-[220px] w-full sm:h-[280px] md:h-[360px]">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 1, height: 1 }}>
        <LineChart data={formatted} margin={{ top: 8, right: 8, left: 12, bottom: 8 }}>
          <XAxis
            dataKey="time"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatXAxis}
            minTickGap={32}
            stroke="#94a3b8"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={["dataMin", "dataMax"]}
            tickFormatter={(value) => formatSmallCurrency(Number(value))}
            width={72}
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
          <Line type="monotone" dataKey="price" dot={false} stroke="#38bdf8" strokeWidth={2.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
