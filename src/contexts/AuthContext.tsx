import React, { createContext, useContext, useEffect, useState } from 'react';
// TODO: Uncomment Firebase imports when ready to use Firebase
/*
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
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
*/
import { User } from '../types';
import toast from 'react-hot-toast';

// Mock Firebase User type for development
interface MockFirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Sample users for development/testing
const SAMPLE_USERS: User[] = [
  {
    uid: 'admin-001',
    email: 'admin@gdgdavao.org',
    displayName: 'Admin User',
    role: 'admin',
    photoURL: undefined,
    createdAt: new Date('2024-01-01') as any,
    updatedAt: new Date() as any,
  },
  {
    uid: 'organizer-001',
    email: 'organizer@gdgdavao.org',
    displayName: 'Event Organizer',
    role: 'organizer',
    photoURL: undefined,
    createdAt: new Date('2024-01-15') as any,
    updatedAt: new Date() as any,
  },
  {
    uid: 'attendee-001',
    email: 'attendee@example.com',
    displayName: 'John Attendee',
    role: 'attendee',
    photoURL: undefined,
    createdAt: new Date('2024-02-01') as any,
    updatedAt: new Date() as any,
  },
];

// Mock credentials (password is always "password123" for all users)
const MOCK_CREDENTIALS = [
  { email: 'admin@gdgdavao.org', password: 'password123' },
  { email: 'organizer@gdgdavao.org', password: 'password123' },
  { email: 'attendee@example.com', password: 'password123' },
];

interface AuthContextType {
  currentUser: MockFirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<MockFirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(false); // Changed to false since we're not using Firebase

  // TODO: Uncomment and implement when Firebase is ready
  /*
  const createUserProfile = async (user: FirebaseUser, additionalData?: any) => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      const { displayName, email, photoURL } = user;
      const newUser: Omit<User, 'uid'> = {
        email: email!,
        displayName: displayName || email!.split('@')[0],
        photoURL: photoURL || undefined,
        role: 'attendee',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...additionalData,
      };

      try {
        await setDoc(userRef, newUser);
        const fullUser: User = { uid: user.uid, ...newUser } as User;
        setUserProfile(fullUser);
        return fullUser;
      } catch (error) {
        console.error('Error creating user profile:', error);
        throw error;
      }
    } else {
      const userData = userSnap.data() as Omit<User, 'uid'>;
      const fullUser: User = { uid: user.uid, ...userData };
      setUserProfile(fullUser);
      return fullUser;
    }
  };
  */

  // Mock implementations for development
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      // Check if credentials match our sample users
      const credentialMatch = MOCK_CREDENTIALS.find(
        cred => cred.email === email && cred.password === password
      );
      
      if (!credentialMatch) {
        throw new Error('Invalid credentials');
      }
      
      // Find the corresponding user profile
      const userProfile = SAMPLE_USERS.find(user => user.email === email);
      
      if (!userProfile) {
        throw new Error('User profile not found');
      }
      
      // Mock successful sign in
      const mockUser: MockFirebaseUser = {
        uid: userProfile.uid,
        email: userProfile.email,
        displayName: userProfile.displayName,
        photoURL: userProfile.photoURL || null,
      };
      
      setCurrentUser(mockUser);
      setUserProfile(userProfile);
      
      toast.success(`Welcome back, ${userProfile.displayName}! (${userProfile.role})`);
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      setLoading(true);
      
      // Check if user already exists
      const existingUser = SAMPLE_USERS.find(user => user.email === email);
      if (existingUser) {
        throw new Error('User already exists');
      }
      
      // Create new user
      const newUserId = 'user-' + Date.now();
      const mockUser: MockFirebaseUser = {
        uid: newUserId,
        email,
        displayName,
        photoURL: null,
      };
      
      // Determine role based on email domain (for demo purposes)
      let role: 'admin' | 'organizer' | 'attendee' = 'attendee';
      if (email.includes('@gdgdavao.org')) {
        role = email.includes('admin') ? 'admin' : 'organizer';
      }
      
      const mockProfile: User = {
        uid: mockUser.uid,
        email: mockUser.email!,
        displayName: mockUser.displayName!,
        role,
        photoURL: undefined,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };
      
      setCurrentUser(mockUser);
      setUserProfile(mockProfile);
      
      toast.success(`Account created successfully! Role: ${role}`);
    } catch (error: any) {
      toast.error(error.message || 'Signup failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      // Mock Google sign in
      const mockUser: MockFirebaseUser = {
        uid: 'mock-google-user-id',
        email: 'mock@gmail.com',
        displayName: 'Mock Google User',
        photoURL: null,
      };
      setCurrentUser(mockUser);
      
      const mockProfile: User = {
        uid: mockUser.uid,
        email: mockUser.email!,
        displayName: mockUser.displayName!,
        role: 'attendee',
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };
      setUserProfile(mockProfile);
      
      toast.success('Signed in with Google! (Mock)');
    } catch (error: any) {
      toast.error('Mock Google sign in failed');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setCurrentUser(null);
      setUserProfile(null);
      toast.success('Signed out successfully (Mock)');
    } catch (error: any) {
      toast.error('Mock sign out failed');
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      toast.success('Password reset email sent! (Mock)');
    } catch (error: any) {
      toast.error('Mock password reset failed');
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<User>) => {
    if (!currentUser) throw new Error('No user logged in');

    try {
      // Mock profile update
      if (userProfile) {
        setUserProfile({ ...userProfile, ...data } as User);
      }
      
      toast.success('Profile updated successfully! (Mock)');
    } catch (error: any) {
      toast.error('Mock profile update failed');
      throw error;
    }
  };

  // Mock auth state change effect
  useEffect(() => {
    setLoading(false);
    // No Firebase auth state listener in mock mode
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
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 