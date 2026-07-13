import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { coincapClient } from '@/services/coincap';
import { fetchCoins, fetchCoinHistory } from '@/services/coincap';

const SUPPORTED_COINS = [
  { symbol: 'BTC', name: 'Bitcoin', coincap_id: 'bitcoin' },
  { symbol: 'ETH', name: 'Ethereum', coincap_id: 'ethereum' },
  { symbol: 'SOL', name: 'Solana', coincap_id: 'solana' },
  { symbol: 'ADA', name: 'Cardano', coincap_id: 'cardano' },
  { symbol: 'XRP', name: 'Ripple', coincap_id: 'ripple' },
  { symbol: 'DOT', name: 'Polkadot', coincap_id: 'polkadot' },
  { symbol: 'DOGE', name: 'Dogecoin', coincap_id: 'dogecoin' },
  { symbol: 'LINK', name: 'Chainlink', coincap_id: 'chainlink' },
  { symbol: 'UNI', name: 'Uniswap', coincap_id: 'uniswap' },
  { symbol: 'LTC', name: 'Litecoin', coincap_id: 'litecoin' },
];

async function seedCryptoData() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🚀 Starting crypto data seeding...\n');

  try {
    // Step 1: Insert coins
    console.log('📝 Step 1: Inserting coin records...');
    const coinRecords = SUPPORTED_COINS.map((coin) => ({
      symbol: coin.symbol,
      name: coin.name,
      coincap_id: coin.coincap_id,
    }));

    const { data: insertedCoins, error: coinError } = await supabase
      .from('coins')
      .upsert(coinRecords, { onConflict: 'coincap_id' })
      .select();

    if (coinError) {
      throw new Error(`Failed to insert coins: ${coinError.message}`);
    }

    console.log(`✅ Inserted ${insertedCoins?.length || 0} coins\n`);

    // Step 2: Fetch and insert price history
    console.log('📊 Step 2: Fetching price history from CoinCap...');

    const priceHistory: Array<{
      coin_id: string;
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
    }> = [];

    for (const coin of SUPPORTED_COINS) {
      try {
        console.log(`  Fetching history for ${coin.symbol}...`);
        const history = await fetchCoinHistory(coin.coincap_id, {
          interval: 'd1',
          start: Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60, // 1 year ago
          end: Math.floor(Date.now() / 1000),
        });

        const coinId = insertedCoins?.find((c) => c.coincap_id === coin.coincap_id)?.id;
        if (!coinId) {
          console.warn(`  ⚠️  Could not find coin_id for ${coin.symbol}`);
          continue;
        }

        // Convert history to daily format
        if (history.prices && Array.isArray(history.prices)) {
          history.prices.slice(-365).forEach((pricePoint: [number, number]) => {
            const [timestamp, price] = pricePoint;
            const date = new Date(timestamp).toISOString().split('T')[0];

            priceHistory.push({
              coin_id: coinId,
              date,
              open: price,
              high: price,
              low: price,
              close: price,
            });
          });
        }

        console.log(`  ✅ ${coin.symbol}: ${history.prices?.length || 0} price points`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to fetch history for ${coin.symbol}:`, error);
      }
    }

    console.log(`\n📤 Step 3: Inserting ${priceHistory.length} price records...\n`);

    // Insert in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < priceHistory.length; i += batchSize) {
      const batch = priceHistory.slice(i, i + batchSize);

      const { error: priceError } = await supabase
        .from('price_daily')
        .upsert(batch, { onConflict: 'coin_id,date' });

      if (priceError) {
        throw new Error(`Failed to insert prices: ${priceError.message}`);
      }

      console.log(`  ✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(priceHistory.length / batchSize)}`);
    }

    console.log('\n✨ Crypto data seeding completed successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`  - Coins: ${insertedCoins?.length || 0}`);
    console.log(`  - Price records: ${priceHistory.length}`);
  } catch (error) {
    console.error('\n❌ Error during seeding:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

seedCryptoData();
