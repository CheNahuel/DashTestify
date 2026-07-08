import { NextRequest, NextResponse } from "next/server";
import { getCoinsFromCoinCap } from "@/features/crypto/server/getCoinsFromCoinCap";
import { getMockCoins } from "@/features/crypto/server/mockCryptoData";

export async function GET(request: NextRequest) {
  try {
    const useMock = request.nextUrl.searchParams.get("mock") === "1";
    const coins = useMock ? getMockCoins() : await getCoinsFromCoinCap();

    const response = NextResponse.json(coins);

    // Cache for 5 minutes (300 seconds) - matches our CoinCap TTL
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );

    return response;
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
            ? "CoinCap rate limit reached. Please wait a moment and try again."
            : "Unable to load market data.",
      },
      { status },
    );
  }
}
