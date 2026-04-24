import Image from "next/image";
import { Coin } from "../types/coin";
import { useCoinHistory } from "../hooks/useCoinHistory";

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
  isFavorite,
  onSelect,
  onToggleFavorite,
  days = 1,
}: {
  coin: Coin;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (coin: Coin) => void;
  onToggleFavorite: (coin: Coin) => void;
  days?: number;
}) => {
  const { data: history } = useCoinHistory(coin.id, days);
  
  const historyPrices = history?.prices.map(([, price]) => price) ?? [];
  const priceChange =
    historyPrices.length > 0
      ? ((coin.current_price - historyPrices[0]) / historyPrices[0]) * 100
      : coin.price_change_percentage_24h;
  
  const isPositive = priceChange >= 0;

  return (
    <article
      data-testid="coin-card"
      data-coin-id={coin.id}
      data-favorite={isFavorite ? "true" : "false"}
      className={`w-full rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-slate-900/90 ${
        isSelected
          ? "border-cyan-300/50 bg-slate-900 text-white shadow-lg shadow-cyan-950/30"
          : "border-white/10 bg-slate-950/70 text-slate-100"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <button
          type="button"
          aria-label={`Select ${coin.name}`}
          aria-pressed={isSelected}
          onClick={() => onSelect(coin)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <Image
            src={coin.image}
            alt={coin.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full"
          />
          <div className="min-w-0">
            <p className="truncate font-semibold">{coin.name}</p>
            <p className="text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">
              {coin.symbol}
            </p>
          </div>
        </button>

        <button
          type="button"
          data-testid={`favorite-toggle-${coin.id}`}
          aria-pressed={isFavorite}
          aria-label={`${isFavorite ? "Remove" : "Add"} ${coin.name} ${isFavorite ? "from" : "to"} watchlist`}
          onClick={() => onToggleFavorite(coin)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition ${
            isFavorite
              ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
              : "border-white/10 bg-slate-950/70 text-slate-400 hover:border-amber-300/40 hover:text-amber-100"
          }`}
        >
          {isFavorite ? "Saved" : "Watch"}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onSelect(coin)}
        className="block w-full text-left"
      >
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
            {priceChange.toFixed(2)}%
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm text-slate-400">
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider whitespace-nowrap">Market Cap</p>
            <p className="text-slate-100">
              ${compactFormatter.format(coin.market_cap)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider whitespace-nowrap">Volume</p>
            <p className="text-slate-100">
              ${compactFormatter.format(coin.total_volume)}
            </p>
          </div>
        </div>
      </button>
    </article>
  );
};
