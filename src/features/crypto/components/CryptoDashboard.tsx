"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Container } from "@/components/Container";
import { CoinCard } from "./CoinCard";
import { CoinChart } from "./CoinChart";
import { CoinJournal, type CoinJournalEntry } from "./CoinJournal";
import { SearchBar } from "./SearchBar";
import { useCoinHistory } from "../hooks/useCoinHistory";
import { useCoins } from "../hooks/useCoins";
import { Coin } from "../types/coin";

const PriceAlertForm = dynamic(
  () => import("./PriceAlertForm").then((mod) => ({ default: mod.PriceAlertForm })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 max-h-[725px] overflow-y-auto">
        <div className="mb-4">
          <p className="text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">
            Price Alert
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-slate-700 animate-pulse" />
            <div className="h-6 bg-slate-700 rounded animate-pulse w-48" />
          </div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-slate-700 rounded mb-4 w-32" />
          <div className="h-10 bg-slate-700 rounded mb-4" />
          <div className="h-10 bg-slate-700 rounded mb-4" />
          <div className="h-10 bg-slate-700 rounded w-24 ml-auto" />
        </div>
      </div>
    ),
  },
);

const DAY_FILTERS = [
  { label: "1H", value: 0.0417 },
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
  SORT_OPTIONS.some((option) => option.value === value) ? (value as SortOption) : DEFAULT_SORT;

const parseTrendOption = (value: string | undefined): TrendOption =>
  TREND_OPTIONS.some((option) => option.value === value) ? (value as TrendOption) : DEFAULT_TREND;

const sortCoins = (coins: Coin[], sort: SortOption) => {
  const sorted = [...coins];

  sorted.sort((left, right) => {
    switch (sort) {
      case "change-desc":
        return right.price_change_percentage_24h - left.price_change_percentage_24h;
      case "change-asc":
        return left.price_change_percentage_24h - right.price_change_percentage_24h;
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
  isLiveAvailable = false,
}: {
  initialCoins: Coin[];
  marketUnavailable?: boolean;
  initialSearch?: string;
  initialSelectedCoinId?: string;
  initialDays?: number;
  initialSort?: string;
  initialFavoritesOnly?: boolean;
  initialTrend?: string;
  isLiveAvailable?: boolean;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const useMock = !isLiveAvailable || searchParams?.get("mockData") === "1";

  const { data: coins = initialCoins, isFetching, error } = useCoins(initialCoins, useMock);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCoinId, setSelectedCoinId] = useState(
    initialSelectedCoinId ?? initialCoins[0]?.id ?? "",
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
      [],
    );
    const storedJournal = safeParseJson<JournalByCoin>(
      localStorage.getItem(JOURNAL_STORAGE_KEY),
      {},
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

  // Reset selectedCoinId if it doesn't exist in available coins
  useEffect(() => {
    if (coins.length > 0 && selectedCoinId && !coins.find((coin) => coin.id === selectedCoinId)) {
      startTransition(() => {
        setSelectedCoinId(coins[0]?.id ?? "");
      });
    }
  }, [coins, selectedCoinId]);

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

  const selectedCoin = filteredCoins.find((coin) => coin.id === selectedCoinId) ?? filteredCoins[0];

  // Show loading state when no coins are available yet
  const isLoading = coins.length === 0 && isFetching;

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
  } = useCoinHistory(selectedCoin?.id ?? null, days, useMock);

  const historyPrices = history?.prices.map(([, price]) => price) ?? [];
  const selectedRangeHigh =
    historyPrices.length > 0 ? Math.max(...historyPrices) : selectedCoin?.current_price;
  const selectedRangeLow =
    historyPrices.length > 0 ? Math.min(...historyPrices) : selectedCoin?.current_price;

  // Calculate price change for selected range
  const selectedRangeChange =
    historyPrices.length > 0
      ? ((selectedCoin?.current_price - historyPrices[0]) / historyPrices[0]) * 100
      : selectedCoin?.price_change_percentage_24h;

  // Get the label for the selected days (e.g., "24H", "7D", etc.)
  const selectedDaysLabel = DAY_FILTERS.find((f) => f.value === days)?.label ?? `${days}d`;

  const selectedCoinNotes =
    selectedCoin && hasHydratedStorage ? (journalByCoin[selectedCoin.id] ?? []) : [];
  const watchlistCount = hasHydratedStorage ? favoriteIds.length : 0;

  const toggleFavorite = (coin: Coin) => {
    setFavoriteIds((current) =>
      current.includes(coin.id)
        ? current.filter((entry) => entry !== coin.id)
        : [...current, coin.id],
    );
  };

  const resetDashboard = () => {
    const resetParams = new URLSearchParams();

    if (useMock) {
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

    const nextUrl = resetParams.toString() ? `${pathname}?${resetParams.toString()}` : pathname;

    router.replace(nextUrl, { scroll: false });
  };

  const toggleDataSource = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");

    if (useMock) {
      params.delete("mockData");
    } else {
      params.set("mockData", "1");
    }

    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false,
    });
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
      <section className="relative mb-8 rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur md:p-8">
        <button
          type="button"
          data-testid="data-source-toggle"
          aria-pressed={useMock}
          onClick={isLiveAvailable ? toggleDataSource : undefined}
          disabled={!isLiveAvailable}
          title={
            !isLiveAvailable
              ? "Set COINCAP_API_KEY to enable live data"
              : useMock
                ? "Switch to live data"
                : "Switch to mock data"
          }
          className={`absolute top-5 right-5 md:top-7 md:right-7 flex items-center gap-2 rounded-full border px-5 py-3 text-[13px] font-bold uppercase tracking-widest transition ${
            !isLiveAvailable
              ? "border-slate-700/40 bg-slate-900/60 text-slate-600 cursor-not-allowed"
              : useMock
                ? "border-slate-600/40 bg-slate-800/60 text-slate-400 hover:border-slate-500/60 hover:text-slate-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          }`}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {!useMock && isLiveAvailable && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                !useMock && isLiveAvailable ? "bg-emerald-400" : "bg-slate-600"
              }`}
            />
          </span>
          {useMock ? "Mock" : "Live"}
        </button>

        <div className="max-w-5xl mb-6">
          <p className="mb-5 text-sm uppercase tracking-wider whitespace-nowrap text-cyan-300">
            Crypto Intelligence
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
            Track the crypto market with real-time insights.
          </h1>
          <p className="mt-4 text-base text-slate-300">
            <span className="block">
              Monitor real-time prices, filter top movers, manage your watchlist, and set price
              alerts.
            </span>
            <span className="block">All in one streamlined dashboard.</span>
          </p>
        </div>

        <div className="mb-6 grid gap-6 xl:grid-cols-[1.35fr_0.95fr] xl:items-start">
          <div className="grid gap-4 rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4 md:p-5">
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

              <label className={`grid gap-2 text-sm ${favoritesOnly ? "text-slate-500" : "text-slate-300"}`}>
                Trend
                <select
                  data-testid="trend-select"
                  value={trend}
                  onChange={(event) => setTrend(event.target.value as TrendOption)}
                  disabled={favoritesOnly}
                  className={`rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm outline-none transition ${favoritesOnly ? "cursor-not-allowed text-slate-500 opacity-50" : "text-white focus:border-cyan-300/60"}`}
                >
                  {TREND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
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
                onClick={() => {
                  const next = !favoritesOnly;
                  setFavoritesOnly(next);
                  if (next) setTrend("all");
                }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  favoritesOnly
                    ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                    : "border-white/10 bg-slate-900/80 text-slate-300 hover:border-amber-300/30 hover:text-amber-100"
                }`}
              >
                Watchlist only
              </button>

              <StatusPill
                label="Visible Coins"
                value={String(filteredCoins.length)}
                testId="status-pill-visible-coins"
              />
              <StatusPill
                label="Watchlist"
                value={String(watchlistCount)}
                testId="status-pill-watchlist"
              />
            </div>
          </div>

          <div className="flex h-full flex-col justify-center rounded-[1.75rem] border border-white/10 bg-slate-950/45 p-4 md:p-5">
            <p className="mb-4 text-center text-sm uppercase tracking-wider text-slate-400">Time Range</p>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                {DAY_FILTERS.slice(0, 2).map((filter) => (
                  <RangeButton key={filter.value} filter={filter} active={days === filter.value} onClick={setDays} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {DAY_FILTERS.slice(2).map((filter) => (
                  <RangeButton key={filter.value} filter={filter} active={days === filter.value} onClick={setDays} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {error || marketUnavailable ? (
          <div
            data-testid="market-error-banner"
            className="mb-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100"
          >
            We couldn&apos;t refresh the market feed right now. If CoinCap is rate-limiting
            requests, the dashboard will recover automatically in a moment.
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <div className="grid gap-6">
            <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">
                        Selected Asset
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-700" />
                          <div className="h-8 bg-slate-700 rounded w-32" />
                        </div>
                        <div className="h-8 bg-slate-700 rounded w-24" />
                      </div>
                      <div className="mt-2 h-6 bg-slate-700 rounded w-48" />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div className="h-20 bg-slate-700 rounded" />
                    <div className="h-20 bg-slate-700 rounded" />
                    <div className="h-20 bg-slate-700 rounded" />
                    <div className="h-20 bg-slate-700 rounded" />
                  </div>
                </div>
              ) : selectedCoin ? (
                <>
                  <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">
                        Selected Asset
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3">
                          <Image
                            src={
                              selectedCoin.image ||
                              `data:image/svg+xml;base64,${btoa(`<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="18" fill="#64748b"/><text x="20" y="25" text-anchor="middle" font-family="Arial" font-size="12" fill="white">${selectedCoin.symbol.slice(0, 2).toUpperCase()}</text></svg>`)}`
                            }
                            alt={selectedCoin.name}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full"
                          />
                          <h2
                            data-testid="selected-asset-name"
                            className="text-3xl font-semibold text-white"
                          >
                            {selectedCoin.name}
                          </h2>
                        </div>
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
                            selectedRangeChange >= 0 ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          {selectedRangeChange >= 0 ? "+" : ""}
                          {selectedRangeChange.toFixed(2)}% in {selectedDaysLabel}
                        </span>
                      </p>
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

                  <div data-testid="stat-cards" className="mt-6 grid gap-4 md:grid-cols-4">
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

            {selectedCoin && !isLoading ? (
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <PriceAlertForm
                  coinId={selectedCoin.id}
                  coinName={selectedCoin.name}
                  coinImage={selectedCoin.image}
                  currentPrice={selectedCoin.current_price}
                />
                <CoinJournal
                  coinId={selectedCoin.id}
                  coinName={selectedCoin.name}
                  coinImage={selectedCoin.image}
                  entries={selectedCoinNotes}
                  onAddEntry={addJournalEntry}
                  onDeleteEntry={deleteJournalEntry}
                />
              </div>
            ) : null}
          </div>

          <aside className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 max-h-[1400px] overflow-y-auto">
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
                    days={days}
                    useMock={useMock}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-4 text-sm text-slate-400">
                  No assets match the active filters. Try clearing the watchlist filter or switching
                  the trend selector.
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </Container>
  );
};

const StatusPill = ({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) => {
  return (
    <div
      className="rounded-full border border-white/10 bg-slate-900/80 px-4 py-2"
      data-testid={testId}
    >
      <p className="text-[10px] uppercase tracking-wider whitespace-nowrap text-slate-500 text-center">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-100 text-center">{value}</p>
    </div>
  );
};

const RangeButton = ({
  filter,
  active,
  onClick,
}: {
  filter: { label: string; value: number };
  active: boolean;
  onClick: (value: number) => void;
}) => (
  <button
    type="button"
    data-testid={`range-button-${filter.value}`}
    aria-pressed={active}
    onClick={() => onClick(filter.value)}
    className={`w-full rounded-full py-4 text-base font-semibold transition ${
      active ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
    }`}
  >
    {filter.label}
  </button>
);

const StatCard = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wider whitespace-nowrap text-slate-400 text-center">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-300 text-center">{value}</p>
    </div>
  );
};
