#!/usr/bin/env node
/**
 * [DEPRECATED] Use scripts/sync-historical-data.ts instead
 *
 * This script is deprecated and maintained only for backwards compatibility.
 * Use the modern sync script which combines CoinGecko and CoinCap with better
 * error handling and rate limit management.
 *
 * Migration:
 *   Old: npx tsx scripts/run-initial-sync.ts
 *   New: npx tsx scripts/sync-historical-data.ts
 *
 * The new script:
 *   - Uses CoinGecko first (no rate limits) then CoinCap fallback
 *   - Handles errors gracefully with clear troubleshooting
 *   - Processes data in batches for efficiency
 *   - Provides better progress feedback
 */

console.log("⚠️  This script is deprecated!");
console.log("\n📝 Please use instead:");
console.log("   npx tsx scripts/sync-historical-data.ts\n");
console.log("The new script has better rate limit handling and error recovery.\n");

process.exit(1);
