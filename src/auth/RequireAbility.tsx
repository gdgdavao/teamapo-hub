import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAbility } from '@casl/react';
import { useAuth } from '../contexts/AuthContext';
import type { AppAction, AppSubject } from './ability';
import LoadingSpinner from '../components/shared/UI/LoadingSpinner';

interface RequireAbilityProps {
  children: React.ReactNode;
  /** The permission this route requires, checked against the bare subject. */
  ability: AppAction;
  on: AppSubject;
}

/**
 * Route gate.
 *
 * Replaces the pair of components that used to live in App.tsx:
 * `ProtectedRoute`, which bounced to /dashboard on a role mismatch without
 * saying why, and `PublicRoute`, which sent an already-signed-in visitor away
 * from the login form.
 *
 * Two deliberate constraints on how this may be written:
 *
 *  - Only the unconditioned verbs are usable here. CASL ignores a rule's
 *    conditions when the argument is a subject type rather than an entity, so
 *    `ability="manage" on="Event"` would answer true for an organizer whose
 *    `manage Event` rule carries an ownership condition. Route gates use `read`
 *    and `read 'all'`; ownership is checked against an entity, inside the page
 *    that has it loaded. tests/unit/ability.test.ts pins that behaviour.
 *  - Authentication and permission are different failures and get different
 *    destinations. Signed out goes to the login form carrying ?from=, so the
 *    deep link survives. Signed in but not permitted goes to /forbidden, which
 *    can say what was required.
 */
const RequireAbility: React.FC<RequireAbilityProps> = ({ children, ability, on }) => {
  const { currentUser, loading } = useAuth();
  const granted = useAbility().can(ability, on);
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!currentUser) {
    // Only the path and query, and re-checked by LoginPage, so a hand-edited
    // ?from= cannot turn the login form into an open redirect.
    const from = `${location.pathname}${location.search}`;
    return <Navigate to={`/auth/login?from=${encodeURIComponent(from)}`} replace />;
  }

  if (!granted) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};

/**
 * Inverse gate: signed-in visitors are sent away from the login form.
 * A signed-out visitor still has to get past it to read the form at all.
 */
export const RequireAnonymous: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RequireAbility;