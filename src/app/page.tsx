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
  }>;
}) {
  const params = await searchParams;
  const initialCoins: Coin[] = await getCoinsFromCoinCap();
  const marketUnavailable = params.marketUnavailable === "1";
  const initialSearch = params.search ?? "";
  const initialSelectedCoinId = params.selectedCoin;
  const initialDays = params.days ? Number(params.days) : undefined;

  return (
    <CryptoDashboard
      initialCoins={initialCoins}
      marketUnavailable={marketUnavailable}
      initialSearch={initialSearch}
      initialSelectedCoinId={initialSelectedCoinId}
      initialDays={initialDays}
    />
  );
}
