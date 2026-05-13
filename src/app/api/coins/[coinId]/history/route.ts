import { NextRequest, NextResponse } from "next/server";
import { getCoinHistoryFromCoinCap } from "@/features/crypto/server/getCoinHistoryFromCoinCap";
import { getMockCoinHistory } from "@/features/crypto/server/mockCryptoData";
import {
  getHistoryRequestForTimeframe,
  isCoinCapHistoryInterval,
} from "@/features/crypto/types/coin";

type RouteContext = {
  params: Promise<{
    coinId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { coinId } = await context.params;
  const requestedInterval = request.nextUrl.searchParams.get("interval");
  const fallbackRequest = getHistoryRequestForTimeframe("7D");
  const interval = isCoinCapHistoryInterval(requestedInterval)
    ? requestedInterval
    : fallbackRequest.interval;
  const requestedStart = Number(request.nextUrl.searchParams.get("start"));
  const requestedEnd = Number(request.nextUrl.searchParams.get("end"));
  const hasValidRange =
    Number.isFinite(requestedStart) &&
    Number.isFinite(requestedEnd) &&
    requestedEnd > requestedStart;
  const historyRequest = {
    interval,
    start: hasValidRange ? requestedStart : fallbackRequest.start,
    end: hasValidRange ? requestedEnd : fallbackRequest.end,
  };
  const useMock = request.nextUrl.searchParams.get("mock") === "1";

  try {
    const history = useMock
      ? getMockCoinHistory(coinId, historyRequest)
      : await getCoinHistoryFromCoinCap(coinId, historyRequest);

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
