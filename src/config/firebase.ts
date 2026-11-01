import { initializeApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  connectAuthEmulator,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { logger } from '../utils/logger';
import { isSafeEmulatorEnvironment } from '../utils/firebaseEnvironment';

/**
 * Resolves the authDomain for Firebase Auth.
 * In production on custom domains (e.g. apohub.gdgdavao.org), returns the current
 * hostname so Firebase Auth requests route to the first-party domain via Vercel's
 * reverse proxy (/ __ / auth / *), bypassing Safari's ITP third-party storage restrictions.
 */
export function resolveAuthDomain(): string {
  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    !import.meta.env.DEV &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return window.location.hostname;
  }
  return import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'project-iris-gdgdavao.firebaseapp.com';
}

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with a resilient persistence stack.
// Notice indexedDBLocalPersistence is intentionally omitted: on Safari (WebKit),
// background tab suspension, Private Browsing, and ITP storage partitioning lock
// or abort IndexedDB transactions, which Firebase surfaces as auth/network-request-failed.
// browserLocalPersistence (localStorage) provides safe multi-tab persistence without IDB locks.
let authInstance;
try {
  authInstance = initializeAuth(app, {
    persistence: [
      browserLocalPersistence,
      browserSessionPersistence,
      inMemoryPersistence,
    ],
  });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;

// Multi-tab cache configuration across Safari/WebKit, Chrome, Firefox with memory fallback
let localCacheSetting;
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  try {
    localCacheSetting = persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    });
  } catch (err) {
    logger.warn('Failed to initialize persistentLocalCache, falling back to memoryLocalCache:', err);
    localCacheSetting = memoryLocalCache();
  }
} else {
  localCacheSetting = memoryLocalCache();
}

export const db = initializeFirestore(app, {
  localCache: localCacheSetting,
  experimentalAutoDetectLongPolling: true,
});
// Use the deployed region to avoid cross-region callable endpoints (preflight/CORS issues)
export const functions = getFunctions(app, 'asia-southeast2');
export const storage = getStorage(app);

// Connect to emulators only in non-production development environments with safe demo projects
const wantsEmulator = import.meta.env.VITE_USE_EMULATOR === 'true' || 
                      import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

const shouldUseEmulator = !import.meta.env.PROD &&
                         wantsEmulator &&
                         isSafeEmulatorEnvironment(firebaseConfig.projectId, Boolean(import.meta.env.PROD));

// Track which emulators are connected to avoid duplicate connections
let emulatorsConnected = false;

if (shouldUseEmulator && !emulatorsConnected) {
  logger.log('🔧 Connecting to Firebase Emulators...');
  
  try {
    // When accessing dev server from a physical device on the same LAN (e.g. via --host),
    // connect to the emulator using the current LAN hostname rather than loopback 127.0.0.1.
    const emulatorHost =
      typeof window !== 'undefined' &&
      window.location.hostname &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
        ? window.location.hostname
        : '127.0.0.1';

    // Connect to Auth emulator
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    logger.log(`✅ Connected to Auth Emulator on ${emulatorHost}:9099`);
    
    // Connect to Firestore emulator
    connectFirestoreEmulator(db, emulatorHost, 8080);
    logger.log(`✅ Connected to Firestore Emulator on ${emulatorHost}:8080`);
    
    // Connect to Functions emulator
    connectFunctionsEmulator(functions, emulatorHost, 5001);
    logger.log(`✅ Connected to Functions Emulator on ${emulatorHost}:5001`);
    
    // Connect to Storage emulator
    connectStorageEmulator(storage, emulatorHost, 9199);
    logger.log(`✅ Connected to Storage Emulator on ${emulatorHost}:9199`);
    
    emulatorsConnected = true;
    logger.log('🚀 All Firebase services connected to emulators');
    logger.log('📊 Emulator UI available at: http://localhost:4000');
  } catch (error) {
    logger.warn('⚠️ Some emulators may already be connected:', error);
  }
} else if (!shouldUseEmulator) {
  logger.log('☁️ Using Firebase production services');
}

export default app; 