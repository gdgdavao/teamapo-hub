import React, { useMemo } from 'react';
import { AbilityProvider } from '@casl/react';
import { useAuth } from '../contexts/AuthContext';
import { defineAbilityFor, type AppAbility } from './ability';

/**
 * Publishes the signed-in user's ability to the tree.
 *
 * Must be mounted inside AuthProvider, and above anything that guards on a
 * permission. The ability is memoised on four primitives rather than on
 * `userProfile`, because that object gets a fresh identity on every auth
 * emission and would rebuild the ability - and remount every <Can> subtree -
 * for nothing. Role and isActive changes still rebuild it, which is the point.
 */
const AbilityContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile, currentUser } = useAuth();

  const uid = userProfile?.uid;
  const role = userProfile?.role;
  const isActive = userProfile?.isActive;
  const email = currentUser?.email;

  // Undefined rather than falsy-defaulted: an unset VITE_SUPERUSER_EMAIL must
  // not accidentally match, and a blank value must not either.
  const superUserEmail = import.meta.env.VITE_SUPERUSER_EMAIL || null;
  const isSuperUser = Boolean(email && superUserEmail && email === superUserEmail);

  const ability = useMemo<AppAbility>(() => {
    if (!uid || !role || isActive === undefined) return defineAbilityFor(null);
    return defineAbilityFor({ uid, role, isActive, isSuperUser });
  }, [uid, role, isActive, isSuperUser]);

  return <AbilityProvider value={ability}>{children}</AbilityProvider>;
};

export default AbilityContextProvider;