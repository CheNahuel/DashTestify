import { getSupabaseClient } from "@/lib/supabase";

const supabase = getSupabaseClient();

export async function getCoinBySymbol(symbol: string) {
  const { data, error } = await supabase
    .from("coins")
    .select("*")
    .eq("symbol", symbol.toUpperCase())
    .single();

  if (error) {
    console.error(`Error fetching coin ${symbol}:`, error);
    return null;
  }

  return data;
}

export async function getCoinByCoincapId(coincapId: string) {
  const { data, error } = await supabase
    .from("coins")
    .select("*")
    .eq("coincap_id", coincapId)
    .single();

  if (error) {
    console.error(`Error fetching coin with coincap_id ${coincapId}:`, error);
    return null;
  }

  return data;
}

export async function getCoinById(coinId: string) {
  const { data, error } = await supabase
    .from("coins")
    .select("*")
    .eq("id", coinId)
    .single();

  if (error) {
    console.error(`Error fetching coin ${coinId}:`, error);
    return null;
  }

  return data;
}

export async function getAllCoins() {
  const { data, error } = await supabase
    .from("coins")
    .select("*")
    .order("symbol", { ascending: true });

  if (error) {
    console.error("Error fetching all coins:", error);
    return [];
  }

  return data || [];
}

export async function getPriceDailyForCoin(
  coinId: string,
  startDate: Date,
  endDate: Date
) {
  const { data, error } = await supabase
    .from("price_daily")
    .select("*")
    .eq("coin_id", coinId)
    .gte("date", startDate.toISOString().split("T")[0])
    .lte("date", endDate.toISOString().split("T")[0])
    .order("date", { ascending: true });

  if (error) {
    console.error(`Error fetching price history for ${coinId}:`, error);
    return [];
  }

  return data || [];
}

export async function getLatestPriceDailyForCoin(coinId: string) {
  const { data, error } = await supabase
    .from("price_daily")
    .select("*")
    .eq("coin_id", coinId)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error(`Error fetching latest daily price for ${coinId}:`, error);
    return null;
  }

  return data;
}

export async function getCoinMetrics(coinId: string) {
  const { data, error } = await supabase
    .from("coin_metrics")
    .select("*")
    .eq("coin_id", coinId)
    .single();

  if (error) {
    console.error(`Error fetching metrics for ${coinId}:`, error);
    return null;
  }

  return data;
}

export async function getLatestPriceIntraday(coinId: string) {
  const { data, error } = await supabase
    .from("price_intraday")
    .select("*")
    .eq("coin_id", coinId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error(`Error fetching latest intraday price for ${coinId}:`, error);
    return null;
  }

  return data;
}

export async function getPriceIntradayForCoin(
  coinId: string,
  startTimestamp: Date,
  endTimestamp: Date
) {
  const { data, error } = await supabase
    .from("price_intraday")
    .select("*")
    .eq("coin_id", coinId)
    .gte("timestamp", startTimestamp.toISOString())
    .lte("timestamp", endTimestamp.toISOString())
    .order("timestamp", { ascending: true });

  if (error) {
    console.error(
      `Error fetching intraday price for ${coinId}:`,
      error
    );
    return [];
  }

  return data || [];
}

export async function compareCoinsMetrics(coinIds: string[]) {
  const { data, error } = await supabase
    .from("coin_metrics")
    .select("*")
    .in("coin_id", coinIds)
    .order("current_price", { ascending: false });

  if (error) {
    console.error("Error comparing coins:", error);
    return [];
  }

  return data || [];
}

export async function getTopMoversByCoin(
  limit: number = 10,
  sortBy: "ytd_return" | "return_1m" | "return_3m" | "return_6m" | "return_1y" = "ytd_return"
) {
  const { data, error } = await supabase
    .from("coin_metrics")
    .select("*")
    .order(sortBy, { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching top movers:", error);
    return [];
  }

  return data || [];
}
