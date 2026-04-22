"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/Container";
import { CoinCard } from "./CoinCard";
import { CoinChart } from "./CoinChart";
import { SearchBar } from "./SearchBar";
import { useCoinHistory } from "../hooks/useCoinHistory";
import { useCoins } from "../hooks/useCoins";
import { Coin } from "../types/coin";

const DAY_FILTERS = [
  { label: "24H", value: 1 },
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

export const CryptoDashboard = ({
  initialCoins,
  marketUnavailable = false,
  initialSearch = "",
  initialSelectedCoinId,
  initialDays = 7,
}: {
  initialCoins: Coin[];
  marketUnavailable?: boolean;
  initialSearch?: string;
  initialSelectedCoinId?: string;
  initialDays?: number;
}) => {
  const searchParams = useSearchParams();
  const querySearch = searchParams?.get("search") ?? initialSearch;
  const querySelectedCoin = searchParams?.get("selectedCoin") ?? initialSelectedCoinId;
  const queryDays = Number(searchParams?.get("days") ?? initialDays);

  const { data: coins = initialCoins, isFetching, error } = useCoins(initialCoins);
  const [search, setSearch] = useState(querySearch);
  const [selectedCoinId, setSelectedCoinId] = useState(
    querySelectedCoin ?? initialCoins[0]?.id ?? ""
  );
  const [days, setDays] = useState(queryDays);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    if (querySearch !== search) {
      setSearch(querySearch);
    }
  }, [querySearch]);

  useEffect(() => {
    if (querySelectedCoin && querySelectedCoin !== selectedCoinId) {
      setSelectedCoinId(querySelectedCoin);
    }
  }, [querySelectedCoin]);

  useEffect(() => {
    if (queryDays !== days) {
      setDays(queryDays);
    }
  }, [queryDays]);

  const filteredCoins = coins.filter((coin) => {
    const query = deferredSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      coin.name.toLowerCase().includes(query) ||
      coin.symbol.toLowerCase().includes(query)
    );
  });

  const selectedCoin =
    filteredCoins.find((coin) => coin.id === selectedCoinId) ?? filteredCoins[0];

  const {
    data: history,
    isLoading: isHistoryLoading,
    isFetching: isHistoryFetching,
    error: historyError,
  } = useCoinHistory(selectedCoin?.id ?? null, days);

  const historyPrices = history?.prices.map(([, price]) => price) ?? [];
  const selectedRangeHigh =
    historyPrices.length > 0 ? Math.max(...historyPrices) : selectedCoin?.current_price;
  const selectedRangeLow =
    historyPrices.length > 0 ? Math.min(...historyPrices) : selectedCoin?.current_price;

  return (
    <Container>
      <section className="mb-8 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur md:p-8">
        <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm uppercase tracking-[0.35em] text-cyan-300">
              Crypto Intelligence
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Track prices, compare trends, and inspect historical movement.
            </h1>
            <p className="mt-4 text-base text-slate-300">
              Search the market list, choose a coin, and switch the chart range
              to explore short and medium-term performance.
            </p>
          </div>

          <div className="w-full max-w-md">
            <SearchBar value={search} onChange={setSearch} />
          </div>
        </div>

        {error || marketUnavailable ? (
          <div
            data-testid="market-error-banner"
            className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100"
          >
            We couldn&apos;t refresh the market feed right now. If CoinCap is
            rate-limiting requests, the dashboard will recover automatically in a
            moment.
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            {selectedCoin ? (
              <>
                <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                      Selected Asset
                    </p>
                    <h2
                      data-testid="selected-asset-name"
                      className="mt-2 text-3xl font-semibold text-white"
                    >
                      {selectedCoin.name}
                    </h2>
                    <p data-testid="selected-asset-price" className="mt-2 text-slate-300">
                      {currencyFormatter.format(selectedCoin.current_price)}
                      <span
                        data-testid="selected-asset-change"
                        className={`ml-3 text-sm font-semibold ${
                          selectedCoin.price_change_percentage_24h >= 0
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }`}
                      >
                        {selectedCoin.price_change_percentage_24h >= 0 ? "+" : ""}
                        {selectedCoin.price_change_percentage_24h.toFixed(2)}% in 24h
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {DAY_FILTERS.map((filter) => (
                      <button
                        key={filter.value}
                        type="button"
                        data-testid={`range-button-${filter.value}`}
                        aria-pressed={days === filter.value}
                        onClick={() => setDays(filter.value)}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                          days === filter.value
                            ? "bg-cyan-300 text-slate-950"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>

                {historyError ? (
                  <div className="flex h-[260px] items-center justify-center rounded-3xl border border-rose-500/30 bg-rose-500/10 text-sm text-rose-100">
                    {historyError instanceof Error
                      ? historyError.message
                      : "We couldn&apos;t load historical data for this coin."}
                  </div>
                ) : isHistoryLoading ? (
                  <div className="flex h-[260px] items-center justify-center rounded-3xl border border-white/10 bg-slate-950/40 text-sm text-slate-400">
                    Loading chart data...
                  </div>
                ) : (
                  <div data-testid="selected-coin-chart">
                    <CoinChart data={history} />
                  </div>
                )}

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <StatCard
                    label="Market Cap"
                    value={`$${compactFormatter.format(selectedCoin.market_cap)}`}
                  />
                  <StatCard
                    label="Range High"
                    value={currencyFormatter.format(selectedRangeHigh ?? 0)}
                  />
                  <StatCard
                    label="Range Low"
                    value={currencyFormatter.format(selectedRangeLow ?? 0)}
                  />
                </div>
              </>
            ) : (
              <div
                data-testid="no-match-message"
                className="flex h-full min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-white/10 bg-slate-950/30 text-slate-400"
              >
                No coins match your search yet.
              </div>
            )}
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Market Snapshot
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  Top Coins
                </h2>
              </div>
              <p className="text-sm text-slate-400">
                {isFetching || isHistoryFetching ? "Updating..." : `${filteredCoins.length} shown`}
              </p>
            </div>

            <div className="grid gap-3" data-testid="coins-list">
              {filteredCoins.map((coin) => (
                <CoinCard
                  key={coin.id}
                  coin={coin}
                  isSelected={coin.id === selectedCoin?.id}
                  onSelect={(nextCoin) => setSelectedCoinId(nextCoin.id)}
                />
              ))}
            </div>
          </aside>
        </div>
      </section>
    </Container>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
};
