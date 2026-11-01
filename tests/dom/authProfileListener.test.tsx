import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

const {
  mockSignOut,
  mockOnAuthStateChanged,
  mockOnSnapshot,
  mockGetIdToken,
  mockToastError,
} = vi.hoisted(() => ({
  mockSignOut: vi.fn(async () => {}),
  mockOnAuthStateChanged: vi.fn(),
  mockOnSnapshot: vi.fn(),
  mockGetIdToken: vi.fn(async () => 'fresh-token-123'),
  mockToastError: vi.fn(),
}));

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    signOut: mockSignOut,
    onAuthStateChanged: mockOnAuthStateChanged,
    getRedirectResult: vi.fn(async () => null),
  };
});

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    onSnapshot: mockOnSnapshot,
    doc: vi.fn(() => ({ id: 'mock-doc' })),
  };
});

vi.mock('react-hot-toast', () => ({
  default: {
    error: mockToastError,
    success: vi.fn(),
  },
  toast: {
    error: mockToastError,
    success: vi.fn(),
  },
}));

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

describe('AuthContext profile listener retry & resilience contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does NOT sign out on transient unauthenticated error if subsequent snapshot succeeds', async () => {
    const mockUser = {
      uid: 'user-tab-race-1',
      email: 'organizer@gdgdavao.org',
      getIdToken: mockGetIdToken,
    };

    let authCallback: ((user: any) => void) | null = null;
    mockOnAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      authCallback = cb;
      return () => {};
    });

    let snapshotSuccessCb: ((snap: any) => void) | null = null;
    let snapshotErrorCb: ((err: any) => void) | null = null;

    mockOnSnapshot.mockImplementation((_docRef: any, success: any, error: any) => {
      snapshotSuccessCb = success;
      snapshotErrorCb = error;
      return () => {};
    });

    renderHook(() => useAuth(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    });

    // Simulate multi-tab cold start emitting user
    act(() => {
      authCallback?.(mockUser);
    });

    expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

    // Simulate initial cold-boot race: Firestore unauthenticated error
    act(() => {
      snapshotErrorCb?.({ code: 'unauthenticated', message: 'Auth token not yet restored' });
    });

    // Invariant: MUST NOT immediately sign out
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();

    // Advance timer past first backoff (500ms)
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockOnSnapshot).toHaveBeenCalledTimes(2);

    // Simulate successful snapshot on retry
    act(() => {
      snapshotSuccessCb?.({
        data: () => ({
          email: 'organizer@gdgdavao.org',
          displayName: 'GDG Organizer',
          role: 'organizer',
          isActive: true,
        }),
      });
    });

    // Still no signOut
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('refreshes auth token before final session termination when retries exhaust', async () => {
    const mockUser = {
      uid: 'user-tab-exhaust-1',
      email: 'organizer@gdgdavao.org',
      getIdToken: mockGetIdToken,
    };

    let authCallback: ((user: any) => void) | null = null;
    mockOnAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      authCallback = cb;
      return () => {};
    });

    let snapshotErrorCb: ((err: any) => void) | null = null;

    mockOnSnapshot.mockImplementation((_docRef: any, _success: any, error: any) => {
      snapshotErrorCb = error;
      return () => {};
    });

    renderHook(() => useAuth(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <AuthProvider>{children}</AuthProvider>
      ),
    });

    act(() => {
      authCallback?.(mockUser);
    });

    // Step through the 5 retry delays: 500, 1000, 2000, 4000, 8000
    const delays = [500, 1000, 2000, 4000, 8000];
    for (let i = 0; i < delays.length; i++) {
      act(() => {
        snapshotErrorCb?.({ code: 'unavailable', message: 'Transport error' });
      });
      act(() => {
        vi.advanceTimersByTime(delays[i]);
      });
    }

    // Retries exhausted: trigger next error
    act(() => {
      snapshotErrorCb?.({ code: 'permission-denied', message: 'Rules refusal' });
    });

    // Run pending microtasks for getIdToken
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockGetIdToken).toHaveBeenCalledWith(true);
  });
});
