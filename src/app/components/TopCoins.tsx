"use client";

import { CoinCard } from "@/features/crypto/components/CoinCard";
import type { Coin, CoinHistoryRequest } from "@/features/crypto/types/coin";

export const TopCoins = ({
  coins,
  favoriteIds,
  onSelectCoin,
  onToggleFavorite,
  historyRequest,
  useMock = false,
  isFetching = false,
}: {
  coins: Coin[];
  favoriteIds: string[];
  onSelectCoin: (coin: Coin) => void;
  onToggleFavorite: (coin: Coin) => void;
  historyRequest: CoinHistoryRequest;
  useMock?: boolean;
  isFetching?: boolean;
}) => {
  return (
    <aside
      data-testid="top-coins-panel"
      className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 p-3 sm:rounded-3xl sm:p-4 md:p-5 xl:max-h-[1400px] xl:overflow-y-auto"
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider whitespace-nowrap text-slate-400 sm:text-sm">
            Market Snapshot
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white sm:mt-2 sm:text-2xl">Top Coins</h2>
        </div>
        <p className="shrink-0 text-xs text-slate-400 sm:text-sm">
          {isFetching ? "Updating..." : `${coins.length} shown`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="coins-list">
        {coins.length > 0 ? (
          coins.map((coin) => (
            <CoinCard
              key={coin.id}
              coin={coin}
              isSelected={false}
              isFavorite={favoriteIds.includes(coin.id)}
              onSelect={onSelectCoin}
              onToggleFavorite={onToggleFavorite}
              historyRequest={historyRequest}
              useMock={useMock}
            />
          ))
        ) : (
          <div
            data-testid="no-match-message"
            className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-3 text-sm text-slate-400 sm:p-4"
          >
            No assets match the active filters. Try clearing the watchlist filter or switching the
            trend selector.
          </div>
        )}
      </div>
    </aside>
  );
};
