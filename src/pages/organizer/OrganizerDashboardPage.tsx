import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  QrCodeIcon,
  CalendarDaysIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import DashboardShell from '../../components/shared/DashboardShell';
import DashboardStatStrip, {
  StatStripMetric,
} from '../../components/shared/DashboardStatStrip';
import DashboardTrendPanel from '../../components/shared/DashboardTrendPanel';
import TrendRangeToggle from '../../components/shared/TrendRangeToggle';
import Skeleton from '../../components/shared/UI/Skeleton';
import { EventService } from '../../services/eventService';
import { RegistrationService } from '../../services/registrationService';
import { Event, Registration } from '../../types';
import usePageTitle from '../../hooks/usePageTitle';
import { useAuth } from '../../contexts/AuthContext';
import { toDate, TrendRange } from '../../utils/analyticsBuckets';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

const formatPeso = (value: number) =>
  `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

const formatEventDate = (value: unknown) => {
  const date = toDate(value as never);
  if (!date) return 'Date to be announced';
  return date.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
};

/**
 * Organizer dashboard, scoped to the events this user owns.
 *
 * Every read here is owner-scoped. AnalyticsService.getDashboardStats() is
 * deliberately *not* used: it runs unscoped queries over registrations and
 * certificates, which firestore.rules denies to organizers and which would be a
 * Data Privacy Act 2012 problem even if the rules permitted it. Certificates are
 * counted nowhere here for the same reason — the collection carries no
 * organizerUid, so the only way to total them would be a query per event.
 */
const OrganizerDashboardPage: React.FC = () => {
  const { userProfile } = useAuth();
  const organizerUid = userProfile?.uid;
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TrendRange>('30d');

  usePageTitle();

  useEffect(() => {
    const fetchOrganizerData = async () => {
      if (!organizerUid) return;

      try {
        setLoading(true);
        const [ownEvents, ownRegistrations] = await Promise.all([
          EventService.getEventsByOrganizer(organizerUid),
          RegistrationService.getRegistrationsByOrganizer(organizerUid),
        ]);
        setEvents(ownEvents);
        setRegistrations(ownRegistrations);
      } catch (error) {
        logger.error('Error fetching organizer dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizerData();
    // Primitive dep: userProfile is a new object on every auth re-render.
  }, [organizerUid]);

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

  const nextEvent = upcoming[0] ?? null;
  const nextEventRegistrations = nextEvent
    ? registrations.filter((reg) => reg.eventId === nextEvent.id).length
    : 0;

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
      subtitle="Your events, registrations and attendance at a glance."
    >
      <div className="space-y-6">
        <DashboardStatStrip metrics={metrics} ariaLabel="Your event totals" />

        {/* Organizers don't approve registrations, so the primary action is the
            roster for whatever they're running next. */}
        {nextEvent ? (
          <section
            aria-label="Next event"
            className="rounded-xl border border-outline-variant bg-white p-5 sm:p-6 transition-[box-shadow,transform] duration-fast ease-quart hover:shadow-elevation-1"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CalendarDaysIcon className="h-6 w-6 flex-shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface-variant">Up next</p>
                  <h2 className="mt-0.5 truncate text-base font-semibold text-on-surface">
                    {nextEvent.title}
                  </h2>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {formatEventDate(nextEvent.startDate)} ·{' '}
                    {nextEventRegistrations.toLocaleString()} registered
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-2 sm:flex-row">
                <Link
                  to={`/events/${nextEvent.id}/attendees`}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-medium text-white hover:bg-primary-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-[color,background-color,transform] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  View roster
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link
                  to={`/events/${nextEvent.id}/check-in`}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-5 py-2.5 font-medium text-on-surface hover:bg-surface-container-low hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-[color,background-color,border-color,transform] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  <QrCodeIcon className="h-5 w-5" />
                  Check in
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-outline-variant bg-white p-6 text-center">
            <CalendarDaysIcon className="mx-auto h-10 w-10 text-outline-variant" />
            <h2 className="mt-2 text-base font-medium text-on-surface">
              No upcoming events
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-on-surface-variant">
              {events.length > 0
                ? 'All of your events have already started or finished.'
                : 'Contact an administrator to have your first event created and published.'}
            </p>
          </section>
        )}

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

export default OrganizerDashboardPage;