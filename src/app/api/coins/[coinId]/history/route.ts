import { NextRequest, NextResponse } from "next/server";
import { getCoinHistoryFromCoinCap } from "@/features/crypto/server/getCoinHistoryFromCoinCap";
import { getMockCoinHistory } from "@/features/crypto/server/mockCryptoData";
import { isCoinCapHistoryInterval } from "@/features/crypto/types/coin";

type RouteContext = {
  params: Promise<{
    coinId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { coinId } = await context.params;
  const requestedInterval = request.nextUrl.searchParams.get("interval");
  const interval = isCoinCapHistoryInterval(requestedInterval) ? requestedInterval : "h1";
  const useMock = request.nextUrl.searchParams.get("mock") === "1";

  try {
    const history = useMock
      ? getMockCoinHistory(coinId, interval)
      : await getCoinHistoryFromCoinCap(coinId, interval);

    return NextResponse.json(history);
  } catch (error: unknown) {
    const status =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof error.response === "object" &&
      error.response !== null &&
      "status" in error.response &&
      typeof error.response.status === "number"
        ? error.response.status
        : 500;

    return NextResponse.json(
      {
        message:
          status === 429
            ? "CoinCap rate limit reached before fresh historical data could be fetched. Please wait a moment and try again."
            : "Unable to load historical data.",
      },
      { status },
    );
  }
}
