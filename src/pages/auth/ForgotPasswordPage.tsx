import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { Input, Button } from '../../components/UI';
import AuthShell from './AuthShell';
import usePageTitle from '../../hooks/usePageTitle';
import { AUTH_ACTION_CODE_SETTINGS } from '../../config/app';
import { logger } from '../../utils/logger';

const ForgotPasswordPage: React.FC = () => {
  usePageTitle();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), AUTH_ACTION_CODE_SETTINGS);
      setSent(true);
    } catch (err: any) {
      logger.error('Password reset failed:', err);
      setError(
        err?.code === 'auth/invalid-email'
          ? 'Enter a valid email address.'
          : 'Could not send the reset email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send a link to the email address on your account."
    >
      {sent ? (
        <div className="space-y-md text-center">
          <p className="text-sm text-on-surface-variant">
            If an account exists for{' '}
            <span className="font-medium text-on-surface">{email.trim()}</span>, a password
            reset link is on its way. Check your inbox and spam folder.
          </p>
          <Button variant="filled" fullWidth href="/auth/login">
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-md" noValidate>
          <Input
            label="Email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            error={error || undefined}
          />

          <Button type="submit" variant="filled" fullWidth loading={loading}>
            Send reset link
          </Button>

          <div className="text-center">
            <Link
              to="/auth/login"
              className="text-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface rounded"
            >
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

export default ForgotPasswordPage;