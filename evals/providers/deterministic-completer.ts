export type CompleterAsset = {
  symbol: string;
  name: string;
  priceUsd: string;
  previousPriceUsd?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parseAssets(context: Record<string, unknown>): CompleterAsset[] {
  if (!Array.isArray(context.assets)) {
    return [];
  }

  const assets: CompleterAsset[] = [];
  for (const item of context.assets) {
    const record = asRecord(item);
    const symbol = typeof record.symbol === "string" ? record.symbol.toUpperCase() : "";
    const name = typeof record.name === "string" ? record.name : symbol;
    const priceUsd = typeof record.priceUsd === "string" ? record.priceUsd : "";
    if (!symbol || !priceUsd) {
      continue;
    }

    const previousPriceUsd =
      typeof record.previousPriceUsd === "string" ? record.previousPriceUsd : undefined;
    assets.push({ symbol, name, priceUsd, previousPriceUsd });
  }

  return assets;
}

function formatUsd(priceUsd: string): string {
  const numeric = Number(priceUsd.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return priceUsd;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function findAsset(assets: CompleterAsset[], symbol: string): CompleterAsset | undefined {
  return assets.find((asset) => asset.symbol === symbol.toUpperCase());
}

function sortedByPriceDesc(assets: CompleterAsset[]): CompleterAsset[] {
  return [...assets].sort((left, right) => Number(right.priceUsd) - Number(left.priceUsd));
}

/**
 * Eval-only, keyless, context-bound answers. Not production Crypto AI Analyst behavior.
 */
export function completeDeterministically(query: string, context: Record<string, unknown>): string {
  const assets = parseAssets(context);
  const q = query.toLowerCase();
  const btc = findAsset(assets, "BTC");
  const eth = findAsset(assets, "ETH");
  const ranked = sortedByPriceDesc(assets);

  if (/yesterday|last week|last year|historical/.test(q)) {
    return "The supplied market data does not include historical prices. BTC's price yesterday is unavailable.";
  }

  if (/market\s*cap/.test(q) && /larger|than|compared|compare/.test(q)) {
    return "The supplied market data does not include market capitalization, so I cannot say whether BTC has a larger market cap than ETH.";
  }

  if (/market\s*cap/.test(q)) {
    return "BTC market capitalization is unavailable in the supplied market data.";
  }

  if (/volume|24h/.test(q)) {
    const priceBits = [btc, eth]
      .filter((asset): asset is CompleterAsset => Boolean(asset))
      .map((asset) => `**${asset.symbol}** is **${formatUsd(asset.priceUsd)}**`);
    const prices = priceBits.length > 0 ? `${priceBits.join(". ")}. ` : "";
    return `${prices}24h volume is unavailable in the supplied market data.`;
  }

  if (/\brank\b/.test(q)) {
    const lines = ranked.map(
      (asset, index) => `${index + 1}. **${asset.symbol}** — **${formatUsd(asset.priceUsd)}**`,
    );
    return `Highest price to lowest:\n${lines.join("\n")}`;
  }

  if (/lowest|cheapest|least expensive/.test(q)) {
    const lowest = ranked[ranked.length - 1];
    if (!lowest) {
      return "The supplied market data does not include asset prices.";
    }
    return `**${lowest.symbol}** has the lowest price at **${formatUsd(lowest.priceUsd)}**.`;
  }

  if (/highest|most expensive/.test(q)) {
    const highest = ranked[0];
    if (!highest) {
      return "The supplied market data does not include asset prices.";
    }
    return `**${highest.symbol}** has the highest price at **${formatUsd(highest.priceUsd)}**.`;
  }

  if (/increas/.test(q) && btc?.previousPriceUsd && btc.priceUsd) {
    const previous = Number(btc.previousPriceUsd);
    const current = Number(btc.priceUsd);
    const percent = ((current - previous) / previous) * 100;
    return `BTC increased **${percent.toFixed(0)}%** from **${formatUsd(btc.previousPriceUsd)}** to **${formatUsd(btc.priceUsd)}**.`;
  }

  if (/difference/.test(q) && btc && eth) {
    const delta = Number(btc.priceUsd) - Number(eth.priceUsd);
    return `The price difference between BTC and ETH is **${formatUsd(String(delta))}**.`;
  }

  if (/times greater|how many times/.test(q) && btc && eth) {
    const ratio = Number(btc.priceUsd) / Number(eth.priceUsd);
    return `BTC's price is **${ratio.toFixed(2)}** times greater than ETH's price.`;
  }

  if (/percent(?:age)? of eth/.test(q) && eth) {
    const sol = findAsset(assets, "SOL");
    if (sol) {
      const percent = (Number(sol.priceUsd) / Number(eth.priceUsd)) * 100;
      return `SOL is **${percent.toFixed(2)}%** of ETH's price.`;
    }
  }

  if (btc && (/current price/.test(q) || /price of btc/.test(q) || /btc's current/.test(q))) {
    return `Bitcoin (BTC) is currently priced at **${formatUsd(btc.priceUsd)}**.`;
  }

  if (btc && /price of btc/.test(q)) {
    return `Bitcoin (BTC) is priced at **${formatUsd(btc.priceUsd)}**.`;
  }

  if (btc && eth && /compare/.test(q)) {
    return `**BTC** is **${formatUsd(btc.priceUsd)}**. **ETH** is **${formatUsd(eth.priceUsd)}**.`;
  }

  if (btc) {
    return `Bitcoin (BTC) is priced at **${formatUsd(btc.priceUsd)}**.`;
  }

  return "The supplied market data does not include a BTC price.";
}
