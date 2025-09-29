import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
// Use the deployed region to avoid cross-region callable endpoints (preflight/CORS issues)
export const functions = getFunctions(app, 'asia-southeast2');
export const storage = getStorage(app);

// Connect to emulators if in development mode
const shouldUseEmulator = import.meta.env.VITE_USE_EMULATOR === 'true' || 
                         import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

// Track which emulators are connected to avoid duplicate connections
let emulatorsConnected = false;

if (shouldUseEmulator && !emulatorsConnected) {
  console.log('🔧 Connecting to Firebase Emulators...');
  
  try {
    // Connect to Auth emulator
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log('✅ Connected to Auth Emulator');
    
    // Connect to Firestore emulator
    connectFirestoreEmulator(db, 'localhost', 8080);
    console.log('✅ Connected to Firestore Emulator');
    
    // Connect to Functions emulator
    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log('✅ Connected to Functions Emulator');
    
    // Connect to Storage emulator
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('✅ Connected to Storage Emulator');
    
    emulatorsConnected = true;
    console.log('🚀 All Firebase services connected to emulators');
    console.log('📊 Emulator UI available at: http://localhost:4000');
  } catch (error) {
    console.warn('⚠️ Some emulators may already be connected:', error);
  }
} else if (!shouldUseEmulator) {
  console.log('☁️ Using Firebase production services');
}

export default app; 