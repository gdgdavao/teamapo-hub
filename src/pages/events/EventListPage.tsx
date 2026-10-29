import React, { useState, useEffect } from 'react';
import { useAbility } from '@casl/react';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  CalendarDaysIcon,
  UsersIcon,
  ShareIcon,
  ArrowRightIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/20/solid';
import { Link } from 'react-router-dom';
import { EmptyState, LoadingSpinner, ProgressBar, Select } from '../../components/UI';
import { EventService } from '../../services/eventService';
import { RegistrationService } from '../../services/registrationService';
import { Event } from '../../types';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';
import AppShell from '../../layout/AppShell';
import { toDateSafe, formatEventDate } from '../../utils/dateUtils';
import { formatEventLocation } from '../../utils/venueUtils';
import { usePrefetchEvent } from '../../hooks/usePrefetchEvent';
import { useAuth } from '../../contexts/AuthContext';
import usePageTitle from '../../hooks/usePageTitle';

// Dedicated events workspace supporting both admin (RBAC) and organizer (ABPAC)
const EventsWorkspace: React.FC = () => {
  usePageTitle({ title: 'Events' });
  const ability = useAbility();
  const { userProfile, currentUser } = useAuth();
  const currentUid = userProfile?.uid || currentUser?.uid;
  const canReadAll = ability.can('read', 'all');
  const canReadEvents = ability.can('read', 'Event');
  const canCreateEvent = ability.can('create', 'Event');
  const { getPrefetchProps } = usePrefetchEvent({ prefetchRegistrations: false });

  // Dev diagnostics helper (no-ops in production)
  const isDevEnv = process.env.NODE_ENV !== 'production';
  const logDiagnostics = React.useCallback(
    (label: string, payload: any) => {
      if (!isDevEnv) return;
      logger.group(`[AdminManageEventsPage] ${label}`);
      logger.log(payload);
      logger.groupEnd();
    },
    [isDevEnv]
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('startDate');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);


  // Removed feedbackModal state - now using dedicated page

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);

        const eventsData = await EventService.getAllEvents();
        setEvents(eventsData);
        setLoading(false);

        logDiagnostics(
          'Fetched events snapshot',
          eventsData.map(event => ({
            id: event.id,
            status: event.status,
            registrationStatus: event.registrationStatus,
            feedbackRequestsSentAt: event.feedbackRequestsSentAt?.toDate
              ? event.feedbackRequestsSentAt.toDate().toISOString()
              : event.feedbackRequestsSentAt ?? null,
            currentAttendees: event.currentAttendees
          }))
        );

        const registrationsPromise = canReadAll
          ? RegistrationService.getAllRegistrations() // firestore:unscoped-ok - admin event list attendee aggregation
          : currentUid
          ? RegistrationService.getRegistrationsByOrganizer(currentUid)
          : null;

        if (registrationsPromise) {
          // Fetch attendee counts in background to update real active (non-cancelled) counts
          registrationsPromise
            .then((scopedRegistrations) => {
              const activeCountByEventId = new Map<string, number>();
              for (const reg of scopedRegistrations) {
                if (reg.attendanceStatus !== 'cancelled') {
                  const count = reg.quantity || 1;
                  activeCountByEventId.set(
                    reg.eventId,
                    (activeCountByEventId.get(reg.eventId) || 0) + count
                  );
                }
              }

              setEvents(prev =>
                prev.map(event => ({
                  ...event,
                  currentAttendees: activeCountByEventId.get(event.id) ?? event.currentAttendees ?? 0,
                }))
              );
            })
            .catch((err) => {
              logger.warn('Failed to refresh real attendee counts in background:', err);
            });
        }
      } catch (error) {
        logger.error('Error fetching events:', error);
        toast.error('Failed to load events. Please refresh the page.');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [canReadAll, currentUid, logDiagnostics]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-success" />;
      case 'published':
        return <CheckCircleIcon className="h-5 w-5 text-primary" />;
      case 'ongoing':
        return <ClockIcon className="h-5 w-5 text-warning" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-error" />;
      default:
        return <ClockIcon className="h-5 w-5 text-on-surface-variant" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'published':
        return 'bg-blue-100 text-blue-800';
      case 'ongoing':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (event.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (event.shortDescription?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    switch (sortBy) {
      case 'startDate': {
        const aTime = toDateSafe(a.startDate)?.getTime() ?? 0;
        const bTime = toDateSafe(b.startDate)?.getTime() ?? 0;
        return bTime - aTime;
      }
      case 'title':
        return a.title.localeCompare(b.title);
      case 'attendees':
        return b.currentAttendees - a.currentAttendees;
      case 'createdAt': {
        const aTime = toDateSafe(a.createdAt)?.getTime() ?? 0;
        const bTime = toDateSafe(b.createdAt)?.getTime() ?? 0;
        return bTime - aTime;
      }
      default:
        return 0;
    }
  });

  const formatDate = (timestamp: any) => {
    return formatEventDate(timestamp, 'N/A');
  };

  const formatPrice = (ticketTypes: Event['ticketTypes']) => {
    if (!ticketTypes || ticketTypes.length === 0) return 'Free';
    const minPrice = Math.min(...ticketTypes.map(t => t.price));
    const maxPrice = Math.max(...ticketTypes.map(t => t.price));
    const currency = ticketTypes[0]?.currency || 'PHP';
    
    if (minPrice === maxPrice) {
      return `${currency} ${minPrice.toLocaleString()}`;
    }
    return `${currency} ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
  };



  const handleShareEvent = (eventId: string, eventTitle: string, eventSlug?: string) => {
    // Use slug-based URL if available, otherwise fall back to ID
    const shareUrl = eventSlug 
      ? `${window.location.origin}/e/${eventSlug}`
      : `${window.location.origin}/e/${eventId}`;
    
    // Copy link to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success(`Registration link for "${eventTitle}" copied to clipboard.`, {
        duration: 4000,
      });
    }).catch(() => {
      toast.error('Failed to copy link to clipboard. Please try again.');
    });
  };

  const getPageTitle = () => {
    return 'Events Management';
  };

const getPageSubtitle = () => {
    return 'Create, publish, and manage your events';
  };



  if (loading) {
    return (
      <AppShell title={getPageTitle()}>
        <div className="flex items-center justify-center h-64">
          <div className="motion-essential animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-on-surface-variant">Loading events...</span>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title={getPageTitle()} 
      subtitle={getPageSubtitle()}
      fullWidth={true}
      actions={
        canCreateEvent ? (
          <Link
            to="/events/create"
            className="inline-flex items-center min-h-[48px] px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors duration-200 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Create Event
          </Link>
        ) : undefined
      }
    >
        {/* Filters and Search */}
        <div className="bg-white rounded-xl border border-outline-variant p-4 sm:p-5 mb-6 sm:mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[240px]">
              <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-outline-variant pointer-events-none" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 min-h-[48px] border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              />
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              size="md"
              className="w-full sm:w-48 sm:flex-none"
              aria-label="Filter events by status"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>

            {/* Sort By */}
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              size="md"
              className="w-full sm:w-48 sm:flex-none"
              aria-label="Sort events"
            >
              <option value="startDate">Sort by Date</option>
              <option value="title">Sort by Title</option>
              <option value="attendees">Sort by Attendees</option>
              <option value="createdAt">Sort by Created</option>
            </Select>
          </div>
        </div>

        {/* Events Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {sortedEvents.map((event, index) => {
            const canManage = canReadEvents;
            const targetHref = canManage ? `/events/${event.id}` : `/e/${event.slug || event.id}`;
            const prefetchProps = canManage ? getPrefetchProps(event.id, event.slug) : {};

            return (
              <div
                key={event.id}
                style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
                className="group bg-surface rounded-xl shadow-elevation-0 border border-outline-variant overflow-hidden hover:shadow-elevation-1 hover:-translate-y-0.5 transition-[transform,box-shadow] duration-fast ease-quart animate-rise-in motion-reduce:animate-none flex flex-col"
                {...prefetchProps}
              >
                {/* Event Image */}
                <div className="relative h-48 bg-surface-container-high overflow-hidden flex-shrink-0">
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover transition-transform duration-base ease-quart group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary-container to-primary-container">
                      <CalendarDaysIcon className="h-12 w-12 text-primary transition-transform duration-fast ease-quart group-hover:scale-110" />
                    </div>
                  )}
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 flex items-center">
                    <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ${getStatusColor(event.status)}`}>
                      {getStatusIcon(event.status)}
                      <span className="capitalize">{event.status}</span>
                    </div>
                  </div>
                  {/* Price Badge */}
                  <div className="absolute bottom-3 left-3">
                    <div className="bg-black bg-opacity-75 text-white px-2 py-1 rounded-md text-sm font-medium">
                      {formatPrice(event.ticketTypes)}
                    </div>
                  </div>
                </div>

                {/* Event Content */}
                <div className="p-4 md:p-6 flex-1 flex flex-col">
                  {/* Title and Category */}
                  <div className="mb-3">
                    <Link
                      to={targetHref}
                      className="block group"
                      {...prefetchProps}
                    >
                      <h3 className="text-lg font-semibold text-on-surface mb-1 line-clamp-2 group-hover:text-primary-hover transition-colors">
                        {event.title}
                      </h3>
                    </Link>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
                      <span className="bg-surface-container px-2 py-0.5 rounded-md text-xs font-medium">{event.category}</span>
                      {event.tags?.slice(0, 2).map((tag, tagIndex) => (
                        <span key={tagIndex} className="bg-secondary-container text-primary px-2 py-0.5 rounded-md text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-on-surface-variant mb-4 line-clamp-3">
                    {event.shortDescription || event.description}
                  </p>

                  {/* Event Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <CalendarDaysIcon className="h-4 w-4 mr-2 text-outline-variant" />
                      <span>{formatDate(event.startDate)}</span>
                    </div>
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <UsersIcon className="h-4 w-4 mr-2 text-outline-variant" />
                      {/* List tiles read the denormalized counter to avoid N+1 per-card queries;
                          EventWorkspacePage & OverviewTab read live activeRegistrations from EventStats. */}
                      <span>
                        {event.currentAttendees} attendees
                        {event.maxAttendees && ` / ${event.maxAttendees} max`}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <svg className="h-4 w-4 mr-2 text-outline-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{formatEventLocation(event.venue)}</span>
                    </div>
                  </div>

                  {/* Attendee Progress Bar */}
                  {event.maxAttendees && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-on-surface-variant mb-1">
                        <span>Registration Progress</span>
                        <span>{Math.round((event.currentAttendees / event.maxAttendees) * 100)}%</span>
                      </div>
                      <ProgressBar
                        value={Math.min((event.currentAttendees / event.maxAttendees) * 100, 100)}
                        size="sm"
                        color="bg-blue-600"
                        label="Registration progress"
                        showValue
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-outline-variant">
                    {canManage ? (
                      <Link
                        to={`/events/${event.id}`}
                        className="inline-flex min-h-[48px] items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-primary-container text-primary hover:bg-secondary-container active:scale-[0.98] transition-[background-color,color,transform] duration-fast ease-quart"
                        {...prefetchProps}
                      >
                        <span>Manage Event</span>
                        <ArrowRightIcon className="h-4 w-4 transition-transform duration-fast ease-quart group-hover:translate-x-0.5" />
                      </Link>
                    ) : (
                      <Link
                        to={`/e/${event.slug || event.id}`}
                        className="inline-flex min-h-[48px] items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high active:scale-[0.98] transition-[background-color,color,transform] duration-fast ease-quart"
                      >
                        <span>View Public Page</span>
                        <EyeIcon className="h-4 w-4 transition-transform duration-fast ease-quart group-hover:translate-x-0.5" />
                      </Link>
                    )}

                    <button
                      onClick={() => event.status === 'published' ? handleShareEvent(event.id, event.title, event.slug) : null}
                      className={`flex items-center justify-center min-h-[48px] min-w-[48px] rounded-lg transition-colors ${
                        event.status === 'published'
                          ? 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer'
                          : 'text-outline-variant cursor-not-allowed'
                      }`}
                      title={event.status === 'published' ? 'Share Registration Link' : 'Event must be published to share'}
                      disabled={event.status !== 'published'}
                      aria-label="Share Registration Link"
                    >
                      <ShareIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {sortedEvents.length === 0 && (
          <EmptyState
            icon={<CalendarDaysIcon className="h-6 w-6" />}
            title="No events found"
            description={
              searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by creating your first event.'
            }
            action={
              !searchTerm && statusFilter === 'all' && canCreateEvent ? (
                <Link
                  to="/events/create"
                  className="inline-flex items-center min-h-[48px] px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors duration-200 font-medium"
                >
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Create Event
                </Link>
              ) : undefined
            }
          />
        )}



        {/* Feedback modal removed - now using dedicated page */}
      </AppShell>
    );
  };


// No role check of its own: /events is gated on `read 'all'` in App.tsx, which
// only admins hold. The page previously enforced the same rule twice - a
// redirect effect that fired a toast and a `return null` that blanked the screen
// while it did - so an organizer saw a flash, an error, and a bounce.
const ManageEventsPage: React.FC = () => <EventsWorkspace />;

export default ManageEventsPage; 
