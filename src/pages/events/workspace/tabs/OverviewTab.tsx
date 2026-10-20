import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChartBarIcon, 
  UsersIcon, 
  CurrencyDollarIcon, 
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
  EyeIcon,
  DocumentChartBarIcon,
  MapPinIcon,
  TicketIcon,
  AcademicCapIcon,
  TagIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/20/solid';
import { AnalyticsService } from '../../../../services/analyticsService';
import { EventService } from '../../../../services/eventService';
import { RegistrationService } from '../../../../services/registrationService';
import { Event } from '../../../../types';
import { EventStats } from '../../../../services/analyticsService';
import { SimpleBarChart } from '../../../../components/UI';
import { LoadingSpinner } from '../../../../components/UI';
import { ProgressBar } from '../../../../components/UI';
import { Select } from '../../../../components/UI';
import {
  BucketGranularity,
  bucketRegistrationCounts,
  bucketRevenue,
  buildBuckets,
  formatBucketLabel,
  formatBucketRange,
} from '../../../../utils/analyticsBuckets';
import toast from 'react-hot-toast';
import { logger } from '../../../../utils/logger';
import { formatDate, formatEventDateTime } from '../../../../utils/dateUtils';
import { formatEventLocation } from '../../../../utils/venueUtils';
// AI imports removed

interface OverviewTabProps {
  /** Required. The tab renders inside /events/:eventId; see AttendeesTab. */
  eventId: string;
}

const RANGE_LABELS: Record<string, string> = {
  '1m': 'Last month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '1y': 'Last year',
};

/**
 * Time-range control for a chart.
 *
 * This replaces a hover-only dropdown (opacity-0 + pointer-events-none until
 * group-hover) that was completely unreachable by keyboard and unreliable under
 * touch. A native <select> is operable everywhere and needs no JS to open.
 */
const TimeRangeSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => (
  <Select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    size="sm"
    aria-label="Chart time range"
    className="w-auto"
  >
    {Object.entries(RANGE_LABELS).map(([key, label]) => (
      <option key={key} value={key}>
        {label}
      </option>
    ))}
  </Select>
);

const OverviewTab: React.FC<OverviewTabProps> = ({ eventId }) => {
  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('3m');
  const [registrationsByDate, setRegistrationsByDate] = useState<Array<{ label: string; value: number }>>([]);
  const [revenueByDate, setRevenueByDate] = useState<Array<{ label: string; value: number }>>([]);

  const RANGE_OPTIONS: ReadonlyArray<{ value: string; label: string; days: number }> = [
    { value: '1m', label: '1M', days: 30 },
    { value: '3m', label: '3M', days: 90 },
    { value: '6m', label: '6M', days: 180 },
    { value: '1y', label: '1Y', days: 365 },
  ];

  const getDaysFromTimeRange = (timeRange: string): number =>
    RANGE_OPTIONS.find((o) => o.value === timeRange)?.days ?? 30;

  /**
   * Coarser ranges aggregate so bars stay readable. 365 daily bars rendered as
   * hairlines; this is the same reason the dashboard switches to weekly at 90d.
   */
  const granularityForTimeRange = (timeRange: string): BucketGranularity => {
    const days = getDaysFromTimeRange(timeRange);
    if (days >= 180) return 'month';
    if (days >= 60) return 'week';
    return 'day';
  };

  /** Label a bucket by its period, formatted in the reporting timezone. */
  const labelFor = (key: string, granularity: BucketGranularity) =>
    granularity === 'day'
      ? formatBucketLabel(key, granularity)
      : formatBucketRange(key, granularity);

  const applyBuckets = (regs: any[], timeRange: string) => {
    const days = getDaysFromTimeRange(timeRange);
    const granularity = granularityForTimeRange(timeRange);
    const buckets = buildBuckets(days, granularity);

    setRegistrationsByDate(
      bucketRegistrationCounts(regs, buckets).map((b) => ({
        label: labelFor(b.key, granularity),
        value: b.count,
      }))
    );
    setRevenueByDate(
      bucketRevenue(regs, buckets).map((b) => ({
        label: labelFor(b.key, granularity),
        value: b.amount,
      }))
    );
  };

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);

        const eventData = await EventService.getEvent(eventId);
        if (!eventData) throw new Error('Event not found');
        setEvent(eventData);

        const [statsResult, registrationsResult] = await Promise.allSettled([
          AnalyticsService.getEventStats(eventId),
          RegistrationService.getEventRegistrations(eventId),
        ]);

        if (statsResult.status === 'fulfilled') {
          setStats(statsResult.value);
        }
        if (registrationsResult.status === 'fulfilled') {
          setRegistrations(registrationsResult.value);
        }
      } catch (error) {
        logger.error('Error loading analytics:', error);
        toast.error('Failed to load analytics data. Please refresh and try again.');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [eventId]);

  // Re-bucket data when time range changes
  useEffect(() => {
    if (registrations.length > 0) {
      applyBuckets(registrations, selectedTimeRange);
    }
  }, [selectedTimeRange, registrations]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatTicketPricingSummary = (ticketTypes?: any[]) => {
    if (!ticketTypes || ticketTypes.length === 0) return 'Free Admission';
    const prices = ticketTypes.map((t) => Number(t.price || 0));
    const allFree = prices.every((p) => p === 0);
    if (allFree) return 'Free Admission';
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    if (minPrice === 0) {
      return `Free – ${formatCurrency(maxPrice)}`;
    }
    if (minPrice === maxPrice) {
      return formatCurrency(minPrice);
    }
    return `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`;
  };

  const getStatusBadge = (attendanceStatus: string) => {
    switch (attendanceStatus) {
      case 'checked-in':
        return 'bg-green-100 text-green-800';
      case 'no-show':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'registered':
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const formatStatusText = (attendanceStatus: string) => {
    switch (attendanceStatus) {
      case 'checked-in':
        return 'Checked In';
      case 'no-show':
        return 'No Show';
      case 'cancelled':
        return 'Cancelled';
      case 'confirmed':
        return 'Confirmed';
      case 'registered':
        return 'Registered';
      default:
        return attendanceStatus || 'Unknown';
    }
  };

  // AI features removed

  const ticketCapacityFromTypes = event?.ticketTypes?.reduce((total, ticket) => {
    if (typeof ticket.maxQuantity !== 'number') {
      return total;
    }
    return total + ticket.maxQuantity;
  }, 0) ?? 0;

  const normalizedTicketCapacity = ticketCapacityFromTypes > 0 ? ticketCapacityFromTypes : null;
  const venueCapacity = typeof event?.venue?.capacity === 'number' ? event?.venue?.capacity : null;
  const totalCapacity = typeof event?.maxAttendees === 'number'
    ? event.maxAttendees
    : (normalizedTicketCapacity ?? venueCapacity ?? null);

  const ticketsSold = typeof stats?.registrations === 'number'
    ? stats.registrations
    : (typeof event?.currentAttendees === 'number' ? event.currentAttendees : 0);

  const ticketsRemaining = totalCapacity !== null
    ? Math.max(totalCapacity - ticketsSold, 0)
    : null;

  const capacityPct = totalCapacity
    ? Math.min(100, Math.max(0, (ticketsSold / totalCapacity) * 100))
    : null;

  const promoStats = stats?.promoCodeStats;
  const activePromoCodes = promoStats?.allCodes?.filter(code => code.isActive && !code.isExpired) ?? [];
  const topPromoCodes = promoStats?.allCodes?.slice(0, 3) ?? [];

  const ticketBreakdown = event?.ticketTypes?.map(ticket => {
    const capacity = typeof ticket.maxQuantity === 'number' ? ticket.maxQuantity : null;
    const sold = typeof ticket.currentSold === 'number' ? ticket.currentSold : 0;
    const percent = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : null;
    return {
      id: ticket.id,
      name: ticket.name,
      sold,
      capacity,
      percent
    };
  }) ?? [];

  const capacityStatus = (() => {
    if (capacityPct === null) {
      return null;
    }

    if (capacityPct >= 90) {
      return { label: 'Critical', badge: 'bg-red-100 text-red-700' };
    }

    if (capacityPct >= 60) {
      return { label: 'Filling Fast', badge: 'bg-yellow-100 text-yellow-700' };
    }

    return { label: 'Plenty of Seats', badge: 'bg-green-100 text-green-700' };
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  if (!event || !stats) {
    const errorView = (
      <div className="py-xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-on-surface mb-2">Analytics Not Available</h2>
          <p className="text-on-surface-variant mb-lg">Unable to load analytics for this event.</p>
          <Link
            to="/events"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover"
          >
            Back to Events
          </Link>
        </div>
      </div>
    );
    return errorView;
  }

  const eventAnalyticsView = (
    <div className="space-y-8">
      {/* Event Details & Brief */}
      <div
        className="rounded-xl border border-outline-variant bg-white p-6 shadow-sm"
        role="region"
        aria-label="Event Details"
      >
        <div className="pb-6 border-b border-outline-variant space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
            {event.title}
          </h2>
          {(event.shortDescription || event.description) && (
            <p className="text-sm text-on-surface-variant line-clamp-3 leading-relaxed">
              {event.shortDescription || event.description}
            </p>
          )}
        </div>

        {/* 4 Metadata Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          {/* Schedule */}
          <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <CalendarDaysIcon className="h-4 w-4 text-primary" />
              <span>Schedule</span>
            </div>
            <div className="text-sm font-semibold text-on-surface">
              {formatEventDateTime(event.startDate, event.endDate, event.timezone)}
            </div>
            {event.registrationDeadline && (
              <p className="text-xs text-on-surface-variant pt-1">
                Deadline: {formatDate(event.registrationDeadline)}
              </p>
            )}
          </div>

          {/* Venue & Location */}
          <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <MapPinIcon className="h-4 w-4 text-primary" />
              <span>Location</span>
            </div>
            <div className="text-sm font-semibold text-on-surface">
              {formatEventLocation(event.venue, { includeCity: false })}
            </div>
            <p className="text-xs text-on-surface-variant truncate">
              {event.venue?.type === 'online'
                ? (event.venue?.onlineDetails?.meetingUrl ? 'Link configured' : 'Online access')
                : formatEventLocation(event.venue, { includeAddress: true })}
            </p>
          </div>

          {/* Pricing & Tickets */}
          <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <TicketIcon className="h-4 w-4 text-primary" />
              <span>Ticket Pricing</span>
            </div>
            <div className="text-sm font-semibold text-on-surface">
              {formatTicketPricingSummary(event.ticketTypes)}
            </div>
            <p className="text-xs text-on-surface-variant">
              {event.ticketTypes?.length
                ? `${event.ticketTypes.length} ticket ${event.ticketTypes.length === 1 ? 'tier' : 'tiers'}`
                : 'General admission'}
            </p>
          </div>

          {/* Host */}
          <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant space-y-1">
            <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
              <UserCircleIcon className="h-4 w-4 text-primary" />
              <span>Community Host</span>
            </div>
            <div className="text-sm font-semibold text-on-surface truncate">
              {event.organizer?.name || 'GDG Davao'}
            </div>
            <p className="text-xs text-on-surface-variant truncate">
              {event.organizer?.email || 'davao@gdg.org.ph'}
            </p>
          </div>
        </div>

        {/* Speakers (if any) */}
        {event.speakers && event.speakers.length > 0 && (
          <div className="mt-6 pt-5 border-t border-outline-variant">
            <div className="flex items-center gap-2 mb-3">
              <AcademicCapIcon className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                Featured Speakers ({event.speakers.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {event.speakers.map((speaker) => (
                <div
                  key={speaker.id || speaker.name}
                  className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant bg-surface-container-low"
                >
                  {speaker.photoUrl ? (
                    <img
                      src={speaker.photoUrl}
                      alt={speaker.name}
                      className="h-9 w-9 rounded-full object-cover border border-outline-variant flex-shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold text-xs flex-shrink-0">
                      {speaker.name?.slice(0, 2).toUpperCase() || 'SP'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {speaker.name}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {[speaker.title, speaker.company].filter(Boolean).join(' • ') || 'Speaker'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags (if any) */}
        {event.tags && event.tags.length > 0 && (
          <div className="mt-5 pt-4 border-t border-outline-variant flex flex-wrap items-center gap-2">
            <TagIcon className="h-3.5 w-3.5 text-outline-variant flex-shrink-0" />
            <span className="text-xs font-medium text-on-surface-variant mr-1">Tags:</span>
            {event.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-container-high text-on-surface-variant"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Unified Event Pulse & Health Overview */}
      <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-6 mb-8" role="region" aria-label="Event Health and Performance">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-outline-variant">
          <div>
            <h2 className="text-lg font-semibold text-on-surface">Event Health & Performance</h2>
            <p className="text-sm text-on-surface-variant">Live attendee velocity, capacity utilization, and revenue performance.</p>
          </div>
          {capacityStatus && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold self-start sm:self-auto ${capacityStatus.badge}`}>
              {capacityStatus.label}
            </span>
          )}
        </div>

        {/* 4 Performance Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-5">
          {/* Pillar 1: Capacity & Registrations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-on-surface-variant font-medium">
              <span className="flex items-center gap-1.5">
                <UsersIcon className="w-4 h-4 text-primary" />
                Registrations
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container-low text-primary">
                {ticketsRemaining === 0 ? 'Sold Out' : `${ticketsRemaining ?? '—'} left`}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-on-surface">{ticketsSold.toLocaleString()}</span>
              <span className="text-sm text-on-surface-variant">
                / {totalCapacity !== null ? totalCapacity.toLocaleString() : 'Unlimited'}
              </span>
            </div>
            {totalCapacity !== null && (
              <ProgressBar
                value={capacityPct ?? 0}
                size="sm"
                color="bg-blue-600"
                label="Capacity progress"
              />
            )}
          </div>

          {/* Pillar 2: Attendance & Check-In */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-on-surface-variant font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircleIcon className="w-4 h-4 text-success" />
                Checked In
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-success-container text-success">
                {stats?.registrations ? `${Math.round(((stats?.checkedIn || 0) / stats.registrations) * 100)}%` : '0%'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-on-surface">{stats?.checkedIn || 0}</span>
              <span className="text-sm text-on-surface-variant">
                / {stats?.registrations || 0} registered
              </span>
            </div>
            <ProgressBar
              value={stats?.registrations ? Math.min(100, Math.round(((stats?.checkedIn || 0) / stats.registrations) * 100)) : 0}
              size="sm"
              color="bg-emerald-600"
              label="Check-in conversion"
            />
          </div>

          {/* Pillar 3: Gross Revenue */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-on-surface-variant font-medium">
              <span className="flex items-center gap-1.5">
                <CurrencyDollarIcon className="w-4 h-4 text-warning" />
                Revenue
              </span>
              {promoStats && promoStats.totalDiscount > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-container-low text-primary">
                  -{formatCurrency(promoStats.totalDiscount)} promo
                </span>
              )}
            </div>
            <div>
              <span className="text-2xl font-bold text-on-surface">{formatCurrency(stats?.revenue || 0)}</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              {promoStats?.totalUsed ? `${promoStats.totalUsed} promo redemptions` : 'Direct ticket sales'}
            </p>
          </div>

          {/* Pillar 4: Attendee Sentiment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-on-surface-variant font-medium">
              <span className="flex items-center gap-1.5">
                <DocumentChartBarIcon className="w-4 h-4 text-primary" />
                Avg. Rating
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-warning-container text-warning">
                <StarIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>5.0 scale</span>
              </span>
            </div>
            <div>
              <span className="text-2xl font-bold text-on-surface">{stats?.averageRating ? Number(stats.averageRating).toFixed(1) : '—'}</span>
            </div>
            <p className="text-xs text-on-surface-variant">
              Attendee post-event evaluations
            </p>
          </div>
        </div>

        {/* Promo Code & Revenue Breakdown (if event has promo activity) */}
        {promoStats && promoStats.totalUsed > 0 && (
          <div className="mt-6 pt-5 border-t border-outline-variant flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-sm text-on-surface-variant">
            <div className="flex items-center gap-4">
              <span className="font-medium text-on-surface">Promo Activity:</span>
              <span>{promoStats.totalUsed} used ({activePromoCodes.length} active codes)</span>
              <span>•</span>
              <span>Discounted: {formatCurrency(promoStats.totalDiscount)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                With Promo: {formatCurrency(promoStats.revenueWithPromo)}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-warning" />
                Full Price: {formatCurrency(promoStats.revenueWithoutPromo)}
              </span>
            </div>
          </div>
        )}
      </div>

        {capacityPct !== null && (
          <div className="bg-white rounded-lg shadow mb-8 p-6" role="region" aria-label="Ticket inventory breakdown">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">Ticket Inventory Breakdown</h3>
                <p className="text-sm text-on-surface-variant">
                  Track ticket allocations per type to anticipate sell-outs.
                </p>
              </div>
              {capacityStatus && (
                <span className={`inline-flex px-4 py-2 rounded-full text-sm font-semibold ${capacityStatus.badge}`}>
                  Overall Status: {capacityStatus.label}
                </span>
              )}
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-on-surface-variant mb-2">
                <span>Total Capacity Utilization</span>
                <span>{capacityPct.toFixed(0)}%</span>
              </div>
              <div className="h-3 rounded-full bg-surface-container" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-on-surface-variant">
                {ticketsSold.toLocaleString()} sold • {ticketsRemaining?.toLocaleString()} remaining
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {ticketBreakdown.length > 0 ? (
                ticketBreakdown.map(ticket => (
                  <div key={ticket.id} className="border border-outline-variant rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-on-surface">{ticket.name}</p>
                        <p className="text-sm text-on-surface-variant">
                          {ticket.capacity !== null
                            ? `${ticket.sold}/${ticket.capacity} sold`
                            : `${ticket.sold} sold`}
                        </p>
                      </div>
                      {ticket.percent !== null && (
                        <span className="text-sm font-semibold text-on-surface-variant">{ticket.percent}%</span>
                      )}
                    </div>
                    <div className="h-2 rounded-full bg-surface-container-high" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${ticket.percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant">Ticket type data not available.</p>
              )}
            </div>
          </div>
        )}

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface-variant">No Shows</p>
                <p className="text-2xl font-bold text-on-surface">{stats?.noShows || 0}</p>
              </div>
              <XCircleIcon className="h-8 w-8 text-error" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface-variant">Feedback Responses</p>
                <p className="text-2xl font-bold text-on-surface">{stats?.feedbackResponses || 0}</p>
              </div>
              <EyeIcon className="h-8 w-8 text-primary" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-on-surface-variant">Certificates Issued</p>
                <p className="text-2xl font-bold text-on-surface">{stats?.certificatesIssued || 0}</p>
              </div>
              <DocumentChartBarIcon className="h-8 w-8 text-success" />
            </div>
          </div>
        </div>

        {/* Promo Code Usage */}
        {promoStats && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-outline-variant">
              <h3 className="text-lg font-semibold text-on-surface">Promo Code Usage</h3>
            </div>
            <div className="p-6">
              {topPromoCodes.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-on-surface mb-3">Top Performing Codes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {topPromoCodes.map((promo) => (
                      <div key={promo.code} className="border border-outline-variant rounded-lg p-4 bg-surface-container-low">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-on-surface">{promo.code}</span>
                          <span className="text-sm text-on-surface-variant">{promo.usageCount} uses</span>
                        </div>
                        <p className="text-sm text-on-surface-variant truncate">
                          {promo.name}
                        </p>
                        <p className="text-sm text-on-surface-variant mt-2">
                          {formatCurrency(promo.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {promoStats.totalUsed > 0 ? (
                <>
                  {/* Promo Code Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gradient-to-r from-surface-container-low to-surface-container-high rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-surface-container-high rounded-lg">
                          <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-on-surface-variant">Codes Used</p>
                          <p className="text-2xl font-bold text-on-surface">{stats.promoCodeStats.totalUsed}</p>
                          <p className="text-sm text-on-surface-variant">
                            {stats.promoCodeStats.allCodes.filter(c => c.usageCount > 0).length} / {stats.promoCodeStats.allCodes.length} codes
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-success-container to-success-container rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-success-container rounded-lg">
                          <CurrencyDollarIcon className="h-6 w-6 text-success" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-on-surface-variant">Total Discount</p>
                          <p className="text-2xl font-bold text-on-surface">{formatCurrency(stats.promoCodeStats.totalDiscount)}</p>
                          <p className="text-sm text-on-surface-variant">
                            Avg: {stats.promoCodeStats.totalUsed > 0 ? formatCurrency(stats.promoCodeStats.totalDiscount / stats.promoCodeStats.totalUsed) : '₱0'} per use
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-surface-container-low to-primary-container rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-secondary-container rounded-lg">
                          <ChartBarIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-on-surface-variant">Revenue Impact</p>
                          <p className="text-2xl font-bold text-on-surface">{formatCurrency(stats.promoCodeStats.revenueWithPromo)}</p>
                          <p className="text-sm text-on-surface-variant">
                            {((stats.promoCodeStats.revenueWithPromo / (stats?.revenue || 1)) * 100).toFixed(1)}% of total revenue
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-warning-container to-warning-container rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-warning-container rounded-lg">
                          <svg className="h-6 w-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-on-surface-variant">Active Codes</p>
                          <p className="text-2xl font-bold text-on-surface">
                            {stats.promoCodeStats.allCodes.filter(c => c.isActive && !c.isExpired).length}
                          </p>
                          <p className="text-sm text-on-surface-variant">
                            {stats.promoCodeStats.allCodes.filter(c => c.isExpired).length} expired
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* All Promo Codes Table */}
                  {stats.promoCodeStats.allCodes.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-on-surface mb-4">All Promo Codes</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-outline-variant">
                          <thead className="bg-surface-container-low">
                            <tr>
                              <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                                Code
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                                Name & Description
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                                Discount
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                                Usage
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                                Revenue Impact
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-outline-variant">
                            {stats.promoCodeStats.allCodes.map((promoCode, index) => (
                              <tr key={promoCode.code} className={index % 2 === 0 ? 'bg-white' : 'bg-surface-container-low'}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary-container text-on-primary-container">
                                      {promoCode.code}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-on-surface">{promoCode.name}</div>
                                  {promoCode.description && (
                                    <div className="text-sm text-on-surface-variant max-w-xs truncate">{promoCode.description}</div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                                  <div>
                                    {promoCode.discountType === 'percentage' 
                                      ? `${promoCode.discountValue}%` 
                                      : `${formatCurrency(promoCode.discountValue)}`
                                    }
                                  </div>
                                  <div className="text-sm text-on-surface-variant">
                                    Total saved: {formatCurrency(promoCode.totalDiscount)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                                  <div className="flex items-center">
                                    <span className="font-medium">{promoCode.usageCount}</span>
                                    <span className="ml-1 text-outline-variant">used</span>
                                  </div>
                                  {promoCode.maxUses && (
                                    <div className="text-sm text-on-surface-variant">
                                      {promoCode.remainingUses} / {promoCode.maxUses} remaining
                                    </div>
                                  )}
                                  {!promoCode.maxUses && (
                                    <div className="text-sm text-success">Unlimited</div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex flex-col space-y-1">
                                    <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                                      promoCode.isExpired
                                        ? 'bg-error-container text-on-error-container'
                                        : promoCode.isActive
                                        ? 'bg-success-container text-on-success-container'
                                        : 'bg-surface-container text-on-surface'
                                    }`}>
                                      {promoCode.isExpired ? 'Expired' : promoCode.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    {promoCode.validUntil && (
                                      <div className="text-sm text-on-surface-variant">
                                        Until: {formatDate(promoCode.validUntil)}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-on-surface">
                                  <div>
                                    {formatCurrency(promoCode.revenue)}
                                  </div>
                                  {promoCode.usageCount > 0 && (
                                    <div className="text-sm text-on-surface-variant">
                                      Avg: {formatCurrency(promoCode.revenue / promoCode.usageCount)} per use
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* No Promo Codes Used State */
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-outline-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-on-surface">No Promo Codes Used</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    No attendees have used promo codes for this event yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Registrations */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="text-lg font-semibold text-on-surface">Recent Registrations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-outline-variant">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Attendee
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-outline-variant">
                {registrations.slice(0, 5).map((registration) => (
                  <tr key={registration.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-on-surface">
                          {registration.userDetails?.name}
                        </div>
                        <div className="text-sm text-on-surface-variant">
                          {registration.userDetails?.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                      {registration.userDetails?.organization || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${getStatusBadge(registration.attendanceStatus)}`}>
                        {formatStatusText(registration.attendanceStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface">
                      {formatCurrency(registration.totalAmount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">
                      {formatDate(registration.registrationDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );

  return eventAnalyticsView;
};

export default OverviewTab;


