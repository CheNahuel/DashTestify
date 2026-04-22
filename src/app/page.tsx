import { CryptoDashboard } from "@/features/crypto/components/CryptoDashboard";
import { getCoinsFromCoinCap } from "@/features/crypto/server/getCoinsFromCoinCap";
import { Coin } from "@/features/crypto/types/coin";

export const dynamic = "force-dynamic";

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
  const shouldUseMockClientData = params.mockData === "1";
  const initialCoins: Coin[] = shouldUseMockClientData
    ? []
    : await getCoinsFromCoinCap();
  const marketUnavailable = params.marketUnavailable === "1";
  const initialSearch = params.search ?? "";
  const initialSelectedCoinId = params.selectedCoin;
  const initialDays = params.days ? Number(params.days) : undefined;
  const initialSort = params.sort ?? "market-cap-desc";
  const initialFavoritesOnly = params.favoritesOnly === "1";
  const initialTrend = params.trend ?? "all";

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
