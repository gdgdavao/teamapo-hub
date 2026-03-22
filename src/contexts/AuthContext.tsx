import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { logger } from '../utils/logger';
import { User } from '../types';
import toast from 'react-hot-toast';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  updateAnyUserProfile: (userId: string, data: Partial<User>) => Promise<void>;
  createUser: (email: string, password: string, displayName: string, role: 'organizer' | 'admin') => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthErrorLike = {
  code?: string;
};

const getFriendlySignInErrorMessage = (error: AuthErrorLike) => {
  const signInErrorMessages: Record<string, string> = {
    'auth/invalid-credential': 'Invalid email or password. Please try again.',
    'auth/wrong-password': 'Invalid email or password. Please try again.',
    'auth/user-not-found': 'Invalid email or password. Please try again.',
    'auth/too-many-requests': 'Too many failed attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  };

  return signInErrorMessages[error.code ?? ''] ?? 'Unable to sign in. Please try again.';
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const createUserProfile = async (user: FirebaseUser, additionalData?: any) => {
    if (!user) return;

    logger.log('Creating user profile for:', user.uid, user.email);
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      logger.log('User document does not exist, creating new one');
      const { displayName, email, photoURL } = user;
      
      // Default role is organizer for authenticated users
      // Attendees are anonymous and don't have accounts
      const role: 'organizer' | 'admin' = 'organizer';

      const newUser: Omit<User, 'uid'> = {
        email: email!,
        displayName: displayName || email!.split('@')[0],
        photoURL: photoURL || undefined,
        role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...additionalData,
      };

      try {
        logger.log('Saving user document to Firestore:', newUser);
        await setDoc(userRef, newUser);
        const fullUser: User = { uid: user.uid, ...newUser } as User;
        setUserProfile(fullUser);
        logger.log('User profile created successfully:', fullUser);
        return fullUser;
      } catch (error) {
        logger.error('Error creating user profile:', error);
        throw error;
      }
    } else {
      logger.log('User document exists, loading profile');
      const userData = userSnap.data() as Omit<User, 'uid'>;
      const fullUser: User = { uid: user.uid, ...userData };
      setUserProfile(fullUser);
      logger.log('User profile loaded:', fullUser);
      return fullUser;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      await createUserProfile(result.user);
      toast.success(`Welcome back, ${result.user.displayName || email}!`);
    } catch (error: any) {
      logger.error('Sign in error:', error);
      toast.error(getFriendlySignInErrorMessage(error));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      setLoading(true);
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's display name
      await updateProfile(result.user, { displayName });
      
      // Create user profile in Firestore
      await createUserProfile(result.user);
      
      toast.success('Account created successfully!');
    } catch (error: any) {
      logger.error('Sign up error:', error);
      toast.error(error.message || 'Sign up failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await createUserProfile(result.user);
      toast.success(`Welcome, ${result.user.displayName}!`);
    } catch (error: any) {
      logger.error('Google sign in error:', error);
      toast.error(error.message || 'Google sign in failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      toast.success('Signed out successfully');
    } catch (error: any) {
      logger.error('Sign out error:', error);
      toast.error('Sign out failed');
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success('Password reset email sent!');
    } catch (error: any) {
      logger.error('Password reset error:', error);
      toast.error(error.message || 'Password reset failed');
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<User>) => {
    if (!currentUser) throw new Error('No user logged in');

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(userRef, updateData);
      
      // Update local state
      if (userProfile) {
        setUserProfile({ ...userProfile, ...data } as User);
      }
      
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      logger.error('Profile update error:', error);
      toast.error('Profile update failed');
      throw error;
    }
  };

  const refreshUserProfile = async () => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data() as Omit<User, 'uid'>;
        const fullUser: User = { uid: currentUser.uid, ...userData };
        setUserProfile(fullUser);
      }
    } catch (error) {
      logger.error('Error refreshing user profile:', error);
    }
  };

  const updateAnyUserProfile = async (userId: string, data: Partial<User>) => {
    if (!currentUser) throw new Error('No user logged in');
    if (!userProfile || userProfile.role !== 'admin') {
      throw new Error('Only admins can update other users');
    }

    try {
      const userRef = doc(db, 'users', userId);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(userRef, updateData);
      toast.success('User profile updated successfully!');
    } catch (error: any) {
      logger.error('User profile update error:', error);
      toast.error('User profile update failed');
      throw error;
    }
  };

  const createUser = async (email: string, password: string, displayName: string, role: 'organizer' | 'admin'): Promise<User> => {
    if (!currentUser) throw new Error('No user logged in');
    if (!userProfile || userProfile.role !== 'admin') {
      throw new Error('Only admins can create users');
    }

    try {
      // Create a secondary Firebase app instance for user creation
      const firebaseConfig = {
        apiKey: (import.meta as any).env.VITE_FIREBASE_API_KEY,
        authDomain: (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: (import.meta as any).env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: (import.meta as any).env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: (import.meta as any).env.VITE_FIREBASE_APP_ID,
        measurementId: (import.meta as any).env.VITE_FIREBASE_MEASUREMENT_ID
      };

      const secondaryApp = initializeApp(firebaseConfig, 'secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      // Create user with secondary auth instance
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;
      
      // Update display name in Firebase Auth
      await updateProfile(newUser, { displayName });
      
      // Create user profile in Firestore
      const userRef = doc(db, 'users', newUser.uid);
      const newUserProfile: Omit<User, 'uid'> = {
        email: email,
        displayName: displayName,
        photoURL: newUser.photoURL || '',
        role: role,
        phoneNumber: '',
        organization: '',
        bio: '',
        skills: [],
        socialLinks: {
          linkedin: '',
          twitter: '',
          github: '',
          website: ''
        },
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };
      
      await setDoc(userRef, newUserProfile);
      
      // Send password reset email so the user can set their own password
      await sendPasswordResetEmail(secondaryAuth, email);
      
      // Sign out the newly created user (this doesn't affect the admin session)
      await signOut(secondaryAuth);
      
      // Clean up secondary app
      try {
        (secondaryApp as any).delete?.();
      } catch (cleanupError) {
        logger.warn('Failed to clean up secondary app:', cleanupError);
      }
      
      const fullUser: User = { uid: newUser.uid, ...newUserProfile } as User;
      toast.success(`User ${displayName} created successfully! Password reset email sent.`);
      
      return fullUser;
      
    } catch (error: any) {
      logger.error('User creation error:', error);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email is already in use');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address');
      } else {
        toast.error('Failed to create user');
      }
      
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      logger.log('Auth state changed:', user ? `User: ${user.uid} (${user.email})` : 'No user');
      if (user) {
        setCurrentUser(user);
        try {
          await createUserProfile(user);
        } catch (error) {
          logger.error('Failed to create/load user profile:', error);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    refreshUserProfile,
    updateAnyUserProfile,
    createUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
