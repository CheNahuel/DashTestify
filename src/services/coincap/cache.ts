type CacheEntry<T> = {
  data: T;
  fetchedAt: number;
  inFlightPromise?: Promise<T>;
};

export type CacheTTL = {
  assets: number;
  markets: number;
  rates: number;
  history: number;
  asset: number;
};

const DEFAULT_TTL: CacheTTL = {
  assets: 5 * 60 * 1000, // 5 minutes
  markets: 5 * 60 * 1000, // 5 minutes
  rates: 30 * 60 * 1000, // 30 minutes
  history: 60 * 60 * 1000, // 1 hour
  asset: 2 * 60 * 1000, // 2 minutes
};

class CoinCapCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private ttl: CacheTTL;

  constructor(ttl: Partial<CacheTTL> = {}) {
    this.ttl = { ...DEFAULT_TTL, ...ttl };
  }

  private getTTL(key: string): number {
    if (key.startsWith('history:')) return this.ttl.history;
    if (key.startsWith('asset:')) return this.ttl.asset;
    if (key === 'assets') return this.ttl.assets;
    if (key === 'markets') return this.ttl.markets;
    if (key === 'rates') return this.ttl.rates;
    return this.ttl.assets;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    const age = Date.now() - entry.fetchedAt;
    const ttl = this.getTTL(key);

    if (age < ttl) {
      return entry.data;
    }

    this.cache.delete(key);
    return null;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      fetchedAt: Date.now(),
    });
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry?.inFlightPromise) {
      return entry.inFlightPromise;
    }

    const promise = fetcher()
      .then((data) => {
        this.set(key, data);
        const updatedEntry = this.cache.get(key) as CacheEntry<T>;
        delete updatedEntry.inFlightPromise;
        return data;
      })
      .catch((error) => {
        const updatedEntry = this.cache.get(key) as CacheEntry<T> | undefined;
        if (updatedEntry) {
          delete updatedEntry.inFlightPromise;
        }
        throw error;
      });

    if (entry) {
      entry.inFlightPromise = promise;
    } else {
      this.cache.set(key, {
        data: undefined as any,
        fetchedAt: Date.now(),
        inFlightPromise: promise,
      });
    }

    return promise;
  }

  clear(): void {
    this.cache.clear();
  }

  clearPattern(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string'
      ? new RegExp(`^${pattern}`)
      : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

export const coincapCache = new CoinCapCache();
