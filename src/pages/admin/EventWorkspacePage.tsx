import React, { useState, useEffect, useMemo } from 'react';
import { useAbility } from '@casl/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChartBarIcon,
  UserGroupIcon,
  QrCodeIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
  MapPinIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import DashboardShell from '../../components/shared/DashboardShell';
import LoadingSpinner from '../../components/shared/UI/LoadingSpinner';
import { Tabs, TabPanel } from '../../components/shared/UI';
import type { TabItem } from '../../components/shared/UI';
import Badge from '../../components/shared/UI/Badge';
import { EventService } from '../../services/eventService';
import { asEvent } from '../../auth/ability';
import { Event } from '../../types';
import { logger } from '../../utils/logger';

// Feature subcomponents (embedded)
import AdminAnalyticsPage from './AdminAnalyticsPage';
import AdminAttendeesPage from './AdminAttendeesPage';
import AdminCheckInPage from './AdminCheckInPage';
import AdminPaymentVerificationPage from './AdminPaymentVerificationPage';
import AdminEmailManagementPage from './AdminEmailManagementPage';
import CertificatesPage from '../shared/CertificatesPage';
import AdminEventFeedbackPage from './AdminEventFeedbackPage';
import EventSettingsTab from '../../components/admin/EventSettingsTab';

export type EventWorkspaceTab =
  | 'overview'
  | 'attendees'
  | 'check-in'
  | 'payments'
  | 'emails'
  | 'certificates'
  | 'feedback'
  | 'settings';

interface TabConfig {
  id: EventWorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: ChartBarIcon },
  { id: 'attendees', label: 'Attendees', icon: UserGroupIcon },
  { id: 'check-in', label: 'Check-In', icon: QrCodeIcon },
  { id: 'payments', label: 'Payments', icon: DocumentTextIcon },
  { id: 'emails', label: 'Emails', icon: EnvelopeIcon },
  { id: 'certificates', label: 'Certificates', icon: AcademicCapIcon },
  { id: 'feedback', label: 'Feedback', icon: ChatBubbleLeftRightIcon },
  { id: 'settings', label: 'Settings', icon: Cog6ToothIcon },
];

const EventWorkspacePage: React.FC = () => {
  const { eventId, tab } = useParams<{ eventId: string; tab?: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // The primitive takes ReactNode icons; TABS holds component references.
  const tabItems: TabItem[] = useMemo(
    () =>
      TABS.map(({ id, label, icon: Icon }) => ({
        id,
        label,
        icon: <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />,
      })),
    [],
  );

  // Validate the active tab against TABS rather than repeating all eight ids in
  // a second array, which is how a ninth tab would have been added to one and
  // not the other.
  const activeTab: EventWorkspaceTab = useMemo(() => {
    const requested = tab as EventWorkspaceTab | undefined;
    return requested && TABS.some((t) => t.id === requested) ? requested : 'overview';
  }, [tab]);

  // Load event details
  useEffect(() => {
    let isMounted = true;

    const loadEvent = async () => {
      if (!eventId) return;
      try {
        setLoading(true);
        const data = await EventService.getEvent(eventId);
        if (isMounted) {
          setEvent(data);
        }
      } catch (error) {
        logger.error('[EventWorkspace] Failed to fetch event:', error);
        toast.error('Failed to load event details');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadEvent();

    return () => {
      isMounted = false;
    };
  }, [eventId]);

  const handleTabChange = (targetTab: EventWorkspaceTab) => {
    if (!eventId) return;
    navigate(`/events/${eventId}/${targetTab}`);
  };

  const handleCopyRegistrationLink = async () => {
    if (!event) return;
    const registrationUrl = `${window.location.origin}/e/${event.slug || event.id}`;
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopiedLink(true);
      toast.success('Registration link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error('Could not copy link to clipboard');
    }
  };

  const formatEventDate = (dateVal?: any) => {
    if (!dateVal) return 'Date TBD';
    const date = dateVal?.toDate?.() || new Date(dateVal);
    if (isNaN(date.getTime())) return 'Date TBD';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'published':
        return <Badge tone="success">Published</Badge>;
      case 'in_progress':
        return <Badge tone="info">In Progress</Badge>;
      case 'completed':
        return <Badge tone="info">Completed</Badge>;
      case 'cancelled':
        return <Badge tone="danger">Cancelled</Badge>;
      case 'draft':
      default:
        return <Badge tone="neutral">Draft</Badge>;
    }
  };

  // Hook first, unconditionally. The ability is needed to decide whether this
  // caller may see the workspace at all.
  const ability = useAbility();

  if (loading) {
    return (
      <DashboardShell title="Event Workspace" subtitle="Loading event workspace...">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </DashboardShell>
    );
  }

  // One shell for "missing" and "not yours".
  //
  // firestore.rules:82 lets any authenticated user read a *published* event, and
  // before this check nothing here compared event.organizer.uid against anyone:
  // any logged-in organizer could open /events/<someone-elses-id> and be offered
  // the attendee count, an Edit Event button, all eight tabs, and a Settings tab
  // whose Danger Zone renders an unconditional Delete Event button. The writes
  // would have failed at the rules layer, but the UI should not offer them, and
  // "not found" rather than "forbidden" is also the honest answer - a
  // non-owner has no business learning the event exists.
  if (!event || !eventId || !ability.can('manage', asEvent(event))) {
    return (
      <DashboardShell title="Event Workspace" subtitle="Event not found">
        <div className="rounded-xl border border-outline-variant bg-white p-12 text-center shadow-sm">
          <p className="text-base font-semibold text-on-surface">Event Not Found</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            The event you are looking for may have been removed or does not exist.
          </p>
          <div className="mt-6">
            <Link
              to="/events"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors duration-fast ease-quart hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Return to Events
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const publicUrl = `/e/${event.slug || event.id}`;

  return (
    <DashboardShell
      title={event.title}
      subtitle={
        event.venue?.type === 'online'
          ? 'Virtual Event'
          : `${event.venue?.name ? `${event.venue.name}, ` : ''}${event.venue?.city || 'Davao City'}`
      }
      actions={
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link
            to="/events"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-on-surface-variant transition-[background-color,border-color] duration-fast ease-quart hover:bg-surface-container-low hover:border-outline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            title="Back to All Events"
          >
            <ArrowLeftIcon className="h-4 w-4 text-on-surface-variant" />
            <span className="hidden sm:inline">Back to Events</span>
          </Link>
          <button
            type="button"
            onClick={handleCopyRegistrationLink}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:border-outline active:scale-[0.98] transition-[background-color,border-color,transform] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            title="Copy Public Registration Link"
          >
            {copiedLink ? (
              <CheckIcon className="h-4 w-4 text-success animate-pop-in motion-reduce:animate-none" />
            ) : (
              <ClipboardDocumentIcon className="h-4 w-4 text-on-surface-variant" />
            )}
            <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Copy Link'}</span>
          </button>
          <Link
            to={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:border-outline active:scale-[0.98] transition-[background-color,border-color,transform] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            title="Open Public Event Registration Page"
          >
            <ArrowTopRightOnSquareIcon className="h-4 w-4 text-on-surface-variant" />
            <span className="hidden sm:inline">Public Page</span>
          </Link>
          <Link
            to={`/events/edit/${eventId}`}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover hover:-translate-y-px active:translate-y-0 active:scale-[0.98] transition-[color,background-color,transform] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit Event
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Breadcrumb & Event Overview Strip */}
        <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/events"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-on-surface-variant transition-colors duration-fast ease-quart hover:bg-surface-container hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Back to All Events"
              aria-label="Back to All Events"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/events"
                className="text-sm font-medium text-on-surface-variant hover:text-primary-hover transition-colors"
                title="Back to All Events"
              >
                Events
              </Link>
              <span className="text-outline-variant">/</span>
              <span className="text-sm font-semibold text-on-surface truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                {event.title}
              </span>
              <div className="ml-1">{getStatusBadge(event.status)}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-on-surface-variant sm:text-sm">
            <div className="flex items-center gap-1.5">
              <CalendarDaysIcon className="h-4 w-4 text-outline-variant" />
              <span>{formatEventDate(event.startDate)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPinIcon className="h-4 w-4 text-outline-variant" />
              <span>{event.venue?.city || 'Davao City'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserGroupIcon className="h-4 w-4 text-outline-variant" />
              <span>
                {event.currentAttendees || 0}
                {event.maxAttendees ? ` / ${event.maxAttendees}` : ''} attendees
              </span>
            </div>
          </div>
        </div>

        {/* Tab navigation. The shared Tabs primitive rather than a fourth
            hand-rolled tablist: it carries the roving tabindex, so this strip is
            one tab stop with arrow/Home/End between tabs instead of eight tab
            presses, and the panel it controls is focusable. */}
        <div className="relative rounded-xl border border-outline-variant bg-white px-2 py-2 sm:px-4 sm:py-2.5 shadow-sm">
          <Tabs
            label="Event management tabs"
            items={tabItems}
            activeId={activeTab}
            onChange={handleTabChange}
            className="px-1 py-1 sm:px-2"
          />
        </div>

        {/* Tab Panel Content */}
        <TabPanel id={activeTab} labelledBy={`tab-${activeTab}`} className="pb-12 sm:pb-16">
          {activeTab === 'overview' && (
            <AdminAnalyticsPage isEventSpecific={true} embedded={true} propEventId={eventId} />
          )}
          {activeTab === 'attendees' && (
            <AdminAttendeesPage embedded={true} propEventId={eventId} />
          )}
          {activeTab === 'check-in' && (
            <AdminCheckInPage embedded={true} propEventId={eventId} />
          )}
          {activeTab === 'payments' && (
            <AdminPaymentVerificationPage embedded={true} propEventId={eventId} />
          )}
          {activeTab === 'emails' && (
            <AdminEmailManagementPage embedded={true} propEventId={eventId} />
          )}
          {activeTab === 'certificates' && (
            <CertificatesPage embedded={true} propEventId={eventId} />
          )}
          {activeTab === 'feedback' && (
            <AdminEventFeedbackPage embedded={true} propEventId={eventId} />
          )}
          {activeTab === 'settings' && (
            <EventSettingsTab event={event} onEventUpdated={setEvent} />
          )}
        </TabPanel>
      </div>
    </DashboardShell>
  );
};

export default EventWorkspacePage;
