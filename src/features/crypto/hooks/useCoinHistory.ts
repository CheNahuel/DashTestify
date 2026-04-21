import { useQuery } from "@tanstack/react-query";
import { getCoinHistory } from "../api/getCoinHistory";

export const useCoinHistory = (coinId: string | null, days: number) => {
  return useQuery({
    queryKey: ["coin-history", coinId, days],
    queryFn: () => getCoinHistory(coinId!, days),
    enabled: Boolean(coinId),
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("rate limit")
      ) {
        return false;
      }

      return failureCount < 1;
    },
    staleTime: 5 * 60_000,
  });
};
