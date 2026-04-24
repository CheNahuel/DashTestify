import { NextRequest, NextResponse } from "next/server";
import { getCoinHistoryFromCoinCap } from "@/features/crypto/server/getCoinHistoryFromCoinCap";

type RouteContext = {
  params: Promise<{
    coinId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { coinId } = await context.params;
  const days = Number(request.nextUrl.searchParams.get("days") ?? "7");

  try {
    const history = await getCoinHistoryFromCoinCap(coinId, days);

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
