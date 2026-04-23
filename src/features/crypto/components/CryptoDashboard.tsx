"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Container } from "@/components/Container";
import { CoinCard } from "./CoinCard";
import { CoinChart } from "./CoinChart";
import { CoinJournal, type CoinJournalEntry } from "./CoinJournal";
import { PriceAlertForm } from "./PriceAlertForm";
import { SearchBar } from "./SearchBar";
import { useCoinHistory } from "../hooks/useCoinHistory";
import { useCoins } from "../hooks/useCoins";
import { Coin } from "../types/coin";

const DAY_FILTERS = [
  { label: "24H", value: 1 },
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
  { label: "90D", value: 90 },
] as const;

const SORT_OPTIONS = [
  { label: "Market Cap", value: "market-cap-desc" },
  { label: "Best 24H Change", value: "change-desc" },
  { label: "Lowest 24H Change", value: "change-asc" },
  { label: "Highest Price", value: "price-desc" },
  { label: "Lowest Price", value: "price-asc" },
] as const;

const TREND_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Gainers", value: "gainers" },
  { label: "Losers", value: "losers" },
] as const;

const DEFAULT_SORT = "market-cap-desc";
const DEFAULT_TREND = "all";
const DEFAULT_DAYS = 7;
const WATCHLIST_STORAGE_KEY = "dashtestify.watchlist";
const JOURNAL_STORAGE_KEY = "dashtestify.journal";

type SortOption = (typeof SORT_OPTIONS)[number]["value"];
type TrendOption = (typeof TREND_OPTIONS)[number]["value"];
type JournalByCoin = Record<string, CoinJournalEntry[]>;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const safeParseJson = <T,>(value: string | null, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const parseSortOption = (value: string | undefined): SortOption =>
  SORT_OPTIONS.some((option) => option.value === value)
    ? (value as SortOption)
    : DEFAULT_SORT;

const parseTrendOption = (value: string | undefined): TrendOption =>
  TREND_OPTIONS.some((option) => option.value === value)
    ? (value as TrendOption)
    : DEFAULT_TREND;

const sortCoins = (coins: Coin[], sort: SortOption) => {
  const sorted = [...coins];

  sorted.sort((left, right) => {
    switch (sort) {
      case "change-desc":
        return (
          right.price_change_percentage_24h - left.price_change_percentage_24h
        );
      case "change-asc":
        return (
          left.price_change_percentage_24h - right.price_change_percentage_24h
        );
      case "price-desc":
        return right.current_price - left.current_price;
      case "price-asc":
        return left.current_price - right.current_price;
      case "market-cap-desc":
      default:
        return right.market_cap - left.market_cap;
    }
  });

  return sorted;
};

export const CryptoDashboard = ({
  initialCoins,
  marketUnavailable = false,
  initialSearch = "",
  initialSelectedCoinId,
  initialDays = DEFAULT_DAYS,
  initialSort = DEFAULT_SORT,
  initialFavoritesOnly = false,
  initialTrend = DEFAULT_TREND,
}: {
  initialCoins: Coin[];
  marketUnavailable?: boolean;
  initialSearch?: string;
  initialSelectedCoinId?: string;
  initialDays?: number;
  initialSort?: string;
  initialFavoritesOnly?: boolean;
  initialTrend?: string;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: coins = initialCoins, isFetching, error } = useCoins(initialCoins);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCoinId, setSelectedCoinId] = useState(
    initialSelectedCoinId ?? initialCoins[0]?.id ?? ""
  );
  const [days, setDays] = useState(initialDays);
  const [sort, setSort] = useState<SortOption>(parseSortOption(initialSort));
  const [trend, setTrend] = useState<TrendOption>(parseTrendOption(initialTrend));
  const [favoritesOnly, setFavoritesOnly] = useState(initialFavoritesOnly);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [journalByCoin, setJournalByCoin] = useState<JournalByCoin>({});
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);

  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const storedFavoriteIds = safeParseJson<string[]>(
      localStorage.getItem(WATCHLIST_STORAGE_KEY),
      []
    );
    const storedJournal = safeParseJson<JournalByCoin>(
      localStorage.getItem(JOURNAL_STORAGE_KEY),
      {}
    );

    startTransition(() => {
      setFavoriteIds(storedFavoriteIds);
      setJournalByCoin(storedJournal);
      setHasHydratedStorage(true);
    });
  }, []);

  useEffect(() => {
    if (hasHydratedStorage) {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(favoriteIds));
    }
  }, [favoriteIds, hasHydratedStorage]);

  useEffect(() => {
    if (hasHydratedStorage) {
      localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify(journalByCoin));
    }
  }, [journalByCoin, hasHydratedStorage]);

  const filteredCoins = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    const nextCoins = coins.filter((coin) => {
      const matchesSearch =
        !normalizedSearch ||
        coin.name.toLowerCase().includes(normalizedSearch) ||
        coin.symbol.toLowerCase().includes(normalizedSearch);
      const matchesFavorites = !favoritesOnly || favoriteIds.includes(coin.id);
      const matchesTrend =
        trend === "all" ||
        (trend === "gainers" && coin.price_change_percentage_24h >= 0) ||
        (trend === "losers" && coin.price_change_percentage_24h < 0);

      return matchesSearch && matchesFavorites && matchesTrend;
    });

    return sortCoins(nextCoins, sort);
  }, [coins, deferredSearch, favoriteIds, favoritesOnly, sort, trend]);

  const selectedCoin =
    filteredCoins.find((coin) => coin.id === selectedCoinId) ?? filteredCoins[0];

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const normalizedSearch = search.trim();
    const activeSelectedCoinId = selectedCoin?.id ?? selectedCoinId;

    if (normalizedSearch) {
      params.set("search", normalizedSearch);
    } else {
      params.delete("search");
    }

    if (activeSelectedCoinId) {
      params.set("selectedCoin", activeSelectedCoinId);
    } else {
      params.delete("selectedCoin");
    }

    params.set("days", String(days));
    params.set("sort", sort);

    if (favoritesOnly) {
      params.set("favoritesOnly", "1");
    } else {
      params.delete("favoritesOnly");
    }

    params.set("trend", trend);

    const currentQueryString = searchParams?.toString() ?? "";
    const nextQueryString = params.toString();

    if (nextQueryString !== currentQueryString) {
      router.replace(nextQueryString ? `${pathname}?${nextQueryString}` : pathname, {
        scroll: false,
      });
    }
  }, [
    days,
    favoritesOnly,
    pathname,
    router,
    search,
    searchParams,
    selectedCoin,
    selectedCoinId,
    sort,
    trend,
  ]);

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
  const selectedCoinNotes =
    selectedCoin && hasHydratedStorage ? journalByCoin[selectedCoin.id] ?? [] : [];
  const watchlistCount = hasHydratedStorage ? favoriteIds.length : 0;

  const toggleFavorite = (coin: Coin) => {
    setFavoriteIds((current) =>
      current.includes(coin.id)
        ? current.filter((entry) => entry !== coin.id)
        : [...current, coin.id]
    );
  };

  const resetDashboard = () => {
    const resetParams = new URLSearchParams();

    if (searchParams?.get("mockData") === "1") {
      resetParams.set("mockData", "1");
    }

    if (searchParams?.get("marketUnavailable") === "1") {
      resetParams.set("marketUnavailable", "1");
    }

    setSearch("");
    setDays(DEFAULT_DAYS);
    setSort(DEFAULT_SORT);
    setTrend(DEFAULT_TREND);
    setFavoritesOnly(false);
    setSelectedCoinId(coins[0]?.id ?? "");

    const nextUrl = resetParams.toString()
      ? `${pathname}?${resetParams.toString()}`
      : pathname;

    router.replace(nextUrl, { scroll: false });
  };

  const addJournalEntry = (coinId: string, note: string) => {
    setJournalByCoin((current) => {
      const nextEntries = [
        {
          id: crypto.randomUUID(),
          body: note,
          createdAt: new Date().toISOString(),
        },
        ...(current[coinId] ?? []),
      ];

      return {
        ...current,
        [coinId]: nextEntries,
      };
    });
  };

  const deleteJournalEntry = (coinId: string, entryId: string) => {
    setJournalByCoin((current) => {
      const nextEntries = (current[coinId] ?? []).filter((entry) => entry.id !== entryId);

      return {
        ...current,
        [coinId]: nextEntries,
      };
    });
  };

  return (
    <Container>
      <section className="mb-8 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur md:p-8">
        <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.95fr)] xl:items-end">
          <div className="max-w-4xl">
            <p className="mb-3 text-sm uppercase tracking-wider whitespace-nowrap text-cyan-300">
              Crypto Intelligence
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Track prices, manage a watchlist, and simulate investor workflows.
            </h1>
            <p className="mt-4 text-base text-slate-300">
              Search, sort, filter gainers and losers, save favorites, create notes,
              and submit a price alert form that exercises modern Next.js behavior.
            </p>
          </div>

          <div className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4 md:p-5">
            <SearchBar value={search} onChange={setSearch} />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                Sort
                <select
                  data-testid="sort-select"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                Trend
                <select
                  data-testid="trend-select"
                  value={trend}
                  onChange={(event) => setTrend(event.target.value as TrendOption)}
                  className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60"
                >
                  {TREND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="reset-dashboard"
            onClick={resetDashboard}
            className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-300/20"
          >
            Reset dashboard
          </button>

          <button
            type="button"
            data-testid="favorites-filter"
            aria-pressed={favoritesOnly}
            onClick={() => setFavoritesOnly((current) => !current)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              favoritesOnly
                ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                : "border-white/10 bg-slate-900/80 text-slate-300 hover:border-amber-300/30 hover:text-amber-100"
            }`}
          >
            Watchlist only
          </button>

          <StatusPill label="Visible Coins" value={String(filteredCoins.length)} />
          <StatusPill label="Saved" value={String(watchlistCount)} />
          <StatusPill
            label="Query State"
            value={searchParams?.toString() ? "Synced" : "Default"}
          />
        </div>

        {error || marketUnavailable ? (
          <div
            data-testid="market-error-banner"
            className="mb-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100"
          >
            We couldn&apos;t refresh the market feed right now. If CoinCap is
            rate-limiting requests, the dashboard will recover automatically in a
            moment.
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="grid gap-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              {selectedCoin ? (
                <>
                  <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">
                        Selected Asset
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <h2
                          data-testid="selected-asset-name"
                          className="text-3xl font-semibold text-white"
                        >
                          {selectedCoin.name}
                        </h2>
                        <button
                          type="button"
                          data-testid="selected-asset-favorite"
                          aria-pressed={favoriteIds.includes(selectedCoin.id)}
                          onClick={() => toggleFavorite(selectedCoin)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition ${
                            favoriteIds.includes(selectedCoin.id)
                              ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                              : "border-white/10 bg-slate-950/70 text-slate-400 hover:border-amber-300/40 hover:text-amber-100"
                          }`}
                        >
                          {favoriteIds.includes(selectedCoin.id)
                            ? "In Watchlist"
                            : "Save to Watchlist"}
                        </button>
                      </div>
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

                  <div className="mt-6 grid gap-4 md:grid-cols-4">
                    <StatCard
                      label="Market Cap"
                      value={`$${compactFormatter.format(selectedCoin.market_cap)}`}
                    />
                    <StatCard
                      label="24H Volume"
                      value={`$${compactFormatter.format(selectedCoin.total_volume)}`}
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
                  No coins match your current search and filters yet.
                </div>
              )}
            </div>

            {selectedCoin ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <PriceAlertForm
                  coinId={selectedCoin.id}
                  coinName={selectedCoin.name}
                  currentPrice={selectedCoin.current_price}
                />
                <CoinJournal
                  coinId={selectedCoin.id}
                  coinName={selectedCoin.name}
                  entries={selectedCoinNotes}
                  onAddEntry={addJournalEntry}
                  onDeleteEntry={deleteJournalEntry}
                />
              </div>
            ) : null}
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">
                  Market Snapshot
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Top Coins</h2>
              </div>
              <p className="text-sm text-slate-400">
                {isFetching || isHistoryFetching ? "Updating..." : `${filteredCoins.length} shown`}
              </p>
            </div>

            <div className="grid gap-3" data-testid="coins-list">
              {filteredCoins.length > 0 ? (
                filteredCoins.map((coin) => (
                  <CoinCard
                    key={coin.id}
                    coin={coin}
                    isSelected={coin.id === selectedCoin?.id}
                    isFavorite={favoriteIds.includes(coin.id)}
                    onSelect={(nextCoin) => setSelectedCoinId(nextCoin.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                  No assets match the active filters. Try clearing the watchlist
                  filter or switching the trend selector.
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </Container>
  );
};

const StatusPill = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2">
      <p className="text-[10px] uppercase tracking-wider whitespace-nowrap text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wider whitespace-nowrap text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
};
