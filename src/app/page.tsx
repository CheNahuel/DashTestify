import { CryptoDashboard } from "@/features/crypto/components/CryptoDashboard";
import { getCoinsFromCoinCap } from "@/features/crypto/server/getCoinsFromCoinCap";
import { Coin } from "@/features/crypto/types/coin";

export const dynamic = "force-dynamic";

export default async function Home() {
  const initialCoins: Coin[] = await getCoinsFromCoinCap();

  return (
    <CryptoDashboard
      initialCoins={initialCoins}
      marketUnavailable={false}
    />
  );
}
