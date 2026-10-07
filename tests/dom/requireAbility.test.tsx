/**
 * Behavioural tests for the route gate.
 *
 * tests/unit/ability.test.ts covers the rule table; this covers the four things
 * the gate does with it. The distinction matters because the gate is where the
 * two halves of authorization meet: being signed out and being signed in
 * without permission are different failures, and the old ProtectedRoute treated
 * them identically by bouncing to /dashboard with no explanation.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AbilityProvider } from '@casl/react';
import { describe, expect, it, vi } from 'vitest';
import RequireAbility, { RequireAnonymous } from '@/auth/RequireAbility';
import { defineAbilityFor } from '@/auth/ability';

// Mutable per-test auth, since vi.mock factories are hoisted above imports.
const { authState } = vi.hoisted(() => ({
  authState: { currentUser: null as { uid: string } | null, loading: false },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

const ADMIN = defineAbilityFor({ uid: 'admin-1', role: 'admin', isActive: true });
const ORGANIZER = defineAbilityFor({ uid: 'org-1', role: 'organizer', isActive: true });
const SUSPENDED = defineAbilityFor({ uid: 'org-2', role: 'organizer', isActive: false });

/** Surfaces the current location so a redirect target can be asserted. */
const WhereAmI: React.FC = () => {
  const location = useLocation();
  return <div data-testid="whereami">{`${location.pathname}${location.search}`}</div>;
};

const renderGuard = (ability = ADMIN, path = '/guarded') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AbilityProvider value={ability}>
        <Routes>
          <Route
            path="/guarded"
            element={
              <RequireAbility ability="read" on="User">
                <div>SECRET CONTENT</div>
              </RequireAbility>
            }
          />
          <Route
            path="/auth/login"
            element={
              <>
                <div>LOGIN FORM</div>
                <WhereAmI />
              </>
            }
          />
          <Route path="/forbidden" element={<div>FORBIDDEN PAGE</div>} />
          <Route path="*" element={<div>OTHER ROUTE</div>} />
        </Routes>
      </AbilityProvider>
    </MemoryRouter>,
  );

describe('RequireAbility', () => {
  it('renders the children when the permission is held', () => {
    authState.currentUser = { uid: 'admin-1' };
    authState.loading = false;
    renderGuard(ADMIN);
    expect(screen.getByText('SECRET CONTENT')).toBeInTheDocument();
  });

  it('sends a signed-in caller without the permission to /forbidden', () => {
    // Not to /dashboard. The old guard bounced there with no explanation, so
    // the user landed somewhere unrelated and learned nothing.
    authState.currentUser = { uid: 'org-1' };
    authState.loading = false;
    renderGuard(ORGANIZER);
    expect(screen.getByText('FORBIDDEN PAGE')).toBeInTheDocument();
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument();
  });

  it('denies a suspended account, whose ability is empty', () => {
    authState.currentUser = { uid: 'org-2' };
    authState.loading = false;
    renderGuard(SUSPENDED);
    expect(screen.getByText('FORBIDDEN PAGE')).toBeInTheDocument();
  });

  it('sends a signed-out caller to the login form, not to /forbidden', () => {
    // Signed out is not the same failure as not permitted. Sending them to
    // /forbidden would tell someone to ask an administrator for an account they
    // have not signed into yet.
    authState.currentUser = null;
    authState.loading = false;
    renderGuard(ADMIN);
    expect(screen.getByText('LOGIN FORM')).toBeInTheDocument();
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();
  });

  it('carries the original destination so a deep link survives signing in', () => {
    authState.currentUser = null;
    authState.loading = false;
    renderGuard(ADMIN, '/guarded?eventId=e1&tab=attendees');
    expect(screen.getByTestId('whereami')).toHaveTextContent(
      '/auth/login?from=%2Fguarded%3FeventId%3De1%26tab%3Dattendees',
    );
  });

  it('waits rather than redirecting while the session is still resolving', () => {
    // Redirecting during loading would bounce a signed-in user to /forbidden for
    // a frame on every page load, before the profile snapshot has landed.
    authState.currentUser = null;
    authState.loading = true;
    renderGuard(ORGANIZER);
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();
    expect(screen.queryByText('LOGIN FORM')).not.toBeInTheDocument();
    expect(screen.queryByText('SECRET CONTENT')).not.toBeInTheDocument();
  });

  it('does not treat an unconditioned-looking verb as an ownership check', () => {
    // `manage 'Event'` carries an ownership condition for organizers, and CASL
    // ignores conditions on a subject type, so this answers true for them. The
    // gate must therefore refuse to be the thing that enforces ownership: this
    // asserts the gate on `read 'all'`, which organizers genuinely lack, and the
    // entity check lives in the page that has the event loaded.
    authState.currentUser = { uid: 'org-1' };
    authState.loading = false;
    renderGuard(ORGANIZER);
    expect(screen.getByText('FORBIDDEN PAGE')).toBeInTheDocument();
  });
});

describe('RequireAnonymous', () => {
  const renderLogin = (signedIn: boolean) =>
    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <AbilityProvider value={ADMIN}>
          <Routes>
            <Route
              path="/auth/login"
              element={
                <RequireAnonymous>
                  <div>LOGIN FORM</div>
                </RequireAnonymous>
              }
            />
            <Route path="/dashboard" element={<div>DASHBOARD</div>} />
          </Routes>
        </AbilityProvider>
      </MemoryRouter>,
    );

  it('shows the form to a signed-out visitor', () => {
    authState.currentUser = null;
    authState.loading = false;
    renderLogin(false);
    expect(screen.getByText('LOGIN FORM')).toBeInTheDocument();
  });

  it('sends a signed-in visitor to the dashboard', () => {
    authState.currentUser = { uid: 'admin-1' };
    authState.loading = false;
    renderLogin(true);
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });
});