import React, { useState, useEffect, useMemo } from 'react';
import { useAbility } from '@casl/react';
import { Link } from 'react-router-dom';
import {
  UserGroupIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import DashboardShell from '../../components/shared/DashboardShell';
import DashboardStatStrip, {
  StatStripMetric,
} from '../../components/shared/DashboardStatStrip';
import DashboardTrendPanel from '../../components/shared/DashboardTrendPanel';
import TrendRangeToggle from '../../components/shared/TrendRangeToggle';
import Skeleton from '../../components/shared/UI/Skeleton';
import { AnalyticsService, DashboardStats } from '../../services/analyticsService';
import { RegistrationService } from '../../services/registrationService';
import { Registration } from '../../types';
import usePageTitle from '../../hooks/usePageTitle';
import { useAuth } from '../../contexts/AuthContext';
import { countPendingRegistrations } from '../../utils/registrationStatus';
import { TrendRange } from '../../utils/analyticsBuckets';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

const EMPTY_STATS: DashboardStats = {
  totalEvents: 0,
  totalRegistrations: 0,
  pendingApprovals: 0,
  certificatesIssued: 0,
  upcomingEvents: 0,
  monthlyGrowth: { events: null, registrations: null, certificates: null },
  totalRevenue: 0,
  pendingPayments: 0,
};

const formatPeso = (value: number) =>
  `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

/**
 * Platform-wide admin dashboard.
 *
 * Analytics and a route into the pending-review queue. Deliberately *not* a
 * card grid: DESIGN.md §1 rejects "identical cards stacked endlessly" and
 * "unearned metric cards", so the totals live in one divided strip and the
 * trend is a real chart.
 */
const AdminDashboardPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TrendRange>('30d');

  usePageTitle();

  const canReadAll = useAbility().can('read', 'all');

  // Admins see platform totals. getDashboardStats() is admin-only by design —
  // it runs unscoped reads over registrations and certificates, which
  // firestore.rules denies to organizers (Data Privacy Act 2012).
  useEffect(() => {
    const fetchDashboardData = async () => {
      // Platform totals are admin-only by permission, not by role: this runs
      // unscoped reads over registrations and certificates, which
      // firestore.rules denies to organizers (Data Privacy Act 2012). The same
      // `read 'all'` the /events and /users routes use, so the dashboard and
      // the navigation cannot disagree about who is an administrator.
      if (!currentUser || !canReadAll) return;

      try {
        setLoading(true);
        const [dashboardStats, allRegistrations] = await Promise.all([
          AnalyticsService.getDashboardStats(),
          RegistrationService.getAllRegistrations(),
        ]);

        setStats(dashboardStats);
        setRegistrations(allRegistrations);
        // Counted over the *whole* roster. The previous implementation sliced
        // to the 5 newest before counting, so the badge read "5" no matter how
        // large the real backlog was.
        setPendingCount(countPendingRegistrations(allRegistrations));
      } catch (error) {
        logger.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    // Primitive deps only, deliberately. userProfile and currentUser are fresh
    // objects on every auth re-render, so depending on them would re-fetch the
    // entire dashboard in a loop. canReadAll is a boolean derived from the
    // ability, and changes only when the role or isActive does.
    // See tests/unit/dashboard-listener-dedup.test.ts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, canReadAll]);

  const metrics = useMemo<StatStripMetric[]>(
    () => [
      {
        label: 'Total registrations',
        value: stats.totalRegistrations.toLocaleString(),
        delta: stats.monthlyGrowth.registrations,
      },
      {
        label: 'Revenue collected',
        value: formatPeso(stats.totalRevenue),
        hint: 'from approved payments',
      },
      {
        label: 'Certificates issued',
        value: stats.certificatesIssued.toLocaleString(),
        delta: stats.monthlyGrowth.certificates,
      },
      {
        label: 'Upcoming events',
        value: stats.upcomingEvents.toLocaleString(),
        hint: `of ${stats.totalEvents.toLocaleString()} total`,
      },
    ],
    [stats]
  );

  const firstName = userProfile?.displayName?.split(' ')[0] || 'Admin';

  if (loading) {
    return (
      <DashboardShell title="Dashboard" subtitle="Loading your dashboard...">
        <div className="space-y-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={`Welcome back, ${firstName}`}
      subtitle="Platform-wide registrations, revenue and event activity."
    >
      <div className="space-y-6">
        <DashboardStatStrip metrics={metrics} ariaLabel="Platform totals" />

        {/* The one action that matters right now. Count and list agree because
            both come from resolveDisplayStatus — see utils/registrationStatus. */}
        {pendingCount > 0 ? (
          <section
            aria-label="Pending registrations"
            className="rounded-xl border border-accent-200 bg-warning-container p-5 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <UserGroupIcon className="h-6 w-6 text-warning" />
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5" aria-hidden="true">
                    <span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warning"></span>
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-on-surface">
                    {pendingCount.toLocaleString()}{' '}
                    {pendingCount === 1 ? 'registration needs' : 'registrations need'}{' '}
                    your review
                  </h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    Attendees are waiting on approval or payment verification before
                    they can access their ticket.
                  </p>
                </div>
              </div>
              <Link
                to="/events"
                className="inline-flex min-h-[48px] flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-warning-amber px-5 py-2.5 font-medium text-on-surface hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-[background-color,transform] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-700 focus-visible:ring-offset-2"
              >
                Review events
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </section>
        ) : null}

        <div className="flex justify-end">
          <TrendRangeToggle range={range} onChange={setRange} />
        </div>

        <DashboardTrendPanel
          registrations={registrations}
          range={range}
          series="registrations"
        />

        <DashboardTrendPanel
          registrations={registrations}
          range={range}
          series="revenue"
        />
      </div>
    </DashboardShell>
  );
};

export default AdminDashboardPage;