import { CryptoDashboard } from "@/features/crypto/components/CryptoDashboard";
import { getCoinsFromCoinCap } from "@/features/crypto/server/getCoinsFromCoinCap";
import { Coin } from "@/features/crypto/types/coin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const DEFAULT_DAYS = "7";
const DEFAULT_SORT = "market-cap-desc";
const DEFAULT_TREND = "all";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    marketUnavailable?: string;
    selectedCoin?: string;
    search?: string;
    days?: string;
    sort?: string;
    favoritesOnly?: string;
    trend?: string;
    mockData?: string;
  }>;
}) {
  const params = await searchParams;
  const hasDashboardState =
    Boolean(params.selectedCoin) ||
    Boolean(params.search) ||
    Boolean(params.days) ||
    Boolean(params.sort) ||
    Boolean(params.trend) ||
    params.favoritesOnly === "1";

  const isMissingCanonicalDefaults =
    hasDashboardState && (!params.days || !params.sort || !params.trend);

  if (isMissingCanonicalDefaults) {
    const canonicalParams = new URLSearchParams();

    if (params.selectedCoin) {
      canonicalParams.set("selectedCoin", params.selectedCoin);
    }

    if (params.search) {
      canonicalParams.set("search", params.search);
    }

    canonicalParams.set("sort", params.sort ?? DEFAULT_SORT);
    canonicalParams.set("trend", params.trend ?? DEFAULT_TREND);
    canonicalParams.set("days", params.days ?? DEFAULT_DAYS);

    if (params.favoritesOnly === "1") {
      canonicalParams.set("favoritesOnly", "1");
    }

    if (params.marketUnavailable === "1") {
      canonicalParams.set("marketUnavailable", "1");
    }

    if (params.mockData === "1") {
      canonicalParams.set("mockData", "1");
    }

    redirect(`/?${canonicalParams.toString()}`);
  }

  const shouldUseMockClientData = params.mockData === "1";
  const initialCoins: Coin[] = shouldUseMockClientData ? [] : await getCoinsFromCoinCap();
  const marketUnavailable = params.marketUnavailable === "1";
  const initialSearch = params.search ?? "";
  const initialSelectedCoinId = params.selectedCoin;
  const initialDays = params.days ? Number(params.days) : undefined;
  const initialSort = params.sort ?? DEFAULT_SORT;
  const initialFavoritesOnly = params.favoritesOnly === "1";
  const initialTrend = params.trend ?? DEFAULT_TREND;

  return (
    <CryptoDashboard
      initialCoins={initialCoins}
      marketUnavailable={marketUnavailable}
      initialSearch={initialSearch}
      initialSelectedCoinId={initialSelectedCoinId}
      initialDays={initialDays}
      initialSort={initialSort}
      initialFavoritesOnly={initialFavoritesOnly}
      initialTrend={initialTrend}
    />
  );
}
