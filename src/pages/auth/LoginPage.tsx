import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import usePageTitle from '../../hooks/usePageTitle';
import { logger } from '../../utils/logger';
import apohubTitle from '@assets/apohub-title.svg';


const LoginPage: React.FC = () => {
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * Where to go once signed in.
   *
   * The route gate appends `?from=` when it turns a signed-out visitor away, so
   * a deep link to /attendees?eventId=x survives the detour through this form
   * instead of dumping everyone on the dashboard.
   *
   * Re-validated here rather than trusted: the parameter arrives from the URL,
   * so `?from=https://evil.example` would otherwise turn the sign-in form into
   * an open redirect, handing a freshly authenticated session to another origin
   * by way of a Referer header. A single leading slash with no second one is a
   * path; `//host` and `/\host` are protocol-relative URLs that also start with
   * a slash.
   */
  const destination = (() => {
    const from = searchParams.get('from');
    if (!from) return '/dashboard';
    if (!from.startsWith('/')) return '/dashboard';
    if (from.startsWith('//') || from.startsWith('/\\')) return '/dashboard';
    // Never bounce straight back to the auth area.
    if (from.startsWith('/auth/login') || from.startsWith('/auth/forgot-password')) {
      return '/dashboard';
    }
    return from;
  })();

  // Set page title
  usePageTitle();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await signIn(email, password);
      navigate(destination);
    } catch (error) {
      logger.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      navigate(destination);
    } catch (error) {
      logger.error('Google sign-in error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img src={apohubTitle} alt="APOHUB" className="h-12 sm:h-16" />
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <h2 className="mt-4 mb-8 text-center text-2xl font-bold text-on-surface">
            Sign in to your account
          </h2>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="form-label">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-outline-variant" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-outline-variant" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-primary border-outline-variant rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-on-surface">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/auth/forgot-password"
                  className="font-medium text-primary hover:text-primary-hover"
                >
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 