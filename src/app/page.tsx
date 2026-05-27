import { Dashboard } from "@/app/components/Dashboard";
import { DEFAULT_TIMEFRAME, isTimeframe } from "@/features/crypto/types/coin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const DEFAULT_SORT = "market-cap-desc";
const DEFAULT_TREND = "all";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    marketUnavailable?: string;
    selectedCoin?: string;
    search?: string;
    timeframe?: string;
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
    Boolean(params.timeframe) ||
    Boolean(params.sort) ||
    Boolean(params.trend) ||
    params.favoritesOnly === "1";

  const isMissingCanonicalDefaults =
    hasDashboardState && (!params.timeframe || !params.sort || !params.trend);

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
    canonicalParams.set("timeframe", params.timeframe ?? DEFAULT_TIMEFRAME);

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

  const isLiveAvailable = Boolean(process.env.COINCAP_API_KEY);
  const useMock = params.mockData === "1" || !isLiveAvailable;

  return (
    <Dashboard
      initialCoins={[]}
      marketUnavailable={params.marketUnavailable === "1"}
      initialSearch={params.search ?? ""}
      initialSelectedCoinId={params.selectedCoin}
      initialTimeframe={isTimeframe(params.timeframe) ? params.timeframe : undefined}
      initialSort={params.sort ?? DEFAULT_SORT}
      initialFavoritesOnly={params.favoritesOnly === "1"}
      initialTrend={params.trend ?? DEFAULT_TREND}
      useMock={useMock}
      isLiveAvailable={isLiveAvailable}
    />
  );
}
