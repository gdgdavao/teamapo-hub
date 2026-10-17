import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { toastError, toastSuccess, mockSignIn, mockSignInWithGoogle } = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  mockSignIn: vi.fn(),
  mockSignInWithGoogle: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: toastError,
    success: toastSuccess,
  },
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signInWithGoogle: mockSignInWithGoogle,
    currentUser: null,
    userProfile: null,
    loading: false,
  }),
}));

vi.mock('@/config/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('firebase/auth', () => ({
  setPersistence: vi.fn(async () => {}),
  browserLocalPersistence: {},
  browserSessionPersistence: {},
}));

vi.mock('@/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import LoginPage from '@/pages/auth/LoginPage';

describe('LoginPage error presentation & toast de-duplication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders inline error alert for invalid credentials and does NOT trigger toast.error', async () => {
    const user = userEvent.setup();
    mockSignIn.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
      message: 'Firebase: Error (auth/invalid-credential).',
    });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const submitButton = screen.getByRole('button', { name: /^sign in$/i });

    await user.type(emailInput, 'organizer@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);

    // Verify inline error alert appears with friendly text
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Invalid email or password. Please try again.');
    });

    // Verify toast.error is strictly NOT invoked
    expect(toastError).not.toHaveBeenCalled();
  });

  it('renders inline cancellation alert for Google popup dismissal without toast', async () => {
    const user = userEvent.setup();
    mockSignInWithGoogle.mockRejectedValueOnce({
      code: 'auth/popup-closed-by-user',
      message: 'Firebase: Error (auth/popup-closed-by-user).',
    });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    await user.click(googleButton);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Sign-in cancelled.');
    });

    expect(toastError).not.toHaveBeenCalled();
  });

  it('renders friendly rate limit message when too many attempts occur', async () => {
    const user = userEvent.setup();
    mockSignIn.mockRejectedValueOnce({
      code: 'auth/too-many-requests',
      message: 'Firebase: Error (auth/too-many-requests).',
    });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const submitButton = screen.getByRole('button', { name: /^sign in$/i });

    await user.type(emailInput, 'organizer@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(
        'Too many failed attempts. Please wait a moment and try again.'
      );
    });

    expect(toastError).not.toHaveBeenCalled();
  });

  it('clears previous inline error upon a new submission attempt', async () => {
    const user = userEvent.setup();
    mockSignIn.mockRejectedValueOnce({
      code: 'auth/invalid-credential',
    });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const submitButton = screen.getByRole('button', { name: /^sign in$/i });

    await user.type(emailInput, 'organizer@example.com');
    await user.type(passwordInput, 'badpass');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Subsequent successful submission
    mockSignIn.mockResolvedValueOnce(undefined);
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('renders inline error alert when Google sign-in encounters an unprovisioned account', async () => {
    const user = userEvent.setup();
    mockSignInWithGoogle.mockRejectedValueOnce({
      code: 'auth/unprovisioned-account',
      message:
        'Your Google account (unprovisioned@gmail.com) has not been provisioned as an organizer or admin. Please contact an administrator to invite you.',
    });

    render(
      <MemoryRouter initialEntries={['/auth/login']}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    );

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    await user.click(googleButton);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/not been provisioned as an organizer or admin/i);
    });

    expect(toastError).not.toHaveBeenCalled();
  });
});
