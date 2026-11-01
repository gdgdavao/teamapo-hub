import {
  Auth,
  Persistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  setPersistence,
} from 'firebase/auth';
import { auth as defaultAuth } from '../config/firebase';
import { logger } from '../utils/logger';

let activeResolvedType: string | null = null;

/**
 * Attempts persistence modes in a resilient fallback ladder without blocking sign-in.
 *
 * Order for rememberMe:
 *  browserLocalPersistence -> browserSessionPersistence -> inMemoryPersistence
 *
 * Order for !rememberMe:
 *  browserSessionPersistence -> inMemoryPersistence
 *
 * Prevents iOS Safari private mode / storage quota / ITP IndexedDB exceptions
 * from surfacing as `auth/network-request-failed` during login.
 */
export async function resolveStableAuthPersistence(
  rememberMe: boolean,
  authInstance: Auth = defaultAuth
): Promise<Persistence> {
  const ladder: Array<{ type: string; persistence: Persistence }> = rememberMe
    ? [
        { type: 'local', persistence: browserLocalPersistence },
        { type: 'session', persistence: browserSessionPersistence },
        { type: 'inMemory', persistence: inMemoryPersistence },
      ]
    : [
        { type: 'session', persistence: browserSessionPersistence },
        { type: 'inMemory', persistence: inMemoryPersistence },
      ];

  const targetKey = `${rememberMe ? 'remember' : 'transient'}`;
  if (activeResolvedType === targetKey) {
    return ladder[0].persistence;
  }

  for (const { type, persistence } of ladder) {
    try {
      await setPersistence(authInstance, persistence);
      activeResolvedType = targetKey;
      return persistence;
    } catch (err) {
      logger.warn(`Auth persistence '${type}' unavailable, attempting next tier:`, err);
    }
  }

  return inMemoryPersistence;
}

export function resetActivePersistenceCacheForTesting(): void {
  activeResolvedType = null;
}
