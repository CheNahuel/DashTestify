import { useQuery } from "@tanstack/react-query";
import { getCoinHistory } from "../api/getCoinHistory";
import { CoinHistoryRequest } from "../types/coin";

export const useCoinHistory = (
  coinId: string | null,
  request: CoinHistoryRequest,
  useMock = false,
) => {
  return useQuery({
    queryKey: ["coin-history", coinId, request.interval, request.start, request.end, useMock],
    queryFn: () => getCoinHistory(coinId!, request, useMock),
    enabled: Boolean(coinId),
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.toLowerCase().includes("rate limit")) {
        return false;
      }

      return failureCount < 1;
    },
    staleTime: 5 * 60_000,
  });
};
