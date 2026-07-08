import { coincapClient } from './client';

export interface CoinCapAsset {
  id: string;
  name: string;
  symbol: string;
  priceUsd: string;
  changePercent24Hr: string | null;
  marketCapUsd: string;
  volumeUsd24Hr: string;
}

const toNumber = (value: string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export interface Coin {
  id: string;
  name: string;
  symbol: string;
  current_price: number;
  price_change_percentage_24h: number;
  image: string;
  market_cap: number;
  total_volume: number;
}

const mapAssetToCoin = (asset: CoinCapAsset): Coin => {
  const symbol = asset.symbol?.toLowerCase() || 'unknown';
  return {
    id: asset.id,
    name: asset.name,
    symbol: asset.symbol,
    current_price: toNumber(asset.priceUsd),
    price_change_percentage_24h: toNumber(asset.changePercent24Hr),
    image: `https://assets.coincap.io/assets/icons/${symbol}@2x.png`,
    market_cap: toNumber(asset.marketCapUsd),
    total_volume: toNumber(asset.volumeUsd24Hr),
  };
};

export async function fetchCoins(): Promise<Coin[]> {
  const assets = await coincapClient.fetchAssets();
  return (assets as CoinCapAsset[]).map(mapAssetToCoin);
}
