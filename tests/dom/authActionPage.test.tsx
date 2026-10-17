import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  mockVerifyPasswordResetCode,
  mockConfirmPasswordReset,
  mockApplyActionCode,
  mockCheckActionCode,
} = vi.hoisted(() => ({
  mockVerifyPasswordResetCode: vi.fn(),
  mockConfirmPasswordReset: vi.fn(),
  mockApplyActionCode: vi.fn(),
  mockCheckActionCode: vi.fn(),
}));

vi.mock('firebase/auth', () => ({
  verifyPasswordResetCode: mockVerifyPasswordResetCode,
  confirmPasswordReset: mockConfirmPasswordReset,
  applyActionCode: mockApplyActionCode,
  checkActionCode: mockCheckActionCode,
}));

vi.mock('@/config/firebase', () => ({
  auth: {},
  db: {},
}));

vi.mock('@/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import AuthActionPage from '@/pages/auth/AuthActionPage';

describe('AuthActionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders error state when mode or oobCode is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/action']}>
        <Routes>
          <Route path="/auth/action" element={<AuthActionPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /link expired or invalid/i })).toBeInTheDocument();
    expect(screen.getByText(/this link is invalid or incomplete/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request new password reset/i })).toHaveAttribute(
      'href',
      '/auth/forgot-password'
    );
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute(
      'href',
      '/auth/login'
    );
  });

  it('handles resetPassword: verifies code, validates passwords, and submits reset', async () => {
    const user = userEvent.setup();
    mockVerifyPasswordResetCode.mockResolvedValueOnce('organizer@gdgdavao.org');
    mockConfirmPasswordReset.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter initialEntries={['/auth/action?mode=resetPassword&oobCode=valid-test-code']}>
        <Routes>
          <Route path="/auth/action" element={<AuthActionPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Initial loading or wait for ready
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/enter a new password for organizer@gdgdavao\.org/i)).toBeInTheDocument();

    const newPasswordInput = screen.getByPlaceholderText('At least 8 characters');
    const confirmPasswordInput = screen.getByPlaceholderText('Re-type your new password');
    const submitButton = screen.getByRole('button', { name: /save new password/i });

    // Test password too short (<8 chars)
    await user.type(newPasswordInput, 'short');
    await user.type(confirmPasswordInput, 'short');
    await user.click(submitButton);

    expect(screen.getByRole('alert')).toHaveTextContent(/at least 8 characters/i);
    expect(mockConfirmPasswordReset).not.toHaveBeenCalled();

    // Test password mismatch
    await user.clear(newPasswordInput);
    await user.clear(confirmPasswordInput);
    await user.type(newPasswordInput, 'SecurePassword123!');
    await user.type(confirmPasswordInput, 'DifferentPassword123!');
    await user.click(submitButton);

    expect(screen.getByRole('alert')).toHaveTextContent(/passwords do not match/i);
    expect(mockConfirmPasswordReset).not.toHaveBeenCalled();

    // Test valid matching password
    await user.clear(confirmPasswordInput);
    await user.type(confirmPasswordInput, 'SecurePassword123!');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockConfirmPasswordReset).toHaveBeenCalledWith(
        expect.anything(),
        'valid-test-code',
        'SecurePassword123!'
      );
      expect(screen.getByRole('heading', { name: /password updated/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign in to your account/i })).toHaveAttribute(
        'href',
        '/auth/login'
      );
    });
  });

  it('handles expired resetPassword code gracefully', async () => {
    mockVerifyPasswordResetCode.mockRejectedValueOnce({
      code: 'auth/expired-action-code',
    });

    render(
      <MemoryRouter initialEntries={['/auth/action?mode=resetPassword&oobCode=expired-code']}>
        <Routes>
          <Route path="/auth/action" element={<AuthActionPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /link expired or invalid/i })).toBeInTheDocument();
      expect(screen.getByText(/this link has expired/i)).toBeInTheDocument();
    });
  });

  it('handles verifyEmail successfully', async () => {
    mockApplyActionCode.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter initialEntries={['/auth/action?mode=verifyEmail&oobCode=verify-test-code']}>
        <Routes>
          <Route path="/auth/action" element={<AuthActionPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockApplyActionCode).toHaveBeenCalledWith(expect.anything(), 'verify-test-code');
      expect(screen.getByRole('heading', { name: /email verified/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /sign in to your account/i })).toHaveAttribute(
        'href',
        '/auth/login'
      );
    });
  });

  it('handles recoverEmail successfully and provides reset password link', async () => {
    mockCheckActionCode.mockResolvedValueOnce({
      data: { email: 'recovered@gdgdavao.org' },
    });
    mockApplyActionCode.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter initialEntries={['/auth/action?mode=recoverEmail&oobCode=recover-test-code']}>
        <Routes>
          <Route path="/auth/action" element={<AuthActionPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockCheckActionCode).toHaveBeenCalledWith(expect.anything(), 'recover-test-code');
      expect(mockApplyActionCode).toHaveBeenCalledWith(expect.anything(), 'recover-test-code');
      expect(screen.getByRole('heading', { name: /email address restored/i })).toBeInTheDocument();
      expect(screen.getByText(/recovered@gdgdavao\.org/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /reset your password/i })).toHaveAttribute(
        'href',
        '/auth/forgot-password'
      );
      expect(screen.getByRole('link', { name: /sign in to your account/i })).toHaveAttribute(
        'href',
        '/auth/login'
      );
    });
  });
});
