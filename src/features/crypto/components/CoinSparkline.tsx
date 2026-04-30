"use client";

import { AreaChart, Area, ResponsiveContainer, YAxis, XAxis } from "recharts";
import { CoinHistoryPoint } from "../types/coin";

export const CoinSparkline = ({
  prices,
  isPositive,
  coinId,
}: {
  prices: CoinHistoryPoint[];
  isPositive: boolean;
  coinId: string;
}) => {
  const data = prices.map(([time, price]) => ({ time, price }));

  if (!data.length) return null;

  const color = isPositive ? "#34d399" : "#f87171";
  const gradientId = `sparkline-${coinId}`;

  return (
    <div data-testid="coin-sparkline" className="h-20 w-full relative">
      <ResponsiveContainer width="100%"  height={58}>
      <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
      <XAxis dataKey="time" type="number"  hide={true} domain={['dataMin', 'dataMax']} />
        <YAxis hide={true} domain={['auto', 'auto']} />
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="price"
            dot={false}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
