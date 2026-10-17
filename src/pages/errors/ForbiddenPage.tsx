import React from 'react';
import { Link } from 'react-router-dom';
import { LockClosedIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import usePageTitle from '../../hooks/usePageTitle';

/**
 * Shown when a signed-in user reaches a route their role cannot use.
 *
 * This exists because the route gate it replaced bounced to / with no
 * explanation: ProtectedRoute did `if (requiredRole && ...) return <Navigate to="/" />`,
 * so being told nothing and landing somewhere unrelated was the entire feedback.
 * The older in-page guards did better and raised a toast, which is why there
 * were two different denial experiences for one concept.
 *
 * Deliberately says which role was needed, because "you do not have permission"
 * is not actionable and the fix is always "ask an administrator".
 */
const ForbiddenPage: React.FC = () => {
  usePageTitle();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-container-low px-6 py-16">
      <div className="w-full max-w-lg rounded-xl border border-outline-variant bg-white p-8 text-center shadow-sm sm:p-10">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-error">
          <LockClosedIcon className="h-6 w-6" aria-hidden="true" />
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight text-on-surface">
          You don't have access to this page
        </h1>

        <p className="mt-3 text-base text-on-surface-variant">
          Your account is signed in, but this area is limited to administrators.
          If you think you should have access, ask an administrator to review
          your account.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex min-h-control w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors duration-fast ease-quart hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
          >
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back to Home
          </Link>
          <Link
            to="/events"
            className="inline-flex min-h-control w-full items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-6 py-2.5 text-sm font-medium text-on-surface-variant transition-[background-color,border-color] duration-fast ease-quart hover:border-outline hover:bg-surface-container-low focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
          >
            Browse events
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;