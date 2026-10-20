import React, { useState, useEffect, useMemo } from 'react';
import { useAbility } from '@casl/react';
import {
  UserGroupIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import AppShell from '../../../layout/AppShell';
import StatStrip, { StatStripMetric } from '../StatStrip';
import UpcomingEventsList from '../UpcomingEventsList';
import { Button, EmptyState, Skeleton } from '../../../components/UI';
import { AnalyticsService, DashboardStats } from '../../../services/analyticsService';
import { RegistrationService } from '../../../services/registrationService';
import { EventService } from '../../../services/eventService';
import { Event, Registration } from '../../../types';
import usePageTitle from '../../../hooks/usePageTitle';
import { useAuth } from '../../../contexts/AuthContext';
import { countPendingRegistrations } from '../../../utils/registrationStatus';
import { logger } from '../../../utils/logger';
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
 * Platform-wide Home: reads every event, registration and certificate.
 *
 * Analytics and a route into the pending-review queue. Deliberately *not* a
 * card grid: DESIGN.md §1 rejects "identical cards stacked endlessly" and
 * "unearned metric cards", so the totals live in one divided strip, the trend
 * is a real chart, and the action that matters right now is one button.
 */
const PlatformHome: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  usePageTitle();

  const ability = useAbility();
  const canReadAll = ability.can('read', 'all');

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) return;

      try {
        setLoading(true);
        setFailed(false);

        // Dispatch all three requests concurrently in the same network wave
        const statsPromise = AnalyticsService.getDashboardStats();
        const eventsPromise = EventService.getAllEvents();
        const registrationsPromise = RegistrationService.getAllRegistrations();

        // Render dashboard totals & upcoming events as soon as stats and events arrive (<50ms)
        const [dashboardStats, allEvents] = await Promise.all([statsPromise, eventsPromise]);
        setStats(dashboardStats);
        setEvents(allEvents);
        setLoading(false);

        // Await registrations concurrently for pending review backlog and live attendee counts
        const allRegistrations = await registrationsPromise;
        setRegistrations(allRegistrations);
      } catch (error) {
        logger.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data. Please refresh the page.');
        setFailed(true);
        setLoading(false);
      }
    };

    fetchDashboardData();
    // Primitive deps only, deliberately. userProfile and currentUser are fresh
    // objects on every auth re-render, so depending on them would re-fetch the
    // entire Home in a loop. canReadAll is a boolean derived from the ability,
    // and changes only when the role or isActive does. `reload` is the retry
    // handle: bumping it re-runs this effect without exposing the fetch itself.
    // See tests/unit/home-listener-dedup.test.ts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, canReadAll, reload]);

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

  /**
   * The event holding the largest review backlog, not just a count.
   *
   * A count with no destination is a report; a count with a destination is a
   * task. `/events` is an event list and cannot sort itself by "how many people
   * are waiting here", so pointing a pending CTA at it sends the admin
   * hunting. Grouping is a pure reduce over the array already in hand —
   * status comes from the shared resolver, so this agrees exactly with the row
   * count of the attendees list it links into.
   */
  const backlog = useMemo(() => {
    const byEvent = new Map<string, Registration[]>();
    for (const reg of registrations) {
      const bucket = byEvent.get(reg.eventId);
      if (bucket) bucket.push(reg);
      else byEvent.set(reg.eventId, [reg]);
    }

    let top: { eventId: string; count: number } | null = null;
    for (const [eventId, group] of byEvent) {
      const count = countPendingRegistrations(group);
      if (count > 0 && (!top || count > top.count)) top = { eventId, count };
    }
    return top;
  }, [registrations]);

  const registrationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const reg of registrations) {
      counts[reg.eventId] = (counts[reg.eventId] ?? 0) + 1;
    }
    return counts;
  }, [registrations]);

  const firstName = userProfile?.displayName?.split(' ')[0] || 'Admin';

  if (loading) {
    return (
      <AppShell title="Home" subtitle="Loading your dashboard...">
        <div className="space-y-6">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  // A failed load used to fall through to the strip and render zeros, which
  // reads as "this platform has no registrations" rather than "we could not
  // ask". On a phone with one bar of signal that is the most likely state this
  // page is ever in, and it is the one that must never be mistakable for truth.
  if (failed) {
    return (
      <AppShell title={`Welcome back, ${firstName}`} subtitle="Platform-wide registrations, revenue and event activity.">
        <EmptyState
          icon={<ExclamationTriangleIcon className="h-10 w-10" />}
          title="Couldn't load your dashboard"
          description="The numbers did not come back. Nothing is wrong with your data — this is a connection or permissions problem, so nothing below has been guessed at."
          action={
            <Button variant="filled" onClick={() => setReload((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Welcome back, ${firstName}`}
      subtitle="Platform-wide registrations, revenue and event activity."
      fullWidth={true}
    >
      <div className="space-y-6 max-w-screen-2xl mx-auto">
        {/* The one action that matters right now. */}
        {backlog ? (
          <section
            aria-label="Pending registrations"
            className="rounded-xl border border-warning-container bg-warning-container p-5 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <UserGroupIcon className="h-6 w-6 flex-shrink-0 text-on-warning-container" />
                <div>
                  <h2 className="text-base font-semibold text-on-warning-container">
                    {backlog.count.toLocaleString()}{' '}
                    {backlog.count === 1 ? 'registration needs' : 'registrations need'}{' '}
                    your review
                  </h2>
                  <p className="mt-1 text-sm text-on-warning-container">
                    Attendees are waiting on approval or payment verification before
                    they can access their ticket.
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row">
                <Button
                  href={`/events/${backlog.eventId}/attendees?status=pending`}
                  iconTrailing={<ArrowRightIcon className="h-4 w-4" />}
                >
                  Review {backlog.count.toLocaleString()}
                </Button>
                <Button href="/events" variant="text">
                  All events
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section
            aria-label="Create an event"
            className="rounded-xl border border-outline-variant bg-white p-5 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-on-surface">
                  Nothing waiting on you
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Every registration is answered. The next event starts here.
                </p>
              </div>
              <div className="flex flex-shrink-0">
                <Button
                  href="/events/create"
                  iconTrailing={<ArrowRightIcon className="h-4 w-4" />}
                >
                  Create an event
                </Button>
              </div>
            </div>
          </section>
        )}

        <StatStrip metrics={metrics} ariaLabel="Platform totals" />

        <UpcomingEventsList
          events={events}
          registrationCounts={registrationCounts}
          canViewAllEvents={true}
        />
      </div>
    </AppShell>
  );
};

export default PlatformHome;