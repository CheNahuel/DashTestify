import { Coin } from "../types/coin";
import { useQuery } from "@tanstack/react-query";
import { getCoins } from "../api/getCoins";

export const useCoins = (initialData?: Coin[]) => {
  return useQuery({
    queryKey: ["coins"],
    queryFn: getCoins,
    initialData,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes("429")) {
        return false;
      }

      return failureCount < 1;
    },
  });
};
