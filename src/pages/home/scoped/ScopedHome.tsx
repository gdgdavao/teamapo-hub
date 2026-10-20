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
import { EventService } from '../../../services/eventService';
import { RegistrationService } from '../../../services/registrationService';
import { Event, Registration } from '../../../types';
import usePageTitle from '../../../hooks/usePageTitle';
import { useAuth } from '../../../contexts/AuthContext';
import { toDate } from '../../../utils/analyticsBuckets';
import { countPendingRegistrations } from '../../../utils/registrationStatus';
import { logger } from '../../../utils/logger';
import toast from 'react-hot-toast';

const formatPeso = (value: number) =>
  `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

/**
 * Owner-scoped Home: reads only the events this user owns.
 *
 * Every read here is owner-scoped. AnalyticsService.getDashboardStats() is
 * deliberately *not* used: it runs unscoped queries over registrations and
 * certificates, which firestore.rules denies to anyone without `read 'all'` and
 * which would be a Data Privacy Act 2012 problem even if the rules permitted it.
 * Certificates are counted nowhere here for the same reason — the collection
 * carries no organizerUid, so the only way to total them would be a query per
 * event.
 */
const ScopedHome: React.FC = () => {
  const { userProfile } = useAuth();
  const ability = useAbility();
  const canCreateEvent = ability.can('create', 'Event');
  const organizerUid = userProfile?.uid;
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  usePageTitle();

  useEffect(() => {
    const fetchOrganizerData = async () => {
      if (!organizerUid) return;

      try {
        setLoading(true);
        setFailed(false);

        // Start both fetches concurrently in the same network burst
        const eventsPromise = EventService.getEventsByOrganizer(organizerUid);
        const registrationsPromise = RegistrationService.getRegistrationsByOrganizer(organizerUid);

        // Render events as soon as they arrive (<50ms with SWR)
        const ownEvents = await eventsPromise;
        setEvents(ownEvents);
        setLoading(false);

        // Await registrations concurrently to fill in metrics and backlog without delaying initial paint
        const ownRegistrations = await registrationsPromise;
        setRegistrations(ownRegistrations);
      } catch (error) {
        logger.error('Error fetching scoped dashboard data:', error);
        toast.error('Failed to load dashboard data. Please refresh the page.');
        setFailed(true);
        setLoading(false);
      }
    };

    fetchOrganizerData();
    // Primitive dep: userProfile is a new object on every auth re-render.
  }, [organizerUid, reload]);

  const { revenue, checkedIn, upcoming } = useMemo(() => {
    const collected = registrations.reduce(
      (sum, reg) => (reg.paymentStatus === 'paid' ? sum + (reg.totalAmount ?? 0) : sum),
      0
    );
    const attended = registrations.filter(
      (reg) => reg.attendanceStatus === 'checked-in'
    ).length;

    const now = Date.now();
    const soonestFirst = events
      .filter((event) => {
        const start = toDate(event.startDate);
        return event.isPublished && start !== null && start.getTime() >= now;
      })
      .sort((a, b) => {
        const aStart = toDate(a.startDate)?.getTime() ?? 0;
        const bStart = toDate(b.startDate)?.getTime() ?? 0;
        return aStart - bStart;
      });

    return { revenue: collected, checkedIn: attended, upcoming: soonestFirst };
  }, [events, registrations]);

  const registrationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const reg of registrations) {
      counts[reg.eventId] = (counts[reg.eventId] ?? 0) + 1;
    }
    return counts;
  }, [registrations]);

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

  const metrics = useMemo<StatStripMetric[]>(
    () => [
      {
        label: 'Total registrations',
        value: registrations.length.toLocaleString(),
        hint: `across ${events.length.toLocaleString()} ${events.length === 1 ? 'event' : 'events'}`,
      },
      {
        label: 'Revenue collected',
        value: formatPeso(revenue),
        hint: 'from approved payments',
      },
      {
        label: 'Upcoming events',
        value: upcoming.length.toLocaleString(),
        hint: `of ${events.length.toLocaleString()} total`,
      },
      {
        label: 'Checked in',
        value: checkedIn.toLocaleString(),
        hint:
          registrations.length > 0
            ? `${Math.round((checkedIn / registrations.length) * 100)}% attendance rate`
            : 'no registrations yet',
      },
    ],
    [registrations.length, events.length, revenue, upcoming.length, checkedIn]
  );

  const firstName = userProfile?.displayName?.split(' ')[0] || 'there';

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

  // Same reasoning as PlatformHome: zeros on a failed read read as a fact about
  // the organizer's events, and the organizer is the person least able to tell
  // a real zero from a lost response.
  if (failed) {
    return (
      <AppShell title={`Welcome back, ${firstName}`} subtitle="Your events, registrations and attendance at a glance.">
        <EmptyState
          icon={<ExclamationTriangleIcon className="h-10 w-10" />}
          title="Couldn't load your events"
          description="The numbers did not come back. Nothing is wrong with your data — this is a connection problem, so nothing below has been guessed at."
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
      subtitle="Your events, registrations and attendance at a glance."
      fullWidth={true}
    >
      <div className="space-y-6 max-w-screen-2xl mx-auto">
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
              </div>
            </div>
          </section>
        ) : canCreateEvent ? (
          <section
            aria-label="Create an event"
            className="rounded-xl border border-outline-variant bg-white p-5 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-on-surface">
                  Ready to host your next event?
                </h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Set up registrations, tickets, and check-in workflows in minutes.
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
        ) : null}

        <StatStrip metrics={metrics} ariaLabel="Your event totals" />

        <UpcomingEventsList
          events={events}
          registrationCounts={registrationCounts}
          canViewAllEvents={true}
        />
      </div>
    </AppShell>
  );
};

export default ScopedHome;