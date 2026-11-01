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
 * Checks whether a storage mechanism is functional and writable.
 * Safari Private Browsing mode and ITP restrictions throw errors when writing
 * or return quota errors that cause Firebase Auth to fail with auth/network-request-failed.
 */
function isStorageWritable(storageType: 'localStorage' | 'sessionStorage'): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const storage = window[storageType];
    if (!storage) return false;
    const testKey = `__apohub_probe_${storageType}__`;
    storage.setItem(testKey, '1');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

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
    // Proactively skip storage mechanisms blocked or quota-restricted by Safari Private Mode
    if (type === 'local' && !isStorageWritable('localStorage')) {
      logger.warn('localStorage is blocked/unwritable (Safari Private Browsing); skipping local persistence');
      continue;
    }
    if (type === 'session' && !isStorageWritable('sessionStorage')) {
      logger.warn('sessionStorage is blocked/unwritable; skipping session persistence');
      continue;
    }

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
