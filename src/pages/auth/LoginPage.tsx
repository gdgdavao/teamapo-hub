import React, { useId, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../config/firebase';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { Input, Button } from '../../components/UI';
import AuthShell from './AuthShell';
import usePageTitle from '../../hooks/usePageTitle';
import { logger } from '../../utils/logger';
import { resolveLoginDestination } from '../../utils/authRedirect';
import { getFriendlyAuthErrorMessage } from '../../utils/authErrors';

const GoogleIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
  </svg>
);

const LoginPage: React.FC = () => {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set page title
  usePageTitle();

  const destination = resolveLoginDestination(searchParams.get('from'));

  const applyPersistence = async () => {
    await setPersistence(
      auth,
      rememberMe ? browserLocalPersistence : browserSessionPersistence
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await applyPersistence();
      await signIn(email.trim(), password);
      navigate(destination);
    } catch (err) {
      logger.error('Login error:', err);
      setError(getFriendlyAuthErrorMessage(err, 'Unable to sign in. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await applyPersistence();
      await signInWithGoogle();
      navigate(destination);
    } catch (err) {
      logger.error('Google sign-in error:', err);
      setError(getFriendlyAuthErrorMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign in to your account"
      footer={
        <div className="flex flex-col items-center gap-1 text-xs text-on-surface-variant">
          <div>
            By signing in, you agree to our{' '}
            <Link to="/terms-of-service" className="text-primary hover:underline font-medium">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-primary hover:underline font-medium">
              Privacy Policy
            </Link>.
          </div>
          <div className="text-[11px] text-on-surface-variant/70 mt-1">
            © {new Date().getFullYear()} TeamApo Hub •{' '}
            <a
              href="https://gdgdavao.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              GDG Davao
            </a>
          </div>
        </div>
      }
    >
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-md rounded-lg border border-error bg-error-container px-md py-sm text-sm text-on-error-container"
        >
          {error}
        </div>
      )}

      <form className="space-y-md" onSubmit={handleSubmit} noValidate>
        <Input
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-for */}
          <label
            htmlFor={passwordId}
            className="mb-2xs block text-sm font-medium text-on-surface"
          >
            Password
            <span className="ml-3xs text-error" aria-hidden="true">
              *
            </span>
          </label>
          <div className="relative">
            <Input
              id={passwordId}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
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

        <div className="flex items-center justify-between gap-sm">
          <label htmlFor="remember-me" className="inline-flex min-h-control items-center gap-2xs text-sm text-on-surface">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-5 w-5 rounded border-outline-variant text-primary focus:ring-primary"
            />
            Remember me
          </label>

          <Link
            to="/auth/forgot-password"
            className="text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="filled" fullWidth loading={loading}>
          Sign in
        </Button>
      </form>

      <div className="my-md flex items-center gap-sm" aria-hidden="true">
        <div className="h-px flex-1 bg-outline-variant" />
        <span className="text-xs uppercase tracking-wide text-on-surface-variant">or</span>
        <div className="h-px flex-1 bg-outline-variant" />
      </div>

      <Button
        type="button"
        variant="outlined"
        fullWidth
        disabled={loading}
        onClick={handleGoogleSignIn}
        icon={<GoogleIcon />}
      >
        Continue with Google
      </Button>
    </AuthShell>
  );
};

export default LoginPage;