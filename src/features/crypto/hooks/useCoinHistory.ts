import { useQuery } from "@tanstack/react-query";
import { getCoinHistory } from "../api/getCoinHistory";

export const useCoinHistory = (coinId: string | null, days: number, useMock = false) => {
  return useQuery({
    queryKey: ["coin-history", coinId, days, useMock],
    queryFn: () => getCoinHistory(coinId!, days, useMock),
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
