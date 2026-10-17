import React from 'react';
import {
  CalendarDaysIcon,
  QrCodeIcon,
  UserGroupIcon,
  ArrowRightIcon,
  MapPinIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { Button, Badge, EmptyState } from '../../components/UI';
import { Event } from '../../types';
import { toDate, REPORTING_TIMEZONE } from '../../utils/analyticsBuckets';
import { usePrefetchEvent } from '../../hooks/usePrefetchEvent';

export interface UpcomingEventsListProps {
  events: readonly Event[];
  /** Map of eventId to registration count */
  registrationCounts?: Record<string, number>;
  /** Whether the viewer can access the unscoped /events catalog */
  canViewAllEvents?: boolean;
}

const formatEventDate = (value: unknown): string => {
  const date = toDate(value as never);
  if (!date) return 'Date TBA';
  return date.toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: REPORTING_TIMEZONE,
  });
};

const formatEventTime = (value: unknown): string => {
  const date = toDate(value as never);
  if (!date) return '';
  return date.toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: REPORTING_TIMEZONE,
  });
};

const getVenueLabel = (event: Event): { text: string; isOnline: boolean } => {
  if (event.venue?.type === 'online') {
    return { text: 'Online', isOnline: true };
  }
  if (event.venue?.type === 'hybrid') {
    return { text: event.venue.city ? `Hybrid · ${event.venue.city}` : 'Hybrid', isOnline: false };
  }
  return {
    text: event.venue?.name || event.venue?.city || 'In-person',
    isOnline: false,
  };
};

export const UpcomingEventsList: React.FC<UpcomingEventsListProps> = ({
  events,
  registrationCounts = {},
  canViewAllEvents = false,
}) => {
  const { getPrefetchProps } = usePrefetchEvent();
  const now = Date.now();

  // Upcoming published events sorted chronologically (soonest first)
  const upcomingEvents = React.useMemo(() => {
    return events
      .filter((event) => {
        const start = toDate(event.startDate);
        return event.isPublished && start !== null && start.getTime() >= now;
      })
      .sort((a, b) => {
        const aTime = toDate(a.startDate)?.getTime() ?? 0;
        const bTime = toDate(b.startDate)?.getTime() ?? 0;
        return aTime - bTime;
      });
  }, [events, now]);

  if (upcomingEvents.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDaysIcon className="h-10 w-10 text-on-surface-variant" />}
        title="No upcoming events"
        description={
          events.length > 0
            ? 'All scheduled events have already taken place.'
            : 'No events have been scheduled yet.'
        }
        action={
          canViewAllEvents && events.length > 0 ? (
            <Button href="/events" variant="outlined">
              Browse past events
            </Button>
          ) : undefined
        }
      />
    );
  }

  const nextEvent = upcomingEvents[0];
  const subsequentEvents = upcomingEvents.slice(1);
  const nextAttendees = registrationCounts[nextEvent.id] ?? nextEvent.currentAttendees ?? 0;
  const nextVenue = getVenueLabel(nextEvent);
  const nextTime = formatEventTime(nextEvent.startDate);

  return (
    <div className="space-y-6">
      {/* "Next Up" Spotlight Card */}
      <section
        aria-label="Next event"
        className="rounded-xl border border-outline-variant bg-white p-5 sm:p-6 transition-colors"
        {...getPrefetchProps(nextEvent.id, nextEvent.slug)}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-secondary-container text-on-secondary-container">
                <CalendarDaysIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                Up Next
              </span>
              <Badge tone="neutral">
                {nextVenue.isOnline ? (
                  <span className="inline-flex items-center gap-1">
                    <VideoCameraIcon className="h-3 w-3" aria-hidden="true" />
                    {nextVenue.text}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="h-3 w-3" aria-hidden="true" />
                    {nextVenue.text}
                  </span>
                )}
              </Badge>
            </div>

            <h2 className="mt-2.5 text-lg sm:text-xl font-bold text-on-surface truncate">
              {nextEvent.title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-on-surface-variant">
              <span>
                {formatEventDate(nextEvent.startDate)}
                {nextTime ? ` · ${nextTime}` : ''}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-on-surface">
                {nextAttendees.toLocaleString()}{' '}
                {nextAttendees === 1 ? 'attendee registered' : 'attendees registered'}
              </span>
            </div>
          </div>

          {/* Direct high-velocity actions */}
          <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
            <Button
              href={`/events/${nextEvent.id}/check-in`}
              variant="filled"
              icon={<QrCodeIcon className="h-5 w-5" />}
              {...getPrefetchProps(nextEvent.id, nextEvent.slug)}
            >
              Check in
            </Button>
            <Button
              href={`/events/${nextEvent.id}/attendees`}
              variant="tonal"
              icon={<UserGroupIcon className="h-5 w-5" />}
              {...getPrefetchProps(nextEvent.id, nextEvent.slug)}
            >
              View roster
            </Button>
            <Button
              href={`/events/${nextEvent.id}`}
              variant="outlined"
              {...getPrefetchProps(nextEvent.id, nextEvent.slug)}
            >
              Workspace
            </Button>
          </div>
        </div>
      </section>

      {/* Subsequent Upcoming Events Schedule */}
      {subsequentEvents.length > 0 && (
        <section aria-label="Subsequent upcoming events" className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">
              Later Schedule ({subsequentEvents.length})
            </h3>
            {canViewAllEvents && (
              <Button href="/events" variant="text" size="sm" iconTrailing={<ArrowRightIcon className="h-4 w-4" />}>
                All events
              </Button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-outline-variant bg-white divide-y divide-outline-variant">
            {subsequentEvents.map((event) => {
              const attendees = registrationCounts[event.id] ?? event.currentAttendees ?? 0;
              const venue = getVenueLabel(event);
              const eventDateStr = formatEventDate(event.startDate);
              const eventTimeStr = formatEventTime(event.startDate);

              return (
                <div
                  key={event.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-surface-container-low transition-colors"
                  {...getPrefetchProps(event.id, event.slug)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary">
                        {eventDateStr}
                        {eventTimeStr ? ` · ${eventTimeStr}` : ''}
                      </span>
                      <Badge tone="neutral" className="text-xs">
                        {venue.text}
                      </Badge>
                    </div>
                    <h4 className="mt-1 text-base font-semibold text-on-surface truncate">
                      {event.title}
                    </h4>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {attendees.toLocaleString()}{' '}
                      {attendees === 1 ? 'registered attendee' : 'registered attendees'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      href={`/events/${event.id}/attendees`}
                      variant="text"
                      size="sm"
                      {...getPrefetchProps(event.id, event.slug)}
                    >
                      Roster
                    </Button>
                    <Button
                      href={`/events/${event.id}`}
                      variant="outlined"
                      size="sm"
                      {...getPrefetchProps(event.id, event.slug)}
                    >
                      Workspace
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

export default UpcomingEventsList;
