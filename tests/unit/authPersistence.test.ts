import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  resolveStableAuthPersistence,
  resetActivePersistenceCacheForTesting,
} from '@/services/authPersistence';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  setPersistence,
  Auth,
} from 'firebase/auth';

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    browserLocalPersistence: { type: 'LOCAL' },
    browserSessionPersistence: { type: 'SESSION' },
    inMemoryPersistence: { type: 'NONE' },
    setPersistence: vi.fn(),
  };
});

describe('resolveStableAuthPersistence', () => {
  const mockAuth = {} as Auth;

  beforeEach(() => {
    vi.clearAllMocks();
    resetActivePersistenceCacheForTesting();
  });

  it('selects browserLocalPersistence first when rememberMe is true', async () => {
    vi.mocked(setPersistence).mockResolvedValueOnce();

    const persistence = await resolveStableAuthPersistence(true, mockAuth);

    expect(setPersistence).toHaveBeenCalledWith(mockAuth, browserLocalPersistence);
    expect(persistence).toBe(browserLocalPersistence);
  });

  it('falls back to browserSessionPersistence if browserLocalPersistence rejects', async () => {
    vi.mocked(setPersistence)
      .mockRejectedValueOnce(new Error('IndexedDB quota exceeded / Safari ITP restriction'))
      .mockResolvedValueOnce();

    const persistence = await resolveStableAuthPersistence(true, mockAuth);

    expect(setPersistence).toHaveBeenNthCalledWith(1, mockAuth, browserLocalPersistence);
    expect(setPersistence).toHaveBeenNthCalledWith(2, mockAuth, browserSessionPersistence);
    expect(persistence).toBe(browserSessionPersistence);
  });

  it('falls back to inMemoryPersistence if both local and session storage reject', async () => {
    vi.mocked(setPersistence)
      .mockRejectedValueOnce(new Error('Local storage disabled'))
      .mockRejectedValueOnce(new Error('Session storage disabled'))
      .mockResolvedValueOnce();

    const persistence = await resolveStableAuthPersistence(true, mockAuth);

    expect(setPersistence).toHaveBeenNthCalledWith(1, mockAuth, browserLocalPersistence);
    expect(setPersistence).toHaveBeenNthCalledWith(2, mockAuth, browserSessionPersistence);
    expect(setPersistence).toHaveBeenNthCalledWith(3, mockAuth, inMemoryPersistence);
    expect(persistence).toBe(inMemoryPersistence);
  });

  it('starts with browserSessionPersistence when rememberMe is false', async () => {
    vi.mocked(setPersistence).mockResolvedValueOnce();

    const persistence = await resolveStableAuthPersistence(false, mockAuth);

    expect(setPersistence).toHaveBeenCalledWith(mockAuth, browserSessionPersistence);
    expect(persistence).toBe(browserSessionPersistence);
  });

  it('falls back to inMemoryPersistence when rememberMe is false and session storage rejects', async () => {
    vi.mocked(setPersistence)
      .mockRejectedValueOnce(new Error('Session storage disabled in Safari private mode'))
      .mockResolvedValueOnce();

    const persistence = await resolveStableAuthPersistence(false, mockAuth);

    expect(setPersistence).toHaveBeenNthCalledWith(1, mockAuth, browserSessionPersistence);
    expect(setPersistence).toHaveBeenNthCalledWith(2, mockAuth, inMemoryPersistence);
    expect(persistence).toBe(inMemoryPersistence);
  });

  it('caches active persistence and avoids re-executing ladder for the same intent', async () => {
    vi.mocked(setPersistence).mockResolvedValueOnce();

    await resolveStableAuthPersistence(true, mockAuth);
    expect(setPersistence).toHaveBeenCalledTimes(1);

    // Second call with same rememberMe
    await resolveStableAuthPersistence(true, mockAuth);
    expect(setPersistence).toHaveBeenCalledTimes(1);
  });
});
