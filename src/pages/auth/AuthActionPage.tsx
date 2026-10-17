import React, { useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth';
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { auth } from '../../config/firebase';
import { Button, Input } from '../../components/UI';
import AuthShell from './AuthShell';
import usePageTitle from '../../hooks/usePageTitle';
import { logger } from '../../utils/logger';

type ActionStatus = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

const AuthActionPage: React.FC = () => {
  usePageTitle();
  const [searchParams] = useSearchParams();

  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode');

  const [status, setStatus] = useState<ActionStatus>('loading');
  const [accountEmail, setAccountEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const passwordId = useId();
  const confirmPasswordId = useId();

  useEffect(() => {
    if (!oobCode || !mode) {
      setErrorMessage('This link is invalid or incomplete. Please check the URL or request a new link.');
      setStatus('error');
      return;
    }

    let isMounted = true;

    const processActionCode = async () => {
      try {
        switch (mode) {
          case 'resetPassword': {
            const email = await verifyPasswordResetCode(auth, oobCode);
            if (!isMounted) return;
            setAccountEmail(email);
            setStatus('ready');
            break;
          }
          case 'verifyEmail': {
            await applyActionCode(auth, oobCode);
            if (!isMounted) return;
            setStatus('success');
            break;
          }
          case 'recoverEmail': {
            const info = await checkActionCode(auth, oobCode);
            await applyActionCode(auth, oobCode);
            if (!isMounted) return;
            setAccountEmail(info.data.email || '');
            setStatus('success');
            break;
          }
          default:
            if (!isMounted) return;
            setErrorMessage(`Unsupported action mode: "${mode}". Please contact support.`);
            setStatus('error');
        }
      } catch (err: any) {
        logger.error('Error handling auth action code:', err);
        if (!isMounted) return;
        const code = err?.code;
        if (code === 'auth/expired-action-code') {
          setErrorMessage('This link has expired. Please request a new one.');
        } else if (code === 'auth/invalid-action-code') {
          setErrorMessage('This link is invalid or has already been used. Please request a new one.');
        } else if (code === 'auth/user-disabled') {
          setErrorMessage('This account has been deactivated. Please contact an administrator.');
        } else {
          setErrorMessage('We could not complete this action. The link may have expired or already been used.');
        }
        setStatus('error');
      }
    };

    void processActionCode();

    return () => {
      isMounted = false;
    };
  }, [mode, oobCode]);

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please verify both fields.');
      return;
    }

    if (!oobCode) {
      setFormError('Missing reset token. Please request a new link.');
      return;
    }

    setStatus('submitting');
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus('success');
    } catch (err: any) {
      logger.error('Error confirming password reset:', err);
      setStatus('ready');
      if (err?.code === 'auth/weak-password') {
        setFormError('Password is too weak. Please use a combination of letters, numbers, and symbols.');
      } else if (err?.code === 'auth/expired-action-code') {
        setErrorMessage('This password reset link has expired. Please request a new one.');
        setStatus('error');
      } else {
        setFormError('Failed to reset password. Please try again.');
      }
    }
  };

  // 1. Loading State
  if (status === 'loading') {
    return (
      <AuthShell title="Verifying link" subtitle="Please wait while we verify your request...">
        <div className="flex flex-col items-center justify-center py-xl">
          <div
            className="h-10 w-10 animate-spin motion-essential rounded-full border-4 border-primary border-t-transparent"
            aria-label="Loading verification"
          />
          <p className="mt-md text-sm text-on-surface-variant">Connecting to security services...</p>
        </div>
      </AuthShell>
    );
  }

  // 2. Error State
  if (status === 'error') {
    return (
      <AuthShell title="Link expired or invalid">
        <div className="space-y-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
            <ExclamationTriangleIcon className="h-6 w-6" aria-hidden="true" />
          </div>

          <p className="text-sm text-on-surface-variant">
            {errorMessage || 'This link is no longer valid. It may have expired or already been used.'}
          </p>

          <div className="space-y-sm pt-xs">
            <Button variant="filled" fullWidth href="/auth/forgot-password">
              Request new password reset
            </Button>
            <Button variant="outlined" fullWidth href="/auth/login">
              Back to sign in
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  // 3. Success State
  if (status === 'success') {
    let successTitle = 'Action completed';
    let successSubtitle = 'Your account action was processed successfully.';

    if (mode === 'resetPassword') {
      successTitle = 'Password updated';
      successSubtitle = 'Your password has been reset successfully. You can now sign in with your new password.';
    } else if (mode === 'verifyEmail') {
      successTitle = 'Email verified';
      successSubtitle = 'Your email address has been verified. You can now sign in to your account.';
    } else if (mode === 'recoverEmail') {
      successTitle = 'Email address restored';
      successSubtitle = accountEmail
        ? `Your account email has been restored to ${accountEmail}. If you did not request this, we recommend resetting your password immediately.`
        : 'Your previous email address has been restored. If you did not request this, please reset your password.';
    }

    return (
      <AuthShell title={successTitle}>
        <div className="space-y-md text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-container text-on-success-container">
            <CheckCircleIcon className="h-6 w-6" aria-hidden="true" />
          </div>

          <p className="text-sm text-on-surface-variant">{successSubtitle}</p>

          <div className="space-y-sm pt-xs">
            {mode === 'recoverEmail' && (
              <Button variant="tonal" fullWidth href="/auth/forgot-password">
                Reset your password
              </Button>
            )}
            <Button variant="filled" fullWidth href="/auth/login">
              Sign in to your account
            </Button>
          </div>
        </div>
      </AuthShell>
    );
  }

  // 4. Ready / Form State (Reset Password)
  if (mode === 'resetPassword') {
    return (
      <AuthShell
        title="Reset your password"
        subtitle={accountEmail ? `Enter a new password for ${accountEmail}` : 'Enter your new account password'}
      >
        {formError && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-md rounded-lg border border-error bg-error-container px-md py-sm text-sm text-on-error-container"
          >
            {formError}
          </div>
        )}

        <form onSubmit={handlePasswordResetSubmit} className="space-y-md" noValidate>
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-for */}
            <label
              htmlFor={passwordId}
              className="mb-2xs block text-sm font-medium text-on-surface"
            >
              New password
              <span className="ml-3xs text-error" aria-hidden="true">
                *
              </span>
            </label>
            <div className="relative">
              <Input
                id={passwordId}
                name="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center px-sm text-on-surface-variant transition-colors duration-short2 ease-emphasized-standard hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-for */}
            <label
              htmlFor={confirmPasswordId}
              className="mb-2xs block text-sm font-medium text-on-surface"
            >
              Confirm new password
              <span className="ml-3xs text-error" aria-hidden="true">
                *
              </span>
            </label>
            <div className="relative">
              <Input
                id={confirmPasswordId}
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type your new password"
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-pressed={showConfirmPassword}
                aria-label={showConfirmPassword ? 'Hide confirmed password' : 'Show confirmed password'}
                className="absolute inset-y-0 right-0 flex items-center px-sm text-on-surface-variant transition-colors duration-short2 ease-emphasized-standard hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
              >
                {showConfirmPassword ? (
                  <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="filled"
            fullWidth
            loading={status === 'submitting'}
          >
            Save new password
          </Button>

          <div className="text-center">
            <Button variant="text" size="sm" href="/auth/login">
              Back to sign in
            </Button>
          </div>
        </form>
      </AuthShell>
    );
  }

  // Default fallback
  return null;
};

export default AuthActionPage;
