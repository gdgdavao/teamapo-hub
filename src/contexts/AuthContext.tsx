import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { logger } from '../utils/logger';
import { User, isRole, type Role } from '../types';
import { defineAbilityFor } from '../auth/ability';
import toast from 'react-hot-toast';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFriendlyAuthErrorMessage } from '../utils/authErrors';
import { AUTH_ACTION_CODE_SETTINGS } from '../config/app';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
  updateAnyUserProfile: (userId: string, data: Partial<User>) => Promise<void>;
  createUser: (email: string, password: string, displayName: string, role: Role, permissions?: User['permissions']) => Promise<User>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const areProfilesEqual = (a: User | null, b: User): boolean => {
  if (!a) return false;
  if (a.uid !== b.uid) return false;
  if (a.email !== b.email) return false;
  if (a.displayName !== b.displayName) return false;
  if (a.photoURL !== b.photoURL) return false;
  if (a.role !== b.role) return false;
  if (a.isActive !== b.isActive) return false;
  if (a.phoneNumber !== b.phoneNumber) return false;
  if (a.organization !== b.organization) return false;
  if (a.bio !== b.bio) return false;
  return JSON.stringify(a.socialLinks || {}) === JSON.stringify(b.socialLinks || {}) &&
         JSON.stringify(a.skills || []) === JSON.stringify(b.skills || []);
};

type AuthErrorLike = {
  code?: string;
  message?: string;
};

/**
 * Firestore listener failures, split by whether a retry can possibly help.
 *
 * `firestore.rules` permits an authenticated caller to read their own users
 * document unconditionally, so `permission-denied` and `unauthenticated` are not
 * transient: they mean the rules or the token changed under us, and retrying
 * would spin forever. Everything else - offline, a dropped socket, backend
 * unavailability - is worth another attempt.
 */
const PERMANENT_PROFILE_ERRORS = new Set(['permission-denied', 'unauthenticated']);

/** Backoff before each retry of a transient failure, in ms. */
const PROFILE_RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

const PROFILE_UNVERIFIABLE =
  'We could not verify your access permissions. Please sign in again, or contact an administrator.';

const PROFILE_OFFLINE =
  'We could not reach the server to verify your account. Please check your connection and try again.';

const getFriendlySignInErrorMessage = (error: AuthErrorLike) =>
  getFriendlyAuthErrorMessage(error, 'Unable to sign in. Please try again.');

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

  /**
   * Holds the unsubscribe for the users-document listener. Kept in a ref
   * because it changes every time the auth session changes, which must not
   * re-run the effect that owns it.
   */
  const stopProfileListener = useRef<(() => void) | null>(null);

  /**
   * A queued retry for a transient listener failure. Held in a ref for the same
   * reason as the unsubscribe above, and cleared alongside it so a pending retry
   * cannot resurrect a listener for an account that has moved on.
   */
  const profileRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Tears down the live subscription and any queued retry. Idempotent, so it is
   * safe to call from a refusal, from a sign-out, and from unmount.
   */
  const cancelProfileWatch = useCallback(() => {
    stopProfileListener.current?.();
    stopProfileListener.current = null;
    if (profileRetryTimer.current !== null) {
      clearTimeout(profileRetryTimer.current);
      profileRetryTimer.current = null;
    }
  }, []);

  /**
   * Ends the session and clears local state. Used for every refusal above.
   *
   * Tears the profile watch down too. Without that, a refusal fired from inside
   * a snapshot or error callback left the subscription live, so it could deliver
   * one more snapshot - or one more retry - after the user had been signed out,
   * writing a profile back into state for an account no longer signed in.
   */
  const endSession = useCallback(async (message: string) => {
    toast.error(message);
    await signOut(auth).catch(() => undefined);
    cancelProfileWatch();
    setCurrentUser(null);
    setUserProfile(null);
    setLoading(false);
  }, [cancelProfileWatch]);

  /**
   * Applies one snapshot of the caller's own users document.
   *
   * Returns a refusal message, or null when the profile is usable. The three
   * refusals are deliberately separate cases:
   *
   *  - no document          -> not provisioned. Provision-only by design:
   *                             firestore.rules requires isAdmin() to create a
   *                             users doc, so self-service signup is denied.
   *  - unrecognised role    -> a corrupt or hand-edited document. The old
   *                             `userSnap.data() as Omit<User,'uid'>` cast
   *                             accepted any string, and RoleBasedDashboard
   *                             rendered the admin dashboard for anything that
   *                             was not literally 'organizer'.
   *  - isActive === false   -> suspended. Strictly `=== false`: a document
   *                             written before the field existed reads back
   *                             undefined, and treating that as suspended would
   *                             lock out every legacy account on deploy. Such a
   *                             profile stays signed in with an empty ability,
   *                             which matches firestore.rules denying anything
   *                             without isActive == true.
   */
  const applyProfile = useCallback((uid: string, data: Record<string, unknown> | undefined): string | null => {
    if (!data) {
      logger.warn('No user document for', uid, '- account is not provisioned');
      return 'This account has not been provisioned. Ask an administrator to create it for you.';
    }

    if (!isRole(data.role)) {
      logger.error('Unrecognised role in users document for', uid, data.role);
      return 'Your account role is not recognised. Contact an administrator.';
    }

    if (data.isActive === false) {
      logger.warn('Account deactivated:', uid);
      return 'This account has been deactivated.';
    }

    const next = { uid, ...data } as User;
    // Keep the previous object when nothing meaningful changed. The ability
    // provider memoises on uid/role/isActive, but holding a stable profile
    // reference also stops every consumer's effect from re-running on an
    // unrelated field such as updatedAt.
    setUserProfile((prev) => (prev && areProfilesEqual(prev, next) ? prev : next));
    return null;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);

      // Verify the user profile document exists in Firestore
      const userSnap = await getDoc(doc(db, 'users', result.user.uid));
      if (!userSnap.exists()) {
        await signOut(auth).catch(() => undefined);
        const err = new Error(
          `Your account (${email}) has not been provisioned as an organizer or admin. Please contact an administrator.`
        );
        (err as any).code = 'auth/unprovisioned-account';
        throw err;
      }

      toast.success(`Welcome back, ${result.user.displayName || email}.`);
      // Deliberately no `setLoading(false)` on success. The profile arrives
      // through the users-document listener, which is what clears `loading`.
      // Clearing it here would clear it a frame early and flash /forbidden
      // before the ability exists.
    } catch (error: any) {
      setLoading(false);
      logger.error('Sign in error:', error);
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);

      // Verify the user profile document exists in Firestore
      const userSnap = await getDoc(doc(db, 'users', result.user.uid));
      if (!userSnap.exists()) {
        const userEmail = result.user.email || 'your account';
        await signOut(auth).catch(() => undefined);
        const err = new Error(
          `Your Google account (${userEmail}) has not been provisioned as an organizer or admin. Please contact an administrator to invite you.`
        );
        (err as any).code = 'auth/unprovisioned-account';
        throw err;
      }

      toast.success(`Welcome, ${result.user.displayName || result.user.email}.`);
    } catch (error: any) {
      setLoading(false);
      logger.error('Google sign in error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      toast.success('Signed out successfully');
    } catch (error: any) {
      logger.error('Sign out error:', error);
      toast.error('Sign out failed. Please try again.');
      throw error;
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email, AUTH_ACTION_CODE_SETTINGS);
      toast.success('Password reset email sent.');
    } catch (error: any) {
      logger.error('Password reset error:', error);
      toast.error(getFriendlyAuthErrorMessage(error, 'Password reset failed. Please try again.'));
      throw error;
    }
  }, []);

  const updateUserProfile = useCallback(async (data: Partial<User>) => {
    if (!currentUser) throw new Error('No user logged in');

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(userRef, updateData);
      
      // Update local state
      setUserProfile(prev => (prev ? ({ ...prev, ...data } as User) : null));
      
      toast.success('Profile updated successfully.');
    } catch (error: any) {
      logger.error('Profile update error:', error);
      toast.error('Profile update failed. Please try again.');
      throw error;
    }
  }, [currentUser]);

  const updateAnyUserProfile = useCallback(async (userId: string, data: Partial<User>) => {
    if (!currentUser) throw new Error('No user logged in');
    if (!defineAbilityFor(userProfile).can('read', 'User')) {
      throw new Error('Only admins can update other users');
    }

    try {
      const userRef = doc(db, 'users', userId);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp(),
      };
      
      await updateDoc(userRef, updateData);
      toast.success('User profile updated successfully.');
    } catch (error: any) {
      logger.error('User profile update error:', error);
      toast.error('User profile update failed. Please try again.');
      throw error;
    }
  }, [currentUser, userProfile]);

  const createUser = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    role: Role,
    permissions?: User['permissions']
  ): Promise<User> => {
    if (!currentUser) throw new Error('No user logged in');
    if (!defineAbilityFor(userProfile).can('create', 'User')) {
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
        // firestore.rules isOrganizer()/isAdmin() read .data.isActive; omitting it
        // makes every subsequent rules check fail for this user.
        isActive: true,
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

      if (role === 'organizer' && permissions) {
        newUserProfile.permissions = permissions;
      }
      
      await setDoc(userRef, newUserProfile);
      
      // Send password reset email so the user can set their own password
      await sendPasswordResetEmail(secondaryAuth, email, AUTH_ACTION_CODE_SETTINGS);
      
      // Sign out the newly created user (this doesn't affect the admin session)
      await signOut(secondaryAuth);
      
      // Clean up secondary app
      try {
        (secondaryApp as any).delete?.();
      } catch (cleanupError) {
        logger.warn('Failed to clean up secondary app:', cleanupError);
      }
      
      const fullUser: User = { uid: newUser.uid, ...newUserProfile } as User;
      toast.success(`User ${displayName} created. Password reset email sent.`);
      
      return fullUser;
      
    } catch (error: any) {
      logger.error('User creation error:', error);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email is already registered. Please sign in instead.');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password does not meet complexity requirements. Please choose a stronger password.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Please enter a valid email address.');
      } else {
        toast.error('Failed to create user. Please try again.');
      }
      
      throw error;
    }
  }, [currentUser, userProfile]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      logger.log('Auth state changed:', user ? `User: ${user.uid} (${user.email})` : 'No user');

      // Always drop the previous listener first, so a sign-out or an account
      // switch cannot leave a stale subscription writing into state.
      cancelProfileWatch();

      if (!user) {
        setCurrentUser(null);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setCurrentUser(user);
      // Ensure the active session is mirrored to browserLocalPersistence so new tabs inherit authentication
      setPersistence(auth, browserLocalPersistence).catch(() => {});

      // Re-arm `loading` for every sign-in that arrives through this listener,
      // not just the cold-start one.
      //
      // A visitor who starts signed out gets setLoading(false) from the initial
      // null emission, and nothing ever set it back: signIn() deliberately does
      // not, because clearing `loading` early is what flashed /forbidden. So on a
      // first sign-in this handler ran with `loading` already false, and
      // RequireAbility - which only gates on `loading` - evaluated
      // `can(ability, subject)` while userProfile was still null. The ability
      // provider builds an empty ability from a null profile, so every check
      // failed and the route redirected to /forbidden one frame before the
      // users-document snapshot arrived and the real ability existed. A return
      // visit did not repro because the session is restored with the user, and
      // `loading` had never been cleared.
      //
      // The invariant is therefore: `loading` is true whenever a Firebase user
      // exists but its profile has not landed. Asserted here, where the
      // subscription is opened, so the email form, the Google popup and any
      // future sign-in path all inherit it.
      setLoading(true);

      // A live listener rather than a one-shot getDoc. A demotion or a
      // suspension applied by another admin previously went unnoticed until the
      // tab was reloaded; now the ability rebuilds the moment the document
      // changes. firestore.rules:68 already permits reading your own document.
      const uid = user.uid;

      const watch = (attempt: number) => {
        stopProfileListener.current = onSnapshot(
          doc(db, 'users', uid),
          async (snap) => {
            const refusal = applyProfile(uid, snap.data());
            if (refusal) {
              await endSession(refusal);
              return;
            }
            setLoading(false);
          },
          (error) => {
            // A listener error is a transport or permission problem, NOT an
            // unprovisioned account. The previous getDoc-based version threw
            // either way, so a dropped connection signed people out.
            //
            // It must NOT clear `loading` while `userProfile` is still null: that
            // is the same empty-ability state as the first-sign-in race above, so
            // RequireAbility would evaluate the gate against a null profile and
            // redirect to /forbidden, claiming the account lacks a permission it
            // was never asked about. A network blip must never look like an
            // authorization decision.
            logger.error('Profile listener error:', error);

            const code = (error as AuthErrorLike | undefined)?.code ?? '';

            if (PERMANENT_PROFILE_ERRORS.has(code)) {
              // Retrying cannot fix this, and an endless spinner is worse than an
              // honest end to the session.
              void endSession(PROFILE_UNVERIFIABLE);
              return;
            }

            const delay = PROFILE_RETRY_DELAYS_MS[attempt];
            if (delay === undefined) {
              logger.error('Profile listener retries exhausted for', uid);
              void endSession(PROFILE_OFFLINE);
              return;
            }

            logger.warn(
              `Profile listener failed (${code || 'unknown'}); retrying in ${delay}ms`,
            );
            profileRetryTimer.current = setTimeout(() => watch(attempt + 1), delay);
          },
        );
      };

      watch(0);
    });

    return () => {
      unsubscribeAuth();
      cancelProfileWatch();
    };
  }, [applyProfile, endSession, cancelProfileWatch]);

  const value: AuthContextType = useMemo(
    () => ({
      currentUser,
      userProfile,
      loading,
      signIn,
      signInWithGoogle,
      logout,
      resetPassword,
      updateUserProfile,
      updateAnyUserProfile,
      createUser,
    }),
    [
      currentUser,
      userProfile,
      loading,
      signIn,
      signInWithGoogle,
      logout,
      resetPassword,
      updateUserProfile,
      updateAnyUserProfile,
      createUser,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
