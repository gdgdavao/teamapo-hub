/**
 * The gate only consults `loading`, so the correctness of every redirect rests
 * on AuthContext keeping one invariant: `loading` is true whenever a Firebase
 * user exists but its users-document snapshot has not landed yet.
 *
 * That invariant has a specific way to break, and it broke. A visitor who starts
 * signed out receives the initial null emission from onAuthStateChanged, which
 * clears `loading`. signIn() deliberately never sets it again, because clearing
 * it early is what used to flash /forbidden. So on a FIRST sign-in the auth
 * listener ran with `loading` already false while `userProfile` was still null,
 * the ability provider built an empty ability from that null profile, and every
 * gated route redirected to /forbidden one frame before the snapshot arrived.
 * A second visit never repro'd, because the session is restored together with
 * the user and `loading` had never been cleared - which is exactly why the bug
 * read as "only the first time".
 *
 * This drives AuthProvider against a controllable fake Firebase so the real
 * emission order is exercised, rather than asserting the flag in isolation.
 */
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AbilityProvider } from '@casl/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import RequireAbility from '@/auth/RequireAbility';
import { defineAbilityFor } from '@/auth/ability';

// --- Fake Firebase -----------------------------------------------------------

const { auth, db, emitAuth, authSignOut } = vi.hoisted(() => {
  let authListener: ((u: unknown) => void) | null = null;

  // Spied separately from auth.signOut because AuthContext calls the
  // `firebase/auth` export, not the method on the instance.
  const authSignOut = vi.fn(async () => {});

  return {
    auth: {
      currentUser: null,
      // Firebase's signature is (auth, next). It emits the current state
      // immediately on subscribe, which is the null emission that clears
      // `loading` on a cold start.
      onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
        authListener = cb;
        cb(null);
        return () => {
          authListener = null;
        };
      },
      signOut: authSignOut,
    },
    db: {},
    emitAuth: (user: unknown) => authListener?.(user),
    authSignOut,
  };
});

vi.mock('@/config/firebase', () => ({ auth, db, storage: {} }));

vi.mock('firebase/firestore', () => ({
  doc: () => ({ path: 'users/u1' }),
  onSnapshot: (_ref: unknown, ok: (s: unknown) => void, err: (e: unknown) => void) => {
    const g = globalThis as unknown as Record<string, unknown>;
    g.__snapOk = ok;
    g.__snapErr = err;
    g.__snapCount = ((g.__snapCount as number) ?? 0) + 1;
    return () => {
      g.__snapUnsubscribed = ((g.__snapUnsubscribed as number) ?? 0) + 1;
    };
  },
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  // AuthContext imports signOut from 'firebase/auth', not off the auth instance,
  // so this is the export endSession actually calls and the one worth spying.
  signOut: authSignOut,
  onAuthStateChanged: auth.onAuthStateChanged,
  updateProfile: vi.fn(),
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  getAuth: () => auth,
  setPersistence: vi.fn(async () => {}),
  browserLocalPersistence: {},
}));

vi.mock('firebase/app', () => ({ initializeApp: () => ({ delete: () => {} }) }));

vi.mock('@/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock('react-hot-toast', () => ({
  default: { error: toastError, success: vi.fn() },
}));

const { AuthProvider, useAuth } = await import('@/contexts/AuthContext');

const ADMIN_DOC = {
  email: 'admin@example.test',
  displayName: 'Admin',
  role: 'admin',
  isActive: true,
  phoneNumber: '',
  organization: '',
  bio: '',
  skills: [],
  socialLinks: {},
};

/** Mirrors AbilityProvider's real derivation, including the null-profile case. */
const AbilityMirror: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const uid = userProfile?.uid;
  const role = userProfile?.role;
  const isActive = userProfile?.isActive;
  const ability =
    !uid || !role || isActive === undefined
      ? defineAbilityFor(null)
      : defineAbilityFor({ uid, role, isActive, isSuperUser: false });
  return <AbilityProvider value={ability}>{children}</AbilityProvider>;
};

/** Reports the gate's verdict so the redirect target can be read. */
const Probe: React.FC = () => {
  const { loading, userProfile } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="profile">{userProfile ? userProfile.role : 'none'}</span>
    </div>
  );
};

/**
 * Stands in for LoginPage: once a user is signed in, send them back to the
 * deep link the gate preserved. The real app does this too, so without it the
 * router stays parked on /auth/login and the guarded route never re-mounts -
 * which would test nothing about the gate.
 */
const LoginStub: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div>LOGIN LOADING</div>;
  if (currentUser) {
    const from = new URLSearchParams(location.search).get('from') ?? '/dashboard';
    return <Navigate to={from} replace />;
  }
  return <div>LOGIN FORM</div>;
};

const App = () => (
  <MemoryRouter initialEntries={['/dashboard']}>
    <AuthProvider>
      <AbilityMirror>
        <Probe />
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RequireAbility ability="read" on="Event">
                <div>DASHBOARD LOADED</div>
              </RequireAbility>
            }
          />
          <Route path="/auth/login" element={<LoginStub />} />
          <Route path="/forbidden" element={<div>FORBIDDEN PAGE</div>} />
          <Route path="*" element={<div>NOWHERE</div>} />
        </Routes>
      </AbilityMirror>
    </AuthProvider>
  </MemoryRouter>
);

beforeEach(() => {
  // Fresh listener slots between tests.
  const g = globalThis as unknown as Record<string, unknown>;
  g.__snapOk = undefined;
  g.__snapErr = undefined;
  g.__snapCount = 0;
  g.__snapUnsubscribed = 0;
  authSignOut.mockClear();
  vi.useRealTimers();
});

describe('first sign-in does not bounce to /forbidden', () => {
  it('keeps loading true from the moment a user appears until the profile lands', async () => {
    render(<App />);

    // Cold start: Firebase emits null synchronously, so `loading` is false and
    // the visitor is on the login form. This is the state that used to leak.
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    // The user signs in. currentUser is now set but the profile has not arrived.
    await act(async () => {
      emitAuth({ uid: 'u1', email: 'admin@example.test' });
    });

    const snapOk = (globalThis as unknown as {
      __snapOk?: (s: unknown) => void;
    }).__snapOk;
    expect(snapOk, 'a users-document subscription was opened').toBeTypeOf('function');

    // THE ASSERTION. Before the fix this read "false", which let RequireAbility
    // evaluate the ability against a null profile and redirect to /forbidden.
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('profile')).toHaveTextContent('none');
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();

    // Profile arrives: the ability becomes real and the dashboard is allowed.
    await act(async () => {
      snapOk?.({ data: () => ADMIN_DOC });
    });

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByText('DASHBOARD LOADED')).toBeInTheDocument();
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();
  });

  it('still clears loading once the profile resolves, so the gate cannot hang', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      emitAuth({ uid: 'u1', email: 'admin@example.test' });
    });
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    const snapOk = (globalThis as unknown as {
      __snapOk?: (s: unknown) => void;
    }).__snapOk;
    await act(async () => {
      snapOk?.({ data: () => ADMIN_DOC });
    });

    // The counterweight to the assertion above: without this, the fix would have
    // replaced the forbidden redirect with a permanent spinner.
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByText('DASHBOARD LOADED')).toBeInTheDocument();
  });

  it('re-arms loading on a subsequent account switch too', async () => {
    // Not only the cold-start path: signing out and back in, or switching
    // accounts in the same tab, must not reuse the previous profile's ability.
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));

    await act(async () => {
      emitAuth({ uid: 'u1', email: 'admin@example.test' });
    });
    const snapOk = (globalThis as unknown as {
      __snapOk?: (s: unknown) => void;
    }).__snapOk;
    await act(async () => {
      snapOk?.({ data: () => ADMIN_DOC });
    });
    await waitFor(() => expect(screen.getByText('DASHBOARD LOADED')).toBeInTheDocument());

    await act(async () => {
      emitAuth(null);
    });
    await act(async () => {
      emitAuth({ uid: 'u2', email: 'organizer@example.test' });
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('profile')).toHaveTextContent('none');
  });
});

describe('a failed profile read is never reported as a permission denial', () => {
  const g = globalThis as unknown as {
    __snapOk?: (s: unknown) => void;
    __snapErr?: (e: unknown) => void;
    __snapCount?: number;
    __snapUnsubscribed?: number;
  };

  /** Cold start, then sign in. Returns once the subscription is open. */
  const signIn = async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await act(async () => {
      emitAuth({ uid: 'u1', email: 'admin@example.test' });
    });
    expect(g.__snapErr, 'a users-document subscription was opened').toBeTypeOf('function');
  };

  it('keeps waiting and retries a transient error instead of bouncing to /forbidden', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signIn();

    await act(async () => {
      g.__snapErr?.({ code: 'unavailable', message: 'backend down' });
    });

    // THE ASSERTION. Before this fix the error handler called setLoading(false)
    // with userProfile still null, the gate evaluated an empty ability, and the
    // route redirected to /forbidden - telling the user their account lacks a
    // permission, over what was a dropped connection.
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    expect(screen.getByTestId('profile')).toHaveTextContent('none');
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();
    expect(screen.queryByText('LOGIN FORM')).not.toBeInTheDocument();
    expect(authSignOut).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();

    // And it genuinely retries rather than sitting dead.
    expect(g.__snapCount).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(g.__snapCount, 'a second subscription was opened after the backoff').toBe(2);
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();
  });

  it('recovers when a retry succeeds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signIn();

    await act(async () => {
      g.__snapErr?.({ code: 'unavailable' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(g.__snapCount).toBe(2);

    await act(async () => {
      g.__snapOk?.({ data: () => ADMIN_DOC });
    });

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByText('DASHBOARD LOADED')).toBeInTheDocument();
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();
    expect(authSignOut).not.toHaveBeenCalled();
  });

  it('ends the session on a permanent error instead of retrying forever', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signIn();
    const before = g.__snapCount;

    await act(async () => {
      g.__snapErr?.({ code: 'permission-denied', message: 'Missing or insufficient permissions' });
    });

    // Reading your own users document is unconditional in firestore.rules, so
    // this cannot resolve itself. An endless spinner would be worse than an
    // honest end, but /forbidden would be a lie.
    expect(authSignOut).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining('could not verify your access permissions'),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(g.__snapCount, 'no retry was scheduled for a permanent error').toBe(before);
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();
  });

  it('gives up with a network message once the retries are exhausted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signIn();

    // Drive it until the budget runs out rather than counting delays by hand:
    // the retry schedule is 500/1000/2000/4000/8000, so exhaustion happens on
    // the attempt *after* the last scheduled one.
    for (let i = 0; i < 12 && authSignOut.mock.calls.length === 0; i++) {
      await act(async () => {
        g.__snapErr?.({ code: 'unavailable' });
        await vi.advanceTimersByTimeAsync(9000);
      });
    }

    expect(authSignOut).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('could not reach the server'));

    // Giving up must stop the retry loop. Asserted on subscriptions opened rather
    // than on signOut calls: this fake hands out a direct reference to the error
    // callback, so it can be invoked by hand after teardown, which real Firestore
    // would never do. "No further subscription" is the honest invariant.
    const subsAtGiveUp = g.__snapCount;
    await act(async () => {
      g.__snapErr?.({ code: 'unavailable' });
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(g.__snapCount, 'no further subscription after giving up').toBe(subsAtGiveUp);

    // And the teardown actually happened, rather than the watch being abandoned.
    expect(g.__snapUnsubscribed ?? 0).toBeGreaterThan(0);
  });

  it('cancels a queued retry when the session ends, so it cannot resurrect a listener', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signIn();
    const afterSignIn = g.__snapCount ?? 0;

    await act(async () => {
      g.__snapErr?.({ code: 'unavailable' }); // queues a 500ms retry
    });

    await act(async () => {
      emitAuth(null); // sign out before it fires
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(g.__snapCount, 'no subscription was opened after sign-out').toBe(afterSignIn);
  });
});

describe('a refusal tears down the watch that produced it', () => {
  const g = globalThis as unknown as {
    __snapOk?: (s: unknown) => void;
    __snapErr?: (e: unknown) => void;
    __snapCount?: number;
    __snapUnsubscribed?: number;
  };

  it('unsubscribes when the account is not provisioned', async () => {
    // applyProfile returns the refusal from inside the snapshot callback, so
    // endSession runs with the subscription still live. Without an explicit
    // teardown it could deliver another snapshot - or another retry - for an
    // account that has just been signed out.
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await act(async () => {
      emitAuth({ uid: 'u1', email: 'stranger@example.test' });
    });

    await act(async () => {
      g.__snapOk?.({ data: () => undefined }); // no users document
    });

    expect(authSignOut).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('has not been provisioned'));

    // The refusal must not masquerade as an authorization decision.
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();
    expect(g.__snapUnsubscribed ?? 0).toBeGreaterThan(0);
  });

  it('unsubscribes when the account is deactivated', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await act(async () => {
      emitAuth({ uid: 'u1', email: 'suspended@example.test' });
    });

    await act(async () => {
      g.__snapOk?.({ data: () => ({ ...ADMIN_DOC, isActive: false }) });
    });

    expect(authSignOut).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('has been deactivated'));
    expect(g.__snapUnsubscribed ?? 0).toBeGreaterThan(0);
  });

  it('treats an unrecognised role as a corrupt document, not as an organizer', async () => {
    // The old dashboard read `role === 'organizer' ? scoped : platform`, so any
    // other string rendered the platform-wide view. An empty ability is the safe
    // reading, and the session is ended rather than guessed at.
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    await act(async () => {
      emitAuth({ uid: 'u1', email: 'corrupt@example.test' });
    });

    await act(async () => {
      g.__snapOk?.({ data: () => ({ ...ADMIN_DOC, role: 'superadmin' }) });
    });

    expect(authSignOut).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('role is not recognised'));
    expect(screen.queryByText('FORBIDDEN PAGE')).not.toBeInTheDocument();
  });
});
