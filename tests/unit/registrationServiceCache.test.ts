import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  docMock,
  getDocMock,
  getDocsMock,
  updateDocMock,
  collectionMock,
  queryMock,
  whereMock,
  orderByMock,
} = vi.hoisted(() => ({
  docMock: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
  getDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  updateDocMock: vi.fn(),
  collectionMock: vi.fn((_db, name) => ({ path: name })),
  queryMock: vi.fn((...args) => ({ queryArgs: args })),
  whereMock: vi.fn((...args) => ({ where: args })),
  orderByMock: vi.fn((...args) => ({ orderBy: args })),
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
    orderBy: orderByMock,
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

import { RegistrationService } from '../../src/services/registrationService';

describe('RegistrationService In-Flight Deduplication & Memory Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    RegistrationService.invalidateCache();
  });

  it('deduplicates concurrent in-flight requests for event registrations', async () => {
    getDocsMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        docs: [
          {
            id: 'reg-1',
            data: () => ({ eventId: 'evt-100', fullName: 'Ada Lovelace' }),
          },
          {
            id: 'reg-2',
            data: () => ({ eventId: 'evt-100', fullName: 'Alan Turing' }),
          },
        ],
      };
    });

    const [r1, r2, r3] = await Promise.all([
      RegistrationService.getEventRegistrations('evt-100'),
      RegistrationService.getEventRegistrations('evt-100'),
      RegistrationService.getEventRegistrations('evt-100'),
    ]);

    expect(getDocsMock).toHaveBeenCalledTimes(1);
    expect(r1).toHaveLength(2);
    expect(r2).toHaveLength(2);
    expect(r3).toHaveLength(2);
    expect(r1[0].id).toBe('reg-1');
  });

  it('serves cached registrations within TTL without refetching', async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          id: 'reg-cached',
          data: () => ({ eventId: 'evt-200', fullName: 'Grace Hopper' }),
        },
      ],
    });

    const first = await RegistrationService.getEventRegistrations('evt-200');
    expect(first).toHaveLength(1);
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    // Second call within TTL should return from memory cache
    const second = await RegistrationService.getEventRegistrations('evt-200');
    expect(second).toHaveLength(1);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache when invalidateCache(eventId) is explicitly called', async () => {
    getDocsMock
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'reg-v1',
            data: () => ({ eventId: 'evt-300', fullName: 'Attendee V1' }),
          },
        ],
      })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'reg-v2',
            data: () => ({ eventId: 'evt-300', fullName: 'Attendee V2' }),
          },
        ],
      });

    const v1 = await RegistrationService.getEventRegistrations('evt-300');
    expect(v1[0].id).toBe('reg-v1');
    expect(getDocsMock).toHaveBeenCalledTimes(1);

    RegistrationService.invalidateCache('evt-300');

    const v2 = await RegistrationService.getEventRegistrations('evt-300');
    expect(v2[0].id).toBe('reg-v2');
    expect(getDocsMock).toHaveBeenCalledTimes(2);
  });

  it('prefetchEventRegistrations triggers cache population in the background', async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [
        {
          id: 'reg-prefetch',
          data: () => ({ eventId: 'evt-prefetch', fullName: 'Prefetched User' }),
        },
      ],
    });

    RegistrationService.prefetchEventRegistrations('evt-prefetch');

    // Wait microtask tick for async getEventRegistrations to finish
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(getDocsMock).toHaveBeenCalledTimes(1);

    const result = await RegistrationService.getEventRegistrations('evt-prefetch');
    expect(result).toHaveLength(1);
    expect(getDocsMock).toHaveBeenCalledTimes(1);
  });
});
