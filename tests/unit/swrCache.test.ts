import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SwrCache } from '../../src/utils/swrCache';

describe('SwrCache', () => {
  let cache: SwrCache;

  beforeEach(() => {
    cache = new SwrCache();
  });

  it('fetches and caches on first call', async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: '123' });
    const res1 = await cache.getOrFetch('key1', fetcher, 1000);

    expect(res1).toEqual({ id: '123' });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const res2 = await cache.getOrFetch('key1', fetcher, 1000);
    expect(res2).toEqual({ id: '123' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent in-flight requests', async () => {
    let resolvePromise: (val: any) => void;
    const fetcher = vi.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        resolvePromise = resolve;
      });
    });

    const p1 = cache.getOrFetch('key2', fetcher, 1000);
    const p2 = cache.getOrFetch('key2', fetcher, 1000);

    expect(fetcher).toHaveBeenCalledTimes(1);
    resolvePromise!({ hello: 'world' });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ hello: 'world' });
    expect(r2).toEqual({ hello: 'world' });
  });

  it('returns stale data immediately and triggers background revalidation when expired', async () => {
    let count = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      count++;
      return { count };
    });

    const initial = await cache.getOrFetch('key3', fetcher, 10);
    expect(initial).toEqual({ count: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Wait until TTL expires
    await new Promise((r) => setTimeout(r, 15));

    // Stale call returns cached data synchronously/immediately
    const staleResult = await cache.getOrFetch('key3', fetcher, 10);
    expect(staleResult).toEqual({ count: 1 });
    expect(fetcher).toHaveBeenCalledTimes(2);

    // Wait for background revalidation to settle
    await new Promise((r) => setTimeout(r, 10));

    // Next call returns the revalidated data
    const freshResult = await cache.getOrFetch('key3', fetcher, 10);
    expect(freshResult).toEqual({ count: 2 });
  });

  it('invalidates by key and prefix properly', async () => {
    cache.set('events:1', { title: 'Event 1' });
    cache.set('events:2', { title: 'Event 2' });
    cache.set('users:1', { name: 'User 1' });

    cache.delete('events:1');
    expect(cache.get('events:1')).toBeUndefined();
    expect(cache.get('events:2')).toBeDefined();

    cache.deletePrefix('events:');
    expect(cache.get('events:2')).toBeUndefined();
    expect(cache.get('users:1')).toBeDefined();
  });
});
