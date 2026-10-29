import React, { useState, useEffect, useMemo } from 'react';
import { useAbility } from '@casl/react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  QrCodeIcon,
  TagIcon,
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
  MapPinIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import AppShell from '../../../layout/AppShell';
import { LoadingSpinner } from '../../../components/UI';
import { Tabs, TabPanel } from '../../../components/UI';
import type { TabItem } from '../../../components/UI';
import { Badge } from '../../../components/UI';
import { EventService } from '../../../services/eventService';
import { RegistrationService } from '../../../services/registrationService';
import { AnalyticsService } from '../../../services/analyticsService';
import { asEvent } from '../../../auth/ability';
import { Event } from '../../../types';
import { logger } from '../../../utils/logger';
import { useAuth } from '../../../contexts/AuthContext';
import { formatEventDate } from '../../../utils/dateUtils';
import { formatEventLocation } from '../../../utils/venueUtils';
import usePageTitle from '../../../hooks/usePageTitle';

// One panel per tab. Each takes the eventId this page already resolved, so
// none of them reads the route or asks whether it is "embedded".
import OverviewTab from './tabs/OverviewTab';
import AttendeesTab from './tabs/AttendeesTab';
import ResponsesTab from './tabs/ResponsesTab';
import CheckInTab from './tabs/CheckInTab';
import PromoCodesTab from './tabs/PromoCodesTab';
import CertificatesTab from './tabs/CertificatesTab';
import FeedbackTab from './tabs/FeedbackTab';
import SettingsTab from './tabs/SettingsTab';

export type EventWorkspaceTab =
  | 'overview'
  | 'attendees'
  | 'responses'
  | 'check-in'
  | 'promo-codes'
  | 'certificates'
  | 'feedback'
  | 'settings';

/**
 * Slugs of tabs that used to exist. An organizer's bookmark, a screenshot in a
 * chat, or a link in an old email still resolves to one of these, and falling
 * through to the TABS validation would silently render Overview — which reads as
 * "my event has no payments data" rather than "that screen moved".
 */
const REMOVED_TAB_REDIRECTS: Record<string, EventWorkspaceTab> = {
  payments: 'attendees',
  emails: 'attendees',
};

interface TabConfig {
  id: EventWorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: ChartBarIcon },
  { id: 'attendees', label: 'Attendees', icon: UserGroupIcon },
  { id: 'responses', label: 'Responses', icon: ClipboardDocumentListIcon },
  { id: 'check-in', label: 'Check-In', icon: QrCodeIcon },
  { id: 'promo-codes', label: 'Promo Codes', icon: TagIcon },
  { id: 'certificates', label: 'Certificates', icon: AcademicCapIcon },
  { id: 'feedback', label: 'Feedback', icon: ChatBubbleLeftRightIcon },
  { id: 'settings', label: 'Settings', icon: Cog6ToothIcon },
];

const EventWorkspacePage: React.FC = () => {
  const { eventId, tab } = useParams<{ eventId: string; tab?: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const ability = useAbility();

  const [event, setEvent] = useState<Event | null>(null);
  const [activeRegistrations, setActiveRegistrations] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Dynamically filter tabs based on user permissions and capabilities
  const visibleTabs = useMemo(() => {
    return TABS.filter((t) => {
      if (t.id === 'certificates' && !ability.can('read', 'Certificate')) return false;
      if ((t.id === 'attendees' || t.id === 'responses') && !ability.can('read', 'Registration')) return false;
      if (t.id === 'check-in') {
        if (!ability.can('read', 'Registration')) return false;
        if (userProfile?.role === 'organizer' && userProfile?.permissions?.checkin?.canCheckIn === false) return false;
      }
      if (t.id === 'promo-codes') {
        if (userProfile?.role === 'organizer' && userProfile?.permissions?.events?.canUpdate === false) return false;
      }
      if (t.id === 'feedback') {
        if (userProfile?.role === 'organizer' && userProfile?.permissions?.feedback?.canRead === false) return false;
      }
      return true;
    });
  }, [ability, userProfile]);

  // The primitive takes ReactNode icons; visibleTabs holds component references.
  const tabItems: TabItem[] = useMemo(
    () =>
      visibleTabs.map(({ id, label, icon: Icon }) => ({
        id,
        label,
        icon: <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />,
      })),
    [visibleTabs],
  );

  // Validate the active tab against visibleTabs rather than repeating all seven ids in
  // a second array, which is how an eighth tab would have been added to one and
  // not the other. Retired slugs resolve first and land on their new home with
  // an explanation, never silently on Overview.
  const retiredTarget = tab ? REMOVED_TAB_REDIRECTS[tab] : undefined;

  const activeTab: EventWorkspaceTab = useMemo(() => {
    const requested = tab as string | undefined;
    if (!requested) return visibleTabs[0]?.id ?? 'overview';
    if (REMOVED_TAB_REDIRECTS[requested]) return REMOVED_TAB_REDIRECTS[requested];
    return visibleTabs.some((t) => t.id === requested) ? (requested as EventWorkspaceTab) : (visibleTabs[0]?.id ?? 'overview');
  }, [tab, visibleTabs]);

  const activeTabLabel = useMemo(
    () => TABS.find((t) => t.id === activeTab)?.label || 'Event Workspace',
    [activeTab]
  );

  usePageTitle({
    title: activeTabLabel,
    contextTitle: event?.title || 'Event Workspace',
  });

  // Cache visited tabs so switching between tabs doesn't destroy state, refetch data,
  // or flash loading skeletons/spinners.
  const [visitedTabs, setVisitedTabs] = useState<Set<EventWorkspaceTab>>(
    () => new Set([activeTab])
  );

  useEffect(() => {
    setVisitedTabs((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
    setVisitedTabs(new Set([activeTab]));
  }, [eventId]);

  // Announce the move and rewrite the URL, so a refresh of the pasted link does
  // not re-announce it forever.
  useEffect(() => {
    if (!retiredTarget || !eventId) return;
    toast(
      tab === 'payments'
        ? 'Payment verification moved into the Attendees tab.'
        : 'Email management moved into each attendee’s details.',
      { id: `moved-${tab}` }
    );
    navigate(`/events/${eventId}/${retiredTarget}`, { replace: true });
  }, [tab, retiredTarget, eventId, navigate]);

  // Load event details
  useEffect(() => {
    let isMounted = true;

    const loadEvent = async () => {
      if (!eventId) return;
      try {
        setLoading(true);
        const [eventResult, statsResult] = await Promise.allSettled([
          EventService.getEvent(eventId),
          AnalyticsService.getEventStats(eventId),
        ]);

        if (eventResult.status === 'rejected') {
          throw eventResult.reason;
        }

        const data = eventResult.value;
        if (isMounted) {
          setEvent(data);
          if (statsResult.status === 'fulfilled') {
            const stats = statsResult.value;
            setActiveRegistrations(
              typeof stats.activeRegistrations === 'number'
                ? stats.activeRegistrations
                : stats.registrations
            );
          } else {
            logger.warn('[EventWorkspace] Prewarm stats skipped/failed:', statsResult.reason);
          }
          if (data && ability.can('read', 'Registration')) {
            void RegistrationService.prefetchEventRegistrations(eventId);
          }
        }
      } catch (error) {
        logger.error('[EventWorkspace] Failed to fetch event:', error);
        toast.error('Failed to load event details. Please refresh the page.');
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
  }, [eventId, ability, currentUser?.uid, userProfile?.uid]);

  const handleTabChange = (targetTab: EventWorkspaceTab) => {
    if (!eventId) return;
    navigate(`/events/${eventId}/${targetTab}`);
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

  if (loading) {
    return (
      <AppShell title="Event Workspace" subtitle="Loading event workspace...">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner />
        </div>
      </AppShell>
    );
  }

  if (!event || !eventId) {
    return (
      <AppShell title="Event Workspace" subtitle="Event not found">
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
      </AppShell>
    );
  }

  const canAccessWorkspace = ability.can('read', 'Event');
  if (!canAccessWorkspace) {
    return (
      <AppShell title="Event Workspace" subtitle="Access Restricted">
        <div className="rounded-xl border border-outline-variant bg-white p-12 text-center shadow-sm max-w-2xl mx-auto">
          <p className="text-base font-semibold text-on-surface">Workspace Access Restricted</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            You do not have permission to view events on this platform.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/events"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-outline-variant bg-white px-5 py-2.5 text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Return to Events
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={event.title}
      subtitle={formatEventLocation(event.venue, { includeAddress: true })}
      fullWidth={true}
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
          <Link
            to={`/events/${eventId}/preview`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-outline-variant bg-white px-3.5 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:border-outline active:scale-[0.98] transition-[background-color,border-color,transform] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            title="Preview Event Registration Page"
          >
            <EyeIcon className="h-4 w-4 text-on-surface-variant" />
            <span className="hidden sm:inline">Preview Page</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Breadcrumb & Event Overview Strip */}
        <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2">
              <Link
                to="/events"
                className="text-sm font-medium text-on-surface-variant hover:text-primary-hover transition-colors"
                title="Back to All Events"
              >
                Events
              </Link>
              <span className="text-outline-variant" aria-hidden="true">/</span>
              <span className="text-sm font-semibold text-on-surface truncate max-w-[200px] sm:max-w-xs md:max-w-md" aria-current="page">
                {event.title}
              </span>
              <div className="ml-1">{getStatusBadge(event.status)}</div>
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-on-surface-variant sm:text-sm">
            <div className="flex items-center gap-1.5">
              <CalendarDaysIcon className="h-4 w-4 text-outline-variant" />
              <span>{formatEventDate(event.startDate)}</span>
            </div>
            <div
              className="flex items-center gap-1.5 max-w-[200px] sm:max-w-xs md:max-w-sm"
              title={formatEventLocation(event.venue, { includeAddress: true })}
            >
              <MapPinIcon className="h-4 w-4 shrink-0 text-outline-variant" />
              <span className="truncate">{formatEventLocation(event.venue)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserGroupIcon className="h-4 w-4 text-outline-variant" />
              <span>
                Attendees {activeRegistrations ?? (event.currentAttendees || 0)}
                {event.maxAttendees ? ` / ${event.maxAttendees}` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Tab navigation. The shared Tabs primitive rather than a fourth
            hand-rolled tablist: it carries the roving tabindex, so this strip is
            one tab stop with arrow/Home/End between tabs instead of eight tab
            presses, and the panel it controls is focusable. */}
        <div className="relative rounded-xl border border-outline-variant bg-white p-1.5 sm:p-2 shadow-sm">
          <Tabs
            label="Event management tabs"
            items={tabItems}
            activeId={activeTab}
            onChange={handleTabChange}
            fullWidth
          />
        </div>

        {/* Tab Panel Content */}
        <TabPanel id={activeTab} labelledBy={`tab-${activeTab}`} className="pb-12 sm:pb-16">
          <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
            {visitedTabs.has('overview') && <OverviewTab eventId={eventId} />}
          </div>
          <div className={activeTab === 'attendees' ? 'block' : 'hidden'}>
            {visitedTabs.has('attendees') && <AttendeesTab eventId={eventId} />}
          </div>
          <div className={activeTab === 'responses' ? 'block' : 'hidden'}>
            {visitedTabs.has('responses') && <ResponsesTab eventId={eventId} />}
          </div>
          <div className={activeTab === 'check-in' ? 'block' : 'hidden'}>
            {visitedTabs.has('check-in') && <CheckInTab eventId={eventId} />}
          </div>
          <div className={activeTab === 'promo-codes' ? 'block' : 'hidden'}>
            {visitedTabs.has('promo-codes') && <PromoCodesTab eventId={eventId} />}
          </div>
          <div className={activeTab === 'certificates' ? 'block' : 'hidden'}>
            {visitedTabs.has('certificates') && <CertificatesTab eventId={eventId} />}
          </div>
          <div className={activeTab === 'feedback' ? 'block' : 'hidden'}>
            {visitedTabs.has('feedback') && <FeedbackTab eventId={eventId} />}
          </div>
          <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
            {visitedTabs.has('settings') && (
              <SettingsTab event={event} onEventUpdated={setEvent} />
            )}
          </div>
        </TabPanel>
      </div>
    </AppShell>
  );
};

export default EventWorkspacePage;
