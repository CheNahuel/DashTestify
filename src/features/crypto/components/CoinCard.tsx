import Image from "next/image";
import { Coin } from "../types/coin";
import { useCoinHistory } from "../hooks/useCoinHistory";
import { CoinSparkline } from "./CoinSparkline";

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
  useMock = false,
}: {
  coin: Coin;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (coin: Coin) => void;
  onToggleFavorite: (coin: Coin) => void;
  days?: number;
  useMock?: boolean;
}) => {
  const { data: history } = useCoinHistory(coin.id, days, useMock);

  const historyPrices = history?.prices.map(([, price]) => price) ?? [];
  const sparklinePrices = history?.prices ?? [];
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
      className={`w-full rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:bg-slate-900/90 sm:rounded-3xl sm:p-4 ${
        isSelected
          ? "border-cyan-300/50 bg-slate-900 text-white shadow-lg shadow-cyan-950/30"
          : "border-white/10 bg-slate-950/70 text-slate-100"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2 sm:mb-4 sm:gap-3">
        <button
          type="button"
          aria-label={`Select ${coin.name}`}
          aria-pressed={isSelected}
          onClick={() => onSelect(coin)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left sm:gap-3"
        >
          <Image
            src={
              coin.image ||
              `data:image/svg+xml;base64,${btoa(`<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="#64748b"/><text x="20" y="25" text-anchor="middle" font-family="Arial" font-size="12" fill="white">${coin.symbol.slice(0, 2).toUpperCase()}</text></svg>`)}`
            }
            alt={coin.name}
            width={40}
            height={40}
            className="h-8 w-8 shrink-0 rounded-full sm:h-10 sm:w-10"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold sm:text-base">{coin.name}</p>
            <p className="truncate text-xs uppercase tracking-wider text-slate-400 sm:text-sm">
              {coin.symbol}
            </p>
          </div>
        </button>

        <button
          type="button"
          data-testid={`favorite-toggle-${coin.id}`}
          aria-pressed={isFavorite}
          aria-label={`${isFavorite ? "Remove" : "Add"} ${coin.name} ${isFavorite ? "from" : "to"} watchlist`}
          onClick={() => {
            onToggleFavorite(coin);
            onSelect(coin);
          }}
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition sm:px-3 sm:text-xs ${
            isFavorite
              ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
              : "border-white/10 bg-slate-950/70 text-slate-400 hover:border-amber-300/40 hover:text-amber-100"
          }`}
        >
          {isFavorite ? "Saved" : "Watch"}
        </button>
      </div>

      <button type="button" onClick={() => onSelect(coin)} className="block w-full text-left">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <p className="text-base font-bold sm:text-lg">
            {currencyFormatter.format(coin.current_price)}
          </p>

          <p
            className={`rounded-full px-2.5 py-1 text-xs font-semibold sm:text-sm ${
              isPositive ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
            }`}
          >
            {isPositive ? "+" : ""}
            {priceChange.toFixed(2)}%
          </p>
        </div>

        {sparklinePrices.length > 0 && (
          <div className="w-full">
            <CoinSparkline prices={sparklinePrices} isPositive={isPositive} coinId={coin.id} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 sm:gap-3 sm:text-sm">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase tracking-wider sm:text-xs">Market Cap</p>
            <p className="truncate text-slate-100">${compactFormatter.format(coin.market_cap)}</p>
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase tracking-wider sm:text-xs">Volume</p>
            <p className="truncate text-slate-100">${compactFormatter.format(coin.total_volume)}</p>
          </div>
        </div>
      </button>
    </article>
  );
};
