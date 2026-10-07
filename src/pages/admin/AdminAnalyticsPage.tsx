import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
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
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { AnalyticsService, DashboardStats } from '../../services/analyticsService';
import { EventService } from '../../services/eventService';
import { RegistrationService } from '../../services/registrationService';
import { Event } from '../../types';
import { EventStats } from '../../services/analyticsService';
import DashboardShell from '../../components/shared/DashboardShell';
import SimpleBarChart from '../../components/shared/UI/SimpleBarChart';
import LoadingSpinner from '../../components/shared/UI/LoadingSpinner';
import ProgressBar from '../../components/shared/UI/ProgressBar';
import {
  BucketGranularity,
  bucketRegistrationCounts,
  bucketRevenue,
  buildBuckets,
  formatBucketLabel,
  formatBucketRange,
} from '../../utils/analyticsBuckets';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
// AI imports removed

interface AnalyticsPageProps {
  isEventSpecific?: boolean;
  embedded?: boolean;
  propEventId?: string;
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
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    aria-label="Chart time range"
    className="min-h-[44px] rounded-lg border border-outline-variant bg-white px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
  >
    {Object.entries(RANGE_LABELS).map(([key, label]) => (
      <option key={key} value={key}>
        {label}
      </option>
    ))}
  </select>
);

const AdminAnalyticsPage: React.FC<AnalyticsPageProps> = ({ 
  isEventSpecific = false,
  embedded = false,
  propEventId
}) => {
  const { eventId: paramEventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const queryEventId = searchParams.get('eventId');
  
  // Use propEventId first, then param, then query
  const eventId = propEventId || paramEventId || queryEventId;
  
  const { userProfile } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
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

        if ((isEventSpecific || eventId) && eventId) {
          // Load event-specific analytics
          const [eventData, statsData, registrationsData] = await Promise.all([
            EventService.getEvent(eventId),
            AnalyticsService.getEventStats(eventId),
            RegistrationService.getEventRegistrations(eventId)
          ]);

          setEvent(eventData);
          setStats(statsData);
          setRegistrations(registrationsData);
        } else {
          // Load general analytics (for admin dashboard)
          try {
            const isAdminUser = userProfile?.role === 'admin';
            // Organizers get platform-wide totals only; the registration series is
            // scoped to their own events (Data Privacy Act 2012).
            const dashboardStats = isAdminUser
              ? await AnalyticsService.getDashboardStats()
              : null;
            setDashboard(dashboardStats);
            const allRegs =
              isAdminUser || !userProfile?.uid
                ? await RegistrationService.getAllRegistrations()
                : await RegistrationService.getRegistrationsByOrganizer(userProfile.uid);
            setRegistrations(allRegs);
applyBuckets(allRegs, selectedTimeRange);
          } catch (error) {
            logger.error('Error loading dashboard stats:', error);
          }
        }
      } catch (error) {
        logger.error('Error loading analytics:', error);
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [eventId, isEventSpecific]);

  // Re-bucket data when time range changes
  useEffect(() => {
    if (registrations.length > 0 && !isEventSpecific && !eventId) {
      applyBuckets(registrations, selectedTimeRange);
    }
  }, [selectedTimeRange, registrations, isEventSpecific, eventId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    let date;
    
    // Handle different date formats
    if (timestamp?.toDate) {
      // Firestore Timestamp object
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      // Regular Date object
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      // Date string
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Unix timestamp
      date = new Date(timestamp);
    } else if (timestamp?.seconds && typeof timestamp.seconds === 'number') {
      // Firestore timestamp as plain object (from Firestore emulator or client)
      date = new Date(timestamp.seconds * 1000);
    } else {
      // Try to create a Date object
      date = new Date(timestamp);
    }
    
    // Check if the date is valid
    if (isNaN(date.getTime())) {
      logger.warn('Invalid date:', timestamp);
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
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
    if (embedded) {
      return (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      );
    }
    return (
      <DashboardShell>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      </DashboardShell>
    );
  }

  if (isEventSpecific && (!event || !stats)) {
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
    if (embedded) return errorView;
    return <DashboardShell>{errorView}</DashboardShell>;
  }

  if (!isEventSpecific && !eventId) {
    // General analytics view (admin dashboard)
    return (
      <DashboardShell 
        title="Analytics"
        subtitle="Visualize your events performance over time"
        actions={null}
      >
        {/* Filters */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex space-x-4">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-3 py-2 border border-outline-variant rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="1m">Last Month</option>
              <option value="3m">Last 3 Months</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last Year</option>
            </select>
          </div>
        </div>

        {/* Overview Cards (aligned to real data) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-secondary-container rounded-lg">
                <CalendarDaysIcon className="h-6 w-6 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-on-surface-variant">Total Events</p>
                <p className="text-2xl font-bold text-on-surface">{dashboard?.totalEvents ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-success-container rounded-lg">
                <UsersIcon className="h-6 w-6 text-success" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-on-surface-variant">Total Registrations</p>
                <p className="text-2xl font-bold text-on-surface">{dashboard?.totalRegistrations ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-warning-container rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-warning" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-on-surface-variant">Total Revenue</p>
                <p className="text-2xl font-bold text-on-surface">{formatCurrency(dashboard?.totalRevenue ?? 0)}</p>
              </div>
            </div>
            {/* Revenue growth not computed; omit growth row when data is 0 */}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-surface-container-high rounded-lg">
                <DocumentChartBarIcon className="h-6 w-6 text-primary" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-on-surface-variant">Certificates Issued</p>
                <p className="text-2xl font-bold text-on-surface">{dashboard?.certificatesIssued ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Analytics Charts */}
        <div className="space-y-8 mb-8">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-semibold text-on-surface">Registrations Over Time</h3>
              <TimeRangeSelect value={selectedTimeRange} onChange={setSelectedTimeRange} />
            </div>
            <SimpleBarChart
              data={registrationsByDate}
              xKey="label"
              yKey="value"
              color="#4285f4"
              height={500}
              ariaLabel={`Registrations over the last ${getDaysFromTimeRange(selectedTimeRange)} days`}
            />
          </div>
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-semibold text-on-surface">Revenue Over Time</h3>
              <TimeRangeSelect value={selectedTimeRange} onChange={setSelectedTimeRange} />
            </div>
            <SimpleBarChart
              data={revenueByDate}
              xKey="label"
              yKey="value"
              color="#f9ab00"
              height={500}
              ariaLabel={`Revenue over the last ${getDaysFromTimeRange(selectedTimeRange)} days`}
              formatValue={(v) => formatCurrency(v)}
            />
          </div>
        </div>
      </DashboardShell>
    );
  }

  // Event-specific analytics view
  const eventAnalyticsView = (
    <div className="space-y-8">
      {/* Header (standalone only) */}
      {!embedded && (
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link 
              to="/events" 
              className="inline-flex items-center text-primary hover:text-on-secondary-container"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Events
            </Link>
          </div>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {/* h2, not h1: DashboardShell renders the page's <h1> from the route. This
              screen previously carried three stacked <h1> elements at three
              different sizes. */}
              <h2 className="text-2xl font-bold text-on-surface mb-2">Event Analytics</h2>
              <p className="text-xl text-on-surface-variant">{event?.title}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-on-surface-variant">Event Date</p>
              <p className="font-medium text-on-surface">{formatDate(event?.startDate)}</p>
            </div>
          </div>
        </div>
      )}

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
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning-container text-warning">
                ★ 5.0 scale
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

  if (embedded) {
    return eventAnalyticsView;
  }

  return (
    <DashboardShell>
      {eventAnalyticsView}
    </DashboardShell>
  );
};

export default AdminAnalyticsPage;


