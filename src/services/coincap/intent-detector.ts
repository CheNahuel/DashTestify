export interface DataIntent {
  needsAssets: boolean;
  needsHistory: boolean;
  needsMarkets: boolean;
  needsRates: boolean;
  targetCoinIds: string[];
  reason: string;
}

const COMMON_COINS = [
  { names: ['bitcoin', 'btc'], id: 'bitcoin' },
  { names: ['ethereum', 'eth'], id: 'ethereum' },
  { names: ['solana', 'sol'], id: 'solana' },
  { names: ['cardano', 'ada'], id: 'cardano' },
  { names: ['polkadot', 'dot'], id: 'polkadot' },
  { names: ['ripple', 'xrp'], id: 'ripple' },
  { names: ['litecoin', 'ltc'], id: 'litecoin' },
  { names: ['bitcoin-cash', 'bch'], id: 'bitcoin-cash' },
  { names: ['chainlink', 'link'], id: 'chainlink' },
  { names: ['uniswap', 'uni'], id: 'uniswap' },
];

export function extractCoinIds(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const found: string[] = [];

  for (const coin of COMMON_COINS) {
    if (coin.names.some((name) => lowerQuery.includes(name))) {
      if (!found.includes(coin.id)) {
        found.push(coin.id);
      }
    }
  }

  return found;
}

export function detectIntent(query: string): DataIntent {
  const lowerQuery = query.toLowerCase();
  const targetCoinIds = extractCoinIds(query);

  const needsAssets =
    lowerQuery.includes('compare') ||
    lowerQuery.includes('gainers') ||
    lowerQuery.includes('losers') ||
    lowerQuery.includes('market cap') ||
    lowerQuery.includes('market-cap') ||
    lowerQuery.includes('trending') ||
    lowerQuery.includes('highest') ||
    lowerQuery.includes('lowest') ||
    lowerQuery.includes('top ') ||
    (targetCoinIds.length > 0 && (
      lowerQuery.includes('what is') ||
      lowerQuery.includes('tell me') ||
      lowerQuery.includes('info about')
    ));

  const needsHistory =
    lowerQuery.includes('history') ||
    lowerQuery.includes('trend') ||
    lowerQuery.includes('perform') ||
    lowerQuery.includes('last ') ||
    lowerQuery.includes('month') ||
    lowerQuery.includes('year') ||
    lowerQuery.includes('6 month') ||
    lowerQuery.includes('week') ||
    lowerQuery.includes('day') ||
    (targetCoinIds.length > 0 && (
      lowerQuery.includes('price') ||
      lowerQuery.includes('over time')
    ));

  const needsMarkets =
    lowerQuery.includes('market') ||
    lowerQuery.includes('exchange') ||
    lowerQuery.includes('trading');

  const needsRates =
    lowerQuery.includes('rate') ||
    lowerQuery.includes('exchange rate') ||
    lowerQuery.includes('conversion') ||
    lowerQuery.includes('usd') ||
    lowerQuery.includes('currency');

  const reasons: string[] = [];
  if (needsAssets) reasons.push('asset comparison');
  if (needsHistory && targetCoinIds.length > 0) reasons.push('price history');
  if (needsMarkets) reasons.push('market data');
  if (needsRates) reasons.push('exchange rates');
  if (targetCoinIds.length > 0 && !needsHistory && !needsAssets && !needsMarkets)
    reasons.push('basic info');

  return {
    needsAssets,
    needsHistory,
    needsMarkets,
    needsRates,
    targetCoinIds,
    reason: reasons.length > 0 ? reasons.join(', ') : 'general query',
  };
}
