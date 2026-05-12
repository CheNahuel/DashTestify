import { useQuery } from "@tanstack/react-query";
import { getCoinHistory } from "../api/getCoinHistory";
import { CoinCapHistoryInterval } from "../types/coin";

export const useCoinHistory = (
  coinId: string | null,
  interval: CoinCapHistoryInterval,
  useMock = false,
) => {
  return useQuery({
    queryKey: ["coin-history", coinId, interval, useMock],
    queryFn: () => getCoinHistory(coinId!, interval, useMock),
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
