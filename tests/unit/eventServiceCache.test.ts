import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  docMock,
  getDocMock,
  getDocsMock,
  updateDocMock,
  collectionMock,
  queryMock,
  whereMock,
  limitMock,
} = vi.hoisted(() => ({
  docMock: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
  getDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  updateDocMock: vi.fn(),
  collectionMock: vi.fn((_db, name) => ({ path: name })),
  queryMock: vi.fn((...args) => ({ queryArgs: args })),
  whereMock: vi.fn((...args) => ({ where: args })),
  limitMock: vi.fn((n) => ({ limit: n })),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<Record<string, any>>('firebase/firestore');
  return {
    ...actual,
    doc: docMock,
    getDoc: getDocMock,
    getDocs: getDocsMock,
    updateDoc: updateDocMock,
    collection: collectionMock,
    query: queryMock,
    where: whereMock,
    limit: limitMock,
    serverTimestamp: vi.fn(() => ({ seconds: 1234567890 })),
  };
});

vi.mock('../../src/config/firebase', () => ({
  db: {},
  functions: {},
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { EventService } from '../../src/services/eventService';

describe('EventService In-Flight Deduplication & Memory Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    EventService.invalidateCache();
  });

  it('deduplicates concurrent in-flight requests for the same event ID', async () => {
    const mockEventData = {
      title: 'DevFest Davao 2026',
      slug: 'devfest-2026',
      status: 'published',
      isPublished: true,
    };

    getDocMock.mockImplementation(async () => {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        exists: () => true,
        id: 'evt-100',
        data: () => mockEventData,
      };
    });

    const [res1, res2, res3] = await Promise.all([
      EventService.getEvent('evt-100'),
      EventService.getEvent('evt-100'),
      EventService.getEvent('evt-100'),
    ]);

    expect(getDocMock).toHaveBeenCalledTimes(1);
    expect(res1?.id).toBe('evt-100');
    expect(res2?.id).toBe('evt-100');
    expect(res3?.id).toBe('evt-100');
  });

  it('serves cached event within TTL without refetching', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'evt-200',
      data: () => ({ title: 'AI Summit', isPublished: true }),
    });

    const first = await EventService.getEvent('evt-200');
    expect(first?.title).toBe('AI Summit');
    expect(getDocMock).toHaveBeenCalledTimes(1);

    // Immediate second call should hit the memory cache
    const second = await EventService.getEvent('evt-200');
    expect(second?.title).toBe('AI Summit');
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache when invalidateCache(eventId) is explicitly called', async () => {
    getDocMock
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'evt-300',
        data: () => ({ title: 'Build With AI v1', isPublished: true }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'evt-300',
        data: () => ({ title: 'Build With AI v2', isPublished: true }),
      });

    const v1 = await EventService.getEvent('evt-300');
    expect(v1?.title).toBe('Build With AI v1');
    expect(getDocMock).toHaveBeenCalledTimes(1);

    EventService.invalidateCache('evt-300');

    const v2 = await EventService.getEvent('evt-300');
    expect(v2?.title).toBe('Build With AI v2');
    expect(getDocMock).toHaveBeenCalledTimes(2);
  });

  it('deduplicates and caches getEventBySlug requests', async () => {
    getDocsMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        empty: false,
        docs: [
          {
            id: 'evt-slug-1',
            exists: () => true,
            data: () => ({ title: 'Flutter Festival', slug: 'flutter-fest' }),
          },
        ],
      };
    });

    const [e1, e2] = await Promise.all([
      EventService.getEventBySlug('flutter-fest'),
      EventService.getEventBySlug('flutter-fest'),
    ]);

    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(e1?.id).toBe('evt-slug-1');
    expect(e2?.id).toBe('evt-slug-1');

    // Subsequent call hits slug cache
    const e3 = await EventService.getEventBySlug('flutter-fest');
    expect(e3?.id).toBe('evt-slug-1');
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('prefetchEvent initiates cache populate in background', async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'evt-prefetch-1',
      data: () => ({ title: 'Prefetched Event' }),
    });

    EventService.prefetchEvent('evt-prefetch-1');

    // Wait microtask tick for async getEvent to finish
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(getDocMock).toHaveBeenCalledTimes(1);

    // Call getEvent directly; should hit memory cache without second getDoc
    const event = await EventService.getEvent('evt-prefetch-1');
    expect(event?.title).toBe('Prefetched Event');
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });
});
