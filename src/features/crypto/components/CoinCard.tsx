import Image from "next/image";
import { Coin } from "../types/coin";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export const CoinCard = ({
  coin,
  isSelected,
  onSelect,
}: {
  coin: Coin;
  isSelected: boolean;
  onSelect: (coin: Coin) => void;
}) => {
  const isPositive = coin.price_change_percentage_24h >= 0;

  return (
    <button
      type="button"
      data-testid="coin-card"
      onClick={() => onSelect(coin)}
      className={`w-full rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-slate-900/90 ${
        isSelected
          ? "border-cyan-300/50 bg-slate-900 text-white shadow-lg shadow-cyan-950/30"
          : "border-white/10 bg-slate-950/70 text-slate-100"
      }`}
    >
      <div className="mb-4 flex items-center gap-3">
        <Image
          src={coin.image}
          alt={coin.name}
          width={40}
          height={40}
          className="h-10 w-10 rounded-full"
        />
        <div>
          <p className="font-semibold">{coin.name}</p>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            {coin.symbol}
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <p className="text-lg font-bold">
          {currencyFormatter.format(coin.current_price)}
        </p>

        <p
          className={`rounded-full px-2.5 py-1 text-sm font-semibold ${
            isPositive
              ? "bg-emerald-500/10 text-emerald-300"
              : "bg-rose-500/10 text-rose-300"
          }`}
        >
          {isPositive ? "+" : ""}
          {coin.price_change_percentage_24h.toFixed(2)}%
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-slate-400">
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em]">Market Cap</p>
          <p className="text-slate-100">
            ${compactFormatter.format(coin.market_cap)}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs uppercase tracking-[0.2em]">Volume</p>
          <p className="text-slate-100">
            ${compactFormatter.format(coin.total_volume)}
          </p>
        </div>
      </div>
    </button>
  );
};
