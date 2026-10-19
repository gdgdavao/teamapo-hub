interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class SwrCache {
  private cache = new Map<string, CacheEntry<any>>();
  private inFlight = new Map<string, Promise<any>>();

  /**
   * Get cached data or fetch fresh.
   * If cached: returns immediately (<1ms).
   * If stale (>ttlMs): returns cached data and kicks off background revalidation.
   * If miss: executes fetcher and deduplicates concurrent identical calls.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 30_000
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);

    if (entry) {
      if (now - entry.timestamp > ttlMs && !this.inFlight.has(key)) {
        const bgPromise = Promise.resolve()
          .then(() => fetcher())
          .then((fresh) => {
            this.cache.set(key, { data: fresh, timestamp: Date.now() });
            return fresh;
          })
          .catch(() => entry.data)
          .finally(() => {
            this.inFlight.delete(key);
          });
        this.inFlight.set(key, bgPromise);
      }
      return entry.data;
    }

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)!;
    }

    const promise = fetcher()
      .then((data) => {
        this.cache.set(key, { data, timestamp: Date.now() });
        return data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  get<T>(key: string): T | undefined {
    return this.cache.get(key)?.data;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  deletePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }
}

export const swrCache = new SwrCache();
