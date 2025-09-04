import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChartBarIcon, 
  CalendarDaysIcon, 
  UserGroupIcon, 
  PlusIcon,
  ArrowTrendingUpIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import { AnalyticsService, DashboardStats } from '../../services/analyticsService';
import { EventService } from '../../services/eventService';
import { PaymentService, PaymentVerificationData } from '../../services/paymentService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

// Reusable components for better organization
const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  growth: number;
  color: string;
}> = ({ title, value, icon: Icon, growth, color }) => (
  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-4">
      <div className={`p-3 ${color} rounded-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="text-right">
        <p className="text-2xl font-bold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-sm text-gray-600">{title}</p>
      </div>
    </div>
    <div className="flex items-center text-sm">
      <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
      <span className="text-green-600 font-medium">+{growth}%</span>
      <span className="text-gray-500 ml-1">this month</span>
    </div>
  </div>
);

const QuickActionCard: React.FC<{
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  gradient: string;
  badge?: number;
  urgent?: boolean;
}> = ({ title, description, icon: Icon, href, gradient, badge, urgent }) => (
  <Link
    to={href}
    className={`group ${gradient} text-white rounded-xl p-6 hover:shadow-xl transition-all duration-200 shadow-lg relative`}
  >
    <div className="flex items-center space-x-3">
      <div className="p-2 bg-white/20 rounded-lg">
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-white/80 text-sm">{description}</p>
      </div>
    </div>
    {badge && badge > 0 && (
      <div className={`absolute top-2 right-2 w-3 h-3 ${urgent ? 'bg-red-400' : 'bg-yellow-400'} rounded-full animate-pulse`}></div>
    )}
  </Link>
);

const EventCard: React.FC<{
  event: any;
  getDateFromTimestamp: (timestamp: any) => Date;
}> = ({ event, getDateFromTimestamp }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckIcon className="w-4 h-4" />;
      case 'upcoming': return <ClockIcon className="w-4 h-4" />;
      case 'ongoing': return <ArrowTrendingUpIcon className="w-4 h-4" />;
      default: return <ClockIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className="flex-shrink-0">
          {getStatusIcon(event.status)}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-gray-900 truncate">{event.title}</h4>
          <div className="flex items-center mt-1 text-sm text-gray-600 space-x-3">
            <span>{getDateFromTimestamp(event.startDate).toLocaleDateString()}</span>
            <span>{event.currentAttendees}/{event.maxAttendees || '∞'} attendees</span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
          {event.status}
        </span>
        <Link 
          to={`/events/${event.id}`}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white transition-colors"
        >
          <EyeIcon className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    totalRegistrations: 0,
    pendingApprovals: 0,
    certificatesIssued: 0,
    upcomingEvents: 0,
    monthlyGrowth: { events: 0, registrations: 0, certificates: 0 },
    totalRevenue: 0,
    pendingPayments: 0
  });

  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PaymentVerificationData[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PaymentVerificationData[]>([]);
  const { currentUser, userProfile } = useAuth();

  // Helper function to handle different timestamp formats
  const getDateFromTimestamp = useCallback((timestamp: any): Date => {
    if (timestamp?.toDate) return timestamp.toDate();
    if (timestamp?.seconds) return new Date(timestamp.seconds * 1000);
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'number') return new Date(timestamp);
    if (timestamp?._methodName === 'serverTimestamp') {
      console.warn('Unresolved serverTimestamp found, using current date');
      return new Date();
    }
      console.warn('Invalid timestamp format:', timestamp);
      return new Date();
  }, []);

  // Load dashboard data with optimistic UI
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser || !userProfile || userProfile.role !== 'admin') return;
      
      try {
        setLoading(true);
        
        // Fetch all data in parallel for better performance
        const [
          dashboardStats, 
          events, 
          pendingPaymentProofs
        ] = await Promise.all([
          AnalyticsService.getDashboardStats(),
          EventService.getPublishedEvents(),
          PaymentService.getPaymentProofsByStatus('pending')
        ]);
        
        // Update UI immediately (optimistic)
        setStats(dashboardStats);
        
        // Get recent events (last 5)
        const sortedEvents = events
          .sort((a, b) => getDateFromTimestamp(b.createdAt).getTime() - getDateFromTimestamp(a.createdAt).getTime())
          .slice(0, 5);
        setRecentEvents(sortedEvents);
        
        // Set pending payment proofs as pending approvals
        setPendingApprovals(pendingPaymentProofs);
        setPendingPayments(pendingPaymentProofs);
        
        // Update stats with real pending data
        setStats(prev => ({
          ...prev,
          pendingApprovals: pendingPaymentProofs.length,
          pendingPayments: pendingPaymentProofs.length
        }));
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
        // Revert to previous state on error
        setStats(prev => ({ ...prev }));
      } finally {
        setLoading(false);
      }
    };

      fetchDashboardData();
  }, [currentUser?.uid, userProfile?.role, getDateFromTimestamp]);

  // Optimistic approval handling
  const handleQuickApproval = useCallback(async (approvalId: string, action: 'approve' | 'reject') => {
    // Optimistically update UI
    setPendingApprovals(prev => prev.filter(approval => approval.id !== approvalId));
    setPendingPayments(prev => prev.filter(payment => payment.id !== approvalId));
    
    try {
      // Call the actual API
      await PaymentService.verifyPaymentProof(
        approvalId, 
        action === 'approve' ? 'approved' : 'rejected',
        currentUser?.uid || '',
        userProfile?.displayName || 'Admin'
      );
      
      // Update stats
      setStats(prev => ({
        ...prev,
        pendingApprovals: Math.max(0, prev.pendingApprovals - 1),
        pendingPayments: Math.max(0, prev.pendingPayments - 1)
      }));
      
      // Show success feedback
      toast.success(`Payment ${action}d successfully`);
    } catch (error) {
      console.error(`Error ${action}ing payment:`, error);
      toast.error(`Failed to ${action} payment`);
      
      // Revert optimistic update on error
      const approval = pendingApprovals.find(a => a.id === approvalId);
      if (approval) {
        setPendingApprovals(prev => [...prev, approval]);
        setPendingPayments(prev => [...prev, approval]);
      }
    }
  }, [currentUser?.uid, userProfile?.displayName, pendingApprovals]);

  if (loading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Loading your dashboard...">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const getWelcomeMessage = () => {
    const firstName = userProfile?.displayName?.split(' ')[0] || 'Admin';
    return `Welcome back, ${firstName}! 👋`;
  };

  const getWelcomeSubtitle = () => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning! ☀️' : hour < 17 ? 'Good afternoon! 🌤️' : 'Good evening! 🌙';
    return `${timeGreeting} Ready to manage some amazing events?`;
  };

  return (
    <AdminLayout 
      title={getWelcomeMessage()} 
      subtitle={getWelcomeSubtitle()}
      actions={
        <Link
          to="/events/create"
          className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Create Event
        </Link>
      }
    >
      <div className="space-y-6">
            {/* Priority Actions Section */}
            {stats.pendingApprovals > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="w-8 h-8 text-orange-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {stats.pendingApprovals} payment verifications need your attention
                </h3>
                <p className="text-gray-600 mb-4">
                  Review and verify pending payment proofs to complete attendee registrations.
                </p>
                <div className="flex space-x-3">
                  <Link
                    to="/payment-verification"
                    className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                  >
                    Review Now
                  </Link>
                  <button className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Remind Me Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Total Events"
            value={stats.totalEvents}
            icon={CalendarDaysIcon}
            growth={stats.monthlyGrowth.events}
            color="bg-blue-500"
          />
          <StatCard
            title="Total Registrations"
            value={stats.totalRegistrations}
            icon={UserGroupIcon}
            growth={stats.monthlyGrowth.registrations}
            color="bg-green-500"
          />
          <StatCard
            title="Certificates Issued"
            value={stats.certificatesIssued}
            icon={AcademicCapIcon}
            growth={stats.monthlyGrowth.certificates}
            color="bg-purple-500"
          />
        </div>

        {/* Quick Actions */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickActionCard
              title="Create Event"
              description="Set up new event"
              icon={CalendarDaysIcon}
              href="/events/create"
              gradient="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            />
            <QuickActionCard
              title="Review Attendees"
              description={stats.pendingApprovals > 0 ? `${stats.pendingApprovals} pending` : "Manage registrations"}
              icon={UserGroupIcon}
              href="/attendees"
              gradient="bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              badge={stats.pendingApprovals > 0 ? stats.pendingApprovals : undefined}
              urgent={stats.pendingApprovals > 10}
            />
            <QuickActionCard
              title="Check In"
              description="Scan QR codes"
              icon={CheckIcon}
              href="/admin/checkin"
              gradient="bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            />
            <QuickActionCard
              title="Analytics"
              description="View insights"
              icon={ChartBarIcon}
              href="/analytics"
              gradient="bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Events */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Recent Events</h3>
                <Link
                  to="/events"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View all →
                </Link>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {recentEvents.map((event) => (
                <EventCard key={event.id} event={event} getDateFromTimestamp={getDateFromTimestamp} />
              ))}
            </div>
          </div>

          {/* Quick Approvals */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-gray-900">Quick Approvals</h3>
                  {stats.pendingApprovals > 10 && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      High Priority
                    </div>
                  )}
                </div>
                <Link
                  to="/payment-verification"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Review all →
                </Link>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {pendingApprovals.slice(0, 3).map((approval) => (
                <div key={approval.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full flex-shrink-0 bg-gray-300 flex items-center justify-center">
                      <span className="text-gray-600 font-medium text-sm">
                        {approval.attendeeName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-gray-900 truncate">{approval.attendeeName}</h4>
                      <p className="text-sm text-gray-600 truncate">{approval.eventTitle}</p>
                      <div className="flex items-center mt-1 text-xs text-gray-500 space-x-2">
                        <span>{new Date(approval.submittedAt).toLocaleDateString()}</span>
                        <span className="font-medium">₱{approval.ticketPrice}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                    <button 
                      onClick={() => handleQuickApproval(approval.id, 'approve')}
                      className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors duration-200"
                      title="Approve"
                    >
                      <CheckIcon className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleQuickApproval(approval.id, 'reject')}
                      className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors duration-200"
                      title="Reject"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {pendingApprovals.length > 3 && (
                <div className="text-center pt-2">
                  <Link
                    to="/payment-verification"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    +{pendingApprovals.length - 3} more pending
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
