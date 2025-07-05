import React, { useEffect, useState } from 'react';
import { auth, db, storage, functions } from '../config/firebase';
import { connectAuthEmulator } from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { connectStorageEmulator } from 'firebase/storage';
import { connectFunctionsEmulator } from 'firebase/functions';

interface FirebaseStatus {
  auth: boolean;
  firestore: boolean;
  storage: boolean;
  functions: boolean;
  error?: string;
}

export const FirebaseConnectionStatus: React.FC = () => {
  const [status, setStatus] = useState<FirebaseStatus>({
    auth: false,
    firestore: false,
    storage: false,
    functions: false,
  });

  useEffect(() => {
    const checkFirebaseConnection = async () => {
      try {
        // Check if we're in development and should use emulators
        const isDevelopment = import.meta.env.DEV;
        
        if (isDevelopment && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
          try {
            // Connect to Firebase emulators
            connectAuthEmulator(auth, 'http://localhost:9099');
            connectFirestoreEmulator(db, 'localhost', 8080);
            connectStorageEmulator(storage, 'localhost', 9199);
            connectFunctionsEmulator(functions, 'localhost', 5001);
          } catch (error) {
            console.log('Emulators already connected or not available');
          }
        }

        setStatus({
          auth: !!auth,
          firestore: !!db,
          storage: !!storage,
          functions: !!functions,
        });
      } catch (error: any) {
        setStatus({
          auth: false,
          firestore: false,
          storage: false,
          functions: false,
          error: error.message,
        });
      }
    };

    checkFirebaseConnection();
  }, []);

  // Only show in development
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border border-gray-200 text-xs">
      <h3 className="font-semibold text-gray-800 mb-2">Firebase Status</h3>
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${status.auth ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>Authentication</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${status.firestore ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>Firestore</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${status.storage ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>Storage</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${status.functions ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>Functions</span>
        </div>
        {status.error && (
          <div className="text-red-600 mt-2">
            Error: {status.error}
          </div>
        )}
      </div>
    </div>
  );
};
