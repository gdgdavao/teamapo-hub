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
import AdminLayout from '../../components/admin/AdminLayout';
import LoadingSpinner from '../../components/shared/UI/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
// AI imports removed

interface AnalyticsPageProps {
  isEventSpecific?: boolean;
}

// Simple inline bar chart (SVG) to avoid external dependencies
const SimpleBarChart: React.FC<{ data: Array<any>; xKey: string; yKey: string; color?: string; height?: number; formatYAxis?: (v: number)=>string }>
  = ({ data, xKey, yKey, color = '#3b82f6', height = 200, formatYAxis }) => {
  const width = Math.max(600, 18 * (data?.length || 0) + 80);
  const padding = { top: 10, right: 10, bottom: 40, left: 48 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const values = data.map(d => Number(d[yKey]) || 0);
  const maxVal = Math.max(1, ...values);
  const gap = 2;
  const barW = data.length > 0 ? Math.max(6, innerW / data.length - gap) : innerW;
  const yScale = (v: number) => innerH - (v / maxVal) * innerH;
  const ticks = 4;
  const yTicks = Array.from({length: ticks + 1}, (_, i) => Math.round((maxVal / ticks) * i));
  const labelStep = Math.max(1, Math.ceil((data.length || 1) / 8));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <g transform={`translate(${padding.left},${padding.top})`}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={0} x2={innerW} y1={yScale(t)} y2={yScale(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={-8} y={yScale(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#6b7280">
              {formatYAxis ? formatYAxis(t) : t}
            </text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={i} transform={`translate(${i * (barW + gap)},0)`}>
            <rect x={0} y={yScale(Number(d[yKey]) || 0)} width={barW} height={innerH - yScale(Number(d[yKey]) || 0)} fill={color} rx={3}>
              <title>{`${String(d[xKey])}: ${formatYAxis ? formatYAxis(Number(d[yKey])||0) : Number(d[yKey])||0}`}</title>
            </rect>
          </g>
        ))}
        {data.map((d, i) => (
          i % labelStep === 0 ? (
            <text key={`x-${i}`} transform={`translate(${i * (barW + gap) + barW / 2},${innerH + 28}) rotate(-35)`} textAnchor="end" fontSize={9} fill="#6b7280">
              {String(d[xKey]).slice(5)}
            </text>
          ) : null
        ))}
      </g>
    </svg>
  );
};

const AdminAnalyticsPage: React.FC<AnalyticsPageProps> = ({ isEventSpecific = false }) => {
  const { eventId: paramEventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const queryEventId = searchParams.get('eventId');
  
  // Use eventId from URL params first, then from query params
  const eventId = paramEventId || queryEventId;
  
  const { userProfile } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('3m');
  const [registrationsByDate, setRegistrationsByDate] = useState<Array<{ date: string; count: number }>>([]);
  const [revenueByDate, setRevenueByDate] = useState<Array<{ date: string; amount: number }>>([]);

  const getDaysFromTimeRange = (timeRange: string): number => {
    switch (timeRange) {
      case '1m':
        return 30;
      case '3m':
        return 90;
      case '6m':
        return 180;
      case '1y':
        return 365;
      default:
        return 30;
    }
  };

  const buildDateBuckets = (days: number): string[] => {
    const arr: string[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(d.toISOString().split('T')[0]);
    }
    return arr;
  };
  const bucketRegistrations = (regs: any[], days: number) => {
    const buckets = buildDateBuckets(days);
    const counts: Record<string, number> = Object.fromEntries(buckets.map(d => [d, 0]));
    regs.forEach(r => {
      const dt = r.registrationDate?.toDate ? r.registrationDate.toDate() : (r.registrationDate ? new Date(r.registrationDate) : null);
      if (!dt) return;
      const key = dt.toISOString().split('T')[0];
      if (key in counts) counts[key] += 1;
    });
    setRegistrationsByDate(buckets.map(d => ({ date: d, count: counts[d] })));
  };
  const bucketRevenue = (regs: any[], days: number) => {
    const buckets = buildDateBuckets(days);
    const sums: Record<string, number> = Object.fromEntries(buckets.map(d => [d, 0]));
    regs.forEach(r => {
      if (r.paymentStatus !== 'paid') return;
      const dt = r.registrationDate?.toDate ? r.registrationDate.toDate() : (r.registrationDate ? new Date(r.registrationDate) : null);
      if (!dt) return;
      const key = dt.toISOString().split('T')[0];
      if (key in sums) sums[key] += r.totalAmount || 0;
    });
    setRevenueByDate(buckets.map(d => ({ date: d, amount: sums[d] })));
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
            const dashboardStats = await AnalyticsService.getDashboardStats();
            setDashboard(dashboardStats);
            const allRegs = await RegistrationService.getAllRegistrations();
            setRegistrations(allRegs);
            const days = getDaysFromTimeRange(selectedTimeRange);
            bucketRegistrations(allRegs, days);
            bucketRevenue(allRegs, days);
          } catch (error) {
            console.error('Error loading dashboard stats:', error);
          }
        }
      } catch (error) {
        console.error('Error loading analytics:', error);
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
      const days = getDaysFromTimeRange(selectedTimeRange);
      bucketRegistrations(registrations, days);
      bucketRevenue(registrations, days);
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
      console.warn('Invalid date:', timestamp);
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
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    );
  }

  if (isEventSpecific && (!event || !stats)) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Analytics Not Available</h1>
            <p className="text-gray-600 mb-8">Unable to load analytics for this event.</p>
            <Link
              to="/events"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to Events
            </Link>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!isEventSpecific && !eventId) {
    // General analytics view (admin dashboard)
    return (
      <AdminLayout 
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
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              <div className="p-2 bg-blue-100 rounded-lg">
                <CalendarDaysIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{dashboard?.totalEvents ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <UsersIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Registrations</p>
                <p className="text-2xl font-bold text-gray-900">{dashboard?.totalRegistrations ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(dashboard?.totalRevenue ?? 0)}</p>
              </div>
            </div>
            {/* Revenue growth not computed; omit growth row when data is 0 */}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DocumentChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Certificates Issued</p>
                <p className="text-2xl font-bold text-gray-900">{dashboard?.certificatesIssued ?? 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Analytics Charts */}
        <div className="space-y-8 mb-8">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Registrations Over Time</h3>
              <div className="relative group">
                <button className="p-1 rounded hover:bg-gray-100" aria-label="Chart settings" title="Chart settings">
                  <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500" />
                </button>
                <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto z-10">
                  <button onClick={()=>setSelectedTimeRange('1m')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Last Month</button>
                  <button onClick={()=>setSelectedTimeRange('3m')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Last 3 Months</button>
                  <button onClick={()=>setSelectedTimeRange('6m')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Last 6 Months</button>
                  <button onClick={()=>setSelectedTimeRange('1y')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Last Year</button>
                </div>
              </div>
            </div>
            <SimpleBarChart data={registrationsByDate} xKey="date" yKey="count" color="#3b82f6" height={500} />
          </div>
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Revenue Over Time</h3>
              <div className="relative group">
                <button className="p-1 rounded hover:bg-gray-100" aria-label="Chart settings" title="Chart settings">
                  <AdjustmentsHorizontalIcon className="h-5 w-5 text-gray-500" />
                </button>
                <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto z-10">
                  <button onClick={()=>setSelectedTimeRange('1m')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Last Month</button>
                  <button onClick={()=>setSelectedTimeRange('3m')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Last 3 Months</button>
                  <button onClick={()=>setSelectedTimeRange('6m')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Last 6 Months</button>
                  <button onClick={()=>setSelectedTimeRange('1y')} className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50">Last Year</button>
                </div>
              </div>
            </div>
            <SimpleBarChart data={revenueByDate} xKey="date" yKey="amount" color="#f59e0b" height={500} formatYAxis={(v)=>formatCurrency(v)} />
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Event-specific analytics view
  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link 
              to="/events" 
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Events
            </Link>
          </div>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Analytics</h1>
              <p className="text-xl text-gray-600">{event?.title}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Event Date</p>
              <p className="font-medium text-gray-900">{formatDate(event?.startDate)}</p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UsersIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Registrations</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.registrations || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircleIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Checked In</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.checkedIn || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats?.revenue || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DocumentChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg. Rating</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.averageRating || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {(capacityPct !== null || promoStats) && (
          <div className="mb-10 space-y-6" role="region" aria-label="Event health overview">
            <h2 className="text-xl font-semibold text-gray-900">Event Health Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Capacity Progress</p>
                    <p className="text-2xl font-bold text-gray-900">{ticketsSold.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Capacity</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {totalCapacity !== null ? totalCapacity.toLocaleString() : 'Not Set'}
                    </p>
                  </div>
                </div>
                <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                  <span>Tickets Sold</span>
                  <span>{capacityPct !== null ? `${capacityPct.toFixed(0)}%` : '—'}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-200" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${capacityPct ?? 0}%` }}
                  />
                </div>
                {capacityStatus && (
                  <span className={`inline-flex mt-3 px-3 py-1 text-xs font-semibold rounded-full ${capacityStatus.badge}`}>
                    {capacityStatus.label}
                  </span>
                )}
              </div>

              <div className="bg-white rounded-lg border border-gray-100 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Tickets Remaining</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${ticketsRemaining === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {ticketsRemaining !== null ? ticketsRemaining.toLocaleString() : '—'}
                    </p>
                    <p className="text-sm text-gray-500">Available seats</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      ticketsRemaining === 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {ticketsRemaining === 0 ? 'Sold Out' : 'Open'}
                  </span>
                </div>
                <p className="mt-4 text-xs text-gray-500">
                  {totalCapacity !== null
                    ? `${Math.max(0, Math.round((ticketsRemaining ?? 0) / totalCapacity * 100))}% of total seats remain`
                    : 'Set a capacity to track remaining tickets'}
                </p>
              </div>

              <div className="bg-white rounded-lg border border-gray-100 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Promo Code Usage</p>
                <p className="text-3xl font-bold text-gray-900">{promoStats?.totalUsed ?? 0}</p>
                <p className="text-sm text-gray-500 mb-3">Total redemptions</p>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>Active codes</span>
                    <span className="font-semibold text-gray-900">{activePromoCodes.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Discounts granted</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(promoStats?.totalDiscount ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-100 p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Revenue Composition</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency((promoStats?.revenueWithPromo ?? 0) + (promoStats?.revenueWithoutPromo ?? 0))}
                </p>
                <p className="text-sm text-gray-500 mb-3">Total revenue</p>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>With promo</span>
                      <span>{promoStats ? `${Math.round((promoStats.revenueWithPromo / Math.max(promoStats.revenueWithPromo + promoStats.revenueWithoutPromo, 1)) * 100)}%` : '—'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-purple-500"
                        style={{
                          width: promoStats
                            ? `${Math.min(100, Math.round((promoStats.revenueWithPromo / Math.max(promoStats.revenueWithPromo + promoStats.revenueWithoutPromo, 1)) * 100))}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Without promo</span>
                      <span>{promoStats ? `${Math.round((promoStats.revenueWithoutPromo / Math.max(promoStats.revenueWithPromo + promoStats.revenueWithoutPromo, 1)) * 100)}%` : '—'}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-200">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{
                          width: promoStats
                            ? `${Math.min(100, Math.round((promoStats.revenueWithoutPromo / Math.max(promoStats.revenueWithPromo + promoStats.revenueWithoutPromo, 1)) * 100))}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {capacityPct !== null && (
          <div className="bg-white rounded-lg shadow mb-8 p-6" role="region" aria-label="Ticket inventory breakdown">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Ticket Inventory Breakdown</h3>
                <p className="text-sm text-gray-500">
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
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Total Capacity Utilization</span>
                <span>{capacityPct.toFixed(0)}%</span>
              </div>
              <div className="h-3 rounded-full bg-gray-100" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${capacityPct}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {ticketsSold.toLocaleString()} sold • {ticketsRemaining?.toLocaleString()} remaining
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {ticketBreakdown.length > 0 ? (
                ticketBreakdown.map(ticket => (
                  <div key={ticket.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{ticket.name}</p>
                        <p className="text-xs text-gray-500">
                          {ticket.capacity !== null
                            ? `${ticket.sold}/${ticket.capacity} sold`
                            : `${ticket.sold} sold`}
                        </p>
                      </div>
                      {ticket.percent !== null && (
                        <span className="text-xs font-semibold text-gray-500">{ticket.percent}%</span>
                      )}
                    </div>
                    <div className="h-2 rounded-full bg-gray-200" aria-hidden="true">
                      <div
                        className="h-full rounded-full bg-indigo-500"
                        style={{ width: `${ticket.percent ?? 0}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Ticket type data not available.</p>
              )}
            </div>
          </div>
        )}

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">No Shows</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.noShows || 0}</p>
              </div>
              <XCircleIcon className="h-8 w-8 text-red-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Feedback Responses</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.feedbackResponses || 0}</p>
              </div>
              <EyeIcon className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Certificates Issued</p>
                <p className="text-2xl font-bold text-gray-900">{stats?.certificatesIssued || 0}</p>
              </div>
              <DocumentChartBarIcon className="h-8 w-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Promo Code Usage */}
        {promoStats && (
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Promo Code Usage</h3>
            </div>
            <div className="p-6">
              {topPromoCodes.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-medium text-gray-900 mb-3">Top Performing Codes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {topPromoCodes.map((promo) => (
                      <div key={promo.code} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold text-gray-900">{promo.code}</span>
                          <span className="text-xs text-gray-500">{promo.usageCount} uses</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {promo.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
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
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <svg className="h-6 w-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Codes Used</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.promoCodeStats.totalUsed}</p>
                          <p className="text-xs text-gray-500">
                            {stats.promoCodeStats.allCodes.filter(c => c.usageCount > 0).length} / {stats.promoCodeStats.allCodes.length} codes
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CurrencyDollarIcon className="h-6 w-6 text-green-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Discount</p>
                          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.promoCodeStats.totalDiscount)}</p>
                          <p className="text-xs text-gray-500">
                            Avg: {stats.promoCodeStats.totalUsed > 0 ? formatCurrency(stats.promoCodeStats.totalDiscount / stats.promoCodeStats.totalUsed) : '₱0'} per use
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <ChartBarIcon className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Revenue Impact</p>
                          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.promoCodeStats.revenueWithPromo)}</p>
                          <p className="text-xs text-gray-500">
                            {((stats.promoCodeStats.revenueWithPromo / (stats?.revenue || 1)) * 100).toFixed(1)}% of total revenue
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-4">
                      <div className="flex items-center">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <svg className="h-6 w-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Active Codes</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {stats.promoCodeStats.allCodes.filter(c => c.isActive && !c.isExpired).length}
                          </p>
                          <p className="text-xs text-gray-500">
                            {stats.promoCodeStats.allCodes.filter(c => c.isExpired).length} expired
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* All Promo Codes Table */}
                  {stats.promoCodeStats.allCodes.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-900 mb-4">All Promo Codes</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Code
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Name & Description
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Discount
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Usage
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Revenue Impact
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {stats.promoCodeStats.allCodes.map((promoCode, index) => (
                              <tr key={promoCode.code} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                      {promoCode.code}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm font-medium text-gray-900">{promoCode.name}</div>
                                  {promoCode.description && (
                                    <div className="text-sm text-gray-500 max-w-xs truncate">{promoCode.description}</div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <div>
                                    {promoCode.discountType === 'percentage' 
                                      ? `${promoCode.discountValue}%` 
                                      : `${formatCurrency(promoCode.discountValue)}`
                                    }
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Total saved: {formatCurrency(promoCode.totalDiscount)}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  <div className="flex items-center">
                                    <span className="font-medium">{promoCode.usageCount}</span>
                                    <span className="ml-1 text-gray-400">used</span>
                                  </div>
                                  {promoCode.maxUses && (
                                    <div className="text-xs text-gray-500">
                                      {promoCode.remainingUses} / {promoCode.maxUses} remaining
                                    </div>
                                  )}
                                  {!promoCode.maxUses && (
                                    <div className="text-xs text-green-600">Unlimited</div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex flex-col space-y-1">
                                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                      promoCode.isExpired
                                        ? 'bg-red-100 text-red-800'
                                        : promoCode.isActive
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {promoCode.isExpired ? 'Expired' : promoCode.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    {promoCode.validUntil && (
                                      <div className="text-xs text-gray-500">
                                        Until: {formatDate(promoCode.validUntil)}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  <div>
                                    {formatCurrency(promoCode.revenue)}
                                  </div>
                                  {promoCode.usageCount > 0 && (
                                    <div className="text-xs text-gray-500">
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
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No Promo Codes Used</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No attendees have used promo codes for this event yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Registrations */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Registrations</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {registrations.slice(0, 5).map((registration) => (
                  <tr key={registration.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {registration.userDetails?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {registration.userDetails?.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {registration.userDetails?.organization || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(registration.attendanceStatus)}`}>
                        {formatStatusText(registration.attendanceStatus)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(registration.totalAmount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(registration.registrationDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalyticsPage;


