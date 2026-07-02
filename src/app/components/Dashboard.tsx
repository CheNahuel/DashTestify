"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Container } from "@/components/Container";
import { CoinChart } from "@/features/crypto/components/CoinChart";
import { CoinJournal, type CoinJournalEntry } from "@/features/crypto/components/CoinJournal";
import { useCoinHistory } from "@/features/crypto/hooks/useCoinHistory";
import { useCoins } from "@/features/crypto/hooks/useCoins";
import {
  Coin,
  DEFAULT_TIMEFRAME,
  getHistoryRequestForTimeframe,
  Timeframe,
  TIMEFRAMES,
} from "@/features/crypto/types/coin";
import { Search } from "./Search";
import { TopCoins } from "./TopCoins";

const TIMEFRAME_FILTERS = TIMEFRAMES.map((timeframe) => ({
  label: timeframe,
  value: timeframe,
}));

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

const PriceAlertFormLoading = () => (
  <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 sm:p-5 lg:max-h-[725px] lg:overflow-y-auto min-w-0">
    <div className="mb-4">
      <p className="text-xs sm:text-sm uppercase tracking-wider whitespace-nowrap text-slate-400">
        Price Alert
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-slate-700 animate-pulse" />
        <div className="h-6 bg-slate-700 rounded animate-pulse w-48 max-w-full" />
      </div>
    </div>
    <div className="animate-pulse">
      <div className="h-4 bg-slate-700 rounded mb-4 w-32" />
      <div className="h-10 bg-slate-700 rounded mb-4" />
      <div className="h-10 bg-slate-700 rounded mb-4" />
      <div className="h-10 bg-slate-700 rounded w-24 ml-auto" />
    </div>
  </div>
);

const PriceAlertFormClient = dynamic(
  () => import("@/features/crypto/components/PriceAlertForm").then((mod) => ({ default: mod.PriceAlertForm })),
  {
    ssr: false,
    loading: () => <PriceAlertFormLoading />,
  },
);

export const Dashboard = ({
  initialCoins = [],
  marketUnavailable = false,
  initialSearch = "",
  initialSelectedCoinId,
  initialTimeframe = DEFAULT_TIMEFRAME,
  initialSort = DEFAULT_SORT,
  initialFavoritesOnly = false,
  initialTrend = DEFAULT_TREND,
  useMock = false,
  isLiveAvailable = false,
}: {
  initialCoins?: Coin[];
  marketUnavailable?: boolean;
  initialSearch?: string;
  initialSelectedCoinId?: string;
  initialTimeframe?: Timeframe;
  initialSort?: string;
  initialFavoritesOnly?: boolean;
  initialTrend?: string;
  useMock?: boolean;
  isLiveAvailable?: boolean;
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: coins = initialCoins, isFetching, error } = useCoins(initialCoins, useMock);
  const [selectedCoinId, setSelectedCoinId] = useState<string | null>(
    initialSelectedCoinId ?? null,
  );
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [showDropdown, setShowDropdown] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [sort, setSort] = useState<SortOption>(parseSortOption(initialSort));
  const [trend, setTrend] = useState<TrendOption>(parseTrendOption(initialTrend));
  const [favoritesOnly, setFavoritesOnly] = useState(initialFavoritesOnly);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [journalByCoin, setJournalByCoin] = useState<JournalByCoin>({});
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);

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

  const visibleCoins = useMemo(() => {
    const nextCoins = coins.filter((coin) => {
      const matchesFavorites = !favoritesOnly || favoriteIds.includes(coin.id);
      const matchesTrend =
        trend === "all" ||
        (trend === "gainers" && coin.price_change_percentage_24h >= 0) ||
        (trend === "losers" && coin.price_change_percentage_24h < 0);

      return matchesFavorites && matchesTrend;
    });

    return sortCoins(nextCoins, sort);
  }, [coins, favoriteIds, favoritesOnly, sort, trend]);

  const filteredCoins = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    if (!normalizedSearch) {
      return visibleCoins;
    }

    return visibleCoins.filter(
      (coin) =>
        coin.name.toLowerCase().includes(normalizedSearch) ||
        coin.symbol.toLowerCase().includes(normalizedSearch),
    );
  }, [searchQuery, visibleCoins]);

  const selectedCoin = useMemo(
    () => coins.find((coin) => coin.id === selectedCoinId) ?? null,
    [coins, selectedCoinId],
  );

  const historyRequest = useMemo(() => getHistoryRequestForTimeframe(timeframe), [timeframe]);

  const selectedCoinNotes =
    selectedCoin && hasHydratedStorage ? (journalByCoin[selectedCoin.id] ?? []) : [];
  const watchlistCount = hasHydratedStorage ? favoriteIds.length : 0;
  const selectedTimeframeLabel =
    TIMEFRAME_FILTERS.find((filter) => filter.value === timeframe)?.label ?? timeframe;

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    const normalizedSearch = searchQuery.trim();

    if (normalizedSearch) {
      params.set("search", normalizedSearch);
    } else {
      params.delete("search");
    }

    if (selectedCoinId) {
      params.set("selectedCoin", selectedCoinId);
    } else {
      params.delete("selectedCoin");
    }

    params.set("timeframe", timeframe);
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
    favoritesOnly,
    pathname,
    router,
    searchQuery,
    searchParams,
    sort,
    timeframe,
    trend,
    selectedCoinId,
  ]);

  const handleSelectCoin = (coin: Coin) => {
    setSelectedCoinId(coin.id);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleClearSelection = () => {
    setSelectedCoinId(null);
    setSearchQuery("");
    setShowDropdown(false);
  };

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

    setSearchQuery("");
    setShowDropdown(false);
    setSelectedCoinId(null);
    setTimeframe(DEFAULT_TIMEFRAME);
    setSort(DEFAULT_SORT);
    setTrend(DEFAULT_TREND);
    setFavoritesOnly(false);

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
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur sm:mb-8 sm:rounded-[2rem] sm:p-6 lg:p-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1 md:max-w-3xl xl:max-w-5xl">
            <p className="mb-3 text-xs uppercase tracking-wider text-cyan-300 sm:text-sm">
              Crypto Intelligence
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl xl:text-5xl">
              Track the crypto market with real-time insights.
            </h1>
            <p className="mt-3 text-sm text-slate-300 sm:text-base">
              <span className="block">
                Monitor real-time prices, filter top movers, manage your watchlist, and set price
                alerts.
              </span>
              <span className="block">All in one streamlined dashboard.</span>
            </p>
          </div>

          <div className="flex w-full gap-2 md:w-auto md:flex-col">
            <button
              type="button"
              data-testid="metrics-button"
              onClick={() => router.push("/quality-analytics")}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-purple-300 transition hover:border-purple-500/60 hover:bg-purple-500/20 md:px-5 md:py-3 md:text-[13px]"
            >
              Metrics
            </button>

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
              className={`flex-1 md:flex-none inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-bold uppercase tracking-widest transition md:px-5 md:py-3 md:text-[13px] ${
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
          </div>
        </div>

        <div className="mb-6 grid min-w-0 gap-4 sm:gap-6 xl:grid-cols-[1.35fr_0.95fr] xl:items-start">
          <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-3 sm:gap-4 sm:rounded-[1.75rem] sm:p-4 md:p-5 min-w-0">
            <Search
              selectedCoin={selectedCoin}
              searchQuery={searchQuery}
              filteredCoins={filteredCoins}
              showDropdown={showDropdown}
              onSearchQueryChange={setSearchQuery}
              onShowDropdownChange={setShowDropdown}
              onSelectCoin={handleSelectCoin}
              onClearSelection={handleClearSelection}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm text-slate-300">
                Sort
                <select
                  data-testid="sort-select"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as SortOption)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 sm:px-4"
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
                  className={`w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm outline-none transition sm:px-4 ${favoritesOnly ? "cursor-not-allowed text-slate-500 opacity-50" : "text-white focus:border-cyan-300/60"}`}
                >
                  {TREND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
              <button
                type="button"
                data-testid="reset-dashboard"
                onClick={resetDashboard}
                className="min-h-11 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-3 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/60 hover:bg-cyan-300/20 sm:px-4 sm:text-sm"
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
                className={`min-h-11 rounded-full border px-3 py-3 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                  favoritesOnly
                    ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                    : "border-white/10 bg-slate-900/80 text-slate-300 hover:border-amber-300/30 hover:text-amber-100"
                }`}
              >
                Watchlist only
              </button>

              <StatusPill
                label="Visible Coins"
                value={String(visibleCoins.length)}
                testId="status-pill-visible-coins"
              />
              <StatusPill
                label="Watchlist"
                value={String(watchlistCount)}
                testId="status-pill-watchlist"
              />
            </div>
          </div>

          <div className="flex h-full min-w-0 flex-col justify-center rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-3 sm:rounded-[1.75rem] sm:p-4 md:p-5">
            <p className="mb-3 text-xs uppercase tracking-wider text-slate-400 sm:mb-4 sm:text-sm">
              Time Range
            </p>
            <div className="flex h-full flex-col gap-2 sm:gap-3">
              <div className="grid h-full grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
                {TIMEFRAME_FILTERS.map((filter) => (
                  <RangeButton
                    key={filter.value}
                    filter={filter}
                    active={timeframe === filter.value}
                    onClick={setTimeframe}
                  />
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

        {selectedCoin ? (
          <MainDashboard
            coin={selectedCoin}
            historyRequest={historyRequest}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            selectedCoinNotes={selectedCoinNotes}
            useMock={useMock}
            selectedTimeframeLabel={selectedTimeframeLabel}
            onAddJournalEntry={addJournalEntry}
            onDeleteJournalEntry={deleteJournalEntry}
          />
        ) : (
          <TopCoins
            coins={visibleCoins}
            favoriteIds={favoriteIds}
            onSelectCoin={handleSelectCoin}
            onToggleFavorite={toggleFavorite}
            historyRequest={historyRequest}
            useMock={useMock}
            isFetching={isFetching}
          />
        )}
      </section>
    </Container>
  );
};

const MainDashboard = ({
  coin,
  historyRequest,
  favoriteIds,
  onToggleFavorite,
  selectedCoinNotes,
  useMock,
  selectedTimeframeLabel,
  onAddJournalEntry,
  onDeleteJournalEntry,
}: {
  coin: Coin;
  historyRequest: ReturnType<typeof getHistoryRequestForTimeframe>;
  favoriteIds: string[];
  onToggleFavorite: (coin: Coin) => void;
  selectedCoinNotes: CoinJournalEntry[];
  useMock: boolean;
  selectedTimeframeLabel: string;
  onAddJournalEntry: (coinId: string, note: string) => void;
  onDeleteJournalEntry: (coinId: string, entryId: string) => void;
}) => {
  const { data: history, isLoading: isHistoryLoading, error } =
    useCoinHistory(coin.id, historyRequest, useMock);

  const historyPrices = history?.prices.map(([, price]) => price) ?? [];
  const selectedRangeHigh = historyPrices.length > 0 ? Math.max(...historyPrices) : coin.current_price;
  const selectedRangeLow = historyPrices.length > 0 ? Math.min(...historyPrices) : coin.current_price;
  const selectedRangeChange =
    historyPrices.length > 0
      ? ((coin.current_price - historyPrices[0]) / historyPrices[0]) * 100
      : coin.price_change_percentage_24h;

  return (
    <div data-testid="main-dashboard" className="grid min-w-0 gap-4 sm:gap-6">
      <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/60 p-3 sm:rounded-3xl sm:p-4 md:p-5 xl:max-h-[1400px] xl:overflow-y-auto">
        <div className="mb-4 flex flex-col gap-3 border-b border-white/10 pb-4 sm:mb-6 sm:gap-4 sm:pb-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider whitespace-nowrap text-slate-400 sm:text-sm">
              Selected Asset
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
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
                <h2
                  data-testid="selected-asset-name"
                  className="truncate text-xl font-semibold text-white sm:text-2xl md:text-3xl min-w-0"
                >
                  {coin.name}
                </h2>
              </div>
              <button
                type="button"
                data-testid="selected-asset-favorite"
                aria-pressed={favoriteIds.includes(coin.id)}
                onClick={() => onToggleFavorite(coin)}
                className={`min-h-11 rounded-full border px-3 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition ${
                  favoriteIds.includes(coin.id)
                    ? "border-amber-300/50 bg-amber-300/15 text-amber-100"
                    : "border-white/10 bg-slate-950/70 text-slate-400 hover:border-amber-300/40 hover:text-amber-100"
                }`}
              >
                {favoriteIds.includes(coin.id) ? "In Watchlist" : "Save to Watchlist"}
              </button>
            </div>
            <p
              data-testid="selected-asset-price"
              className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-slate-300"
            >
              <span>{currencyFormatter.format(coin.current_price)}</span>
              <span
                data-testid="selected-asset-change"
                className={`text-sm font-semibold ${
                  selectedRangeChange >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {selectedRangeChange >= 0 ? "+" : ""}
                {selectedRangeChange.toFixed(2)}% in {selectedTimeframeLabel}
              </span>
            </p>
          </div>
        </div>

        {error ? (
          <div className="flex h-[200px] items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 text-center text-sm text-rose-100 sm:h-[240px] sm:rounded-3xl md:h-[260px]">
            {error instanceof Error ? error.message : "We couldn&apos;t load historical data for this coin."}
          </div>
        ) : isHistoryLoading ? (
          <div className="flex h-[200px] items-center justify-center rounded-2xl border border-white/10 bg-slate-950/40 text-sm text-slate-400 sm:h-[240px] sm:rounded-3xl md:h-[260px]">
            Loading chart data...
          </div>
        ) : (
          <div data-testid="selected-coin-chart" className="w-full min-w-0 overflow-hidden">
            <CoinChart data={history} />
          </div>
        )}

        <div
          data-testid="stat-cards"
          className="mt-4 grid min-w-0 grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-4"
        >
          <StatCard label="Market Cap" value={`$${compactFormatter.format(coin.market_cap)}`} />
          <StatCard label="24H Volume" value={`$${compactFormatter.format(coin.total_volume)}`} />
          <StatCard label="Range High" value={currencyFormatter.format(selectedRangeHigh ?? 0)} />
          <StatCard label="Range Low" value={currencyFormatter.format(selectedRangeLow ?? 0)} />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-2">
        <PriceAlertFormClient
          coinId={coin.id}
          coinName={coin.name}
          coinImage={coin.image}
          currentPrice={coin.current_price}
        />
        <CoinJournal
          coinId={coin.id}
          coinName={coin.name}
          coinImage={coin.image}
          entries={selectedCoinNotes}
          onAddEntry={onAddJournalEntry}
          onDeleteEntry={onDeleteJournalEntry}
        />
      </div>
    </div>
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
      className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-2 sm:px-4"
      data-testid={testId}
    >
      <p className="text-center text-[10px] uppercase tracking-wider whitespace-nowrap text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-center text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
};

const RangeButton = ({
  filter,
  active,
  onClick,
}: {
  filter: { label: string; value: Timeframe };
  active: boolean;
  onClick: (value: Timeframe) => void;
}) => (
  <button
    type="button"
    data-testid={`range-button-${filter.value}`}
    aria-pressed={active}
    onClick={() => onClick(filter.value)}
    className={`w-full rounded-full py-3 text-sm font-semibold transition sm:py-4 sm:text-base ${
      active ? "bg-cyan-300 text-slate-950" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
    }`}
  >
    {filter.label}
  </button>
);

const StatCard = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-3 sm:rounded-3xl sm:p-4">
      <p className="text-center text-[10px] uppercase tracking-wider text-slate-400 sm:text-xs">
        {label}
      </p>
      <p className="mt-1 break-words text-center text-sm font-semibold text-slate-300 sm:text-base md:text-lg">
        {value}
      </p>
    </div>
  );
};
