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
import { RegistrationService } from '../../services/registrationService';
import usePageTitle from '../../hooks/usePageTitle';
import { NotificationService } from '../../services/notificationService';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

// Reusable components for better organization
const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  growth: number;
  color: string;
}> = ({ title, value, icon: Icon, growth, color }) => {
  return (
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
      {!(typeof value === 'number' && value === 0) && (
        <div className="flex items-center text-sm">
          <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
          <span className="text-green-600 font-medium">+{growth}%</span>
          <span className="text-gray-500 ml-1">this month</span>
        </div>
      )}
    </div>
  );
};

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
          to={event.slug ? `/e/${event.slug}` : `/events/${event.id}/register`}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white transition-colors"
        >
          <EyeIcon className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};

const AttendeeCard: React.FC<{
  registration: any;
  getDateFromTimestamp: (timestamp: any) => Date;
}> = ({ registration, getDateFromTimestamp }) => {
  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckIcon className="w-4 h-4" />;
      case 'pending': return <ClockIcon className="w-4 h-4" />;
      case 'failed': return <XMarkIcon className="w-4 h-4" />;
      default: return <ClockIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full flex-shrink-0 bg-gray-300 flex items-center justify-center">
          <span className="text-gray-600 font-medium text-sm">
            {registration.userDetails?.name?.charAt(0).toUpperCase() || 'A'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-gray-900 truncate">{registration.userDetails?.name || 'Unknown'}</h4>
          <p className="text-sm text-gray-600 truncate">{registration.userDetails?.email || 'No email'}</p>
          <div className="flex items-center mt-1 text-xs text-gray-500 space-x-2">
            <span>{getDateFromTimestamp(registration.registrationDate).toLocaleDateString()}</span>
            <span className="font-medium">₱{registration.totalAmount || 0}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(registration.paymentStatus)}`}>
          {registration.paymentStatus}
        </span>
        <Link 
          to={`/attendees`}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white transition-colors"
          title="View Details"
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
  const [pendingAttendees, setPendingAttendees] = useState<any[]>([]);
  const [previousPendingCount, setPreviousPendingCount] = useState(0);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const { currentUser, userProfile } = useAuth();

  // Set page title
  usePageTitle();

  // Helper function to handle different timestamp formats
  const getDateFromTimestamp = useCallback((timestamp: any): Date => {
    if (timestamp?.toDate) return timestamp.toDate();
    if (timestamp?.seconds) return new Date(timestamp.seconds * 1000);
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'number') return new Date(timestamp);
    if (timestamp?._methodName === 'serverTimestamp') {
      logger.warn('Unresolved serverTimestamp found, using current date');
      return new Date();
    }
    logger.warn('Invalid timestamp format:', timestamp);
    return new Date();
  }, []);

  // Reminder management functions
  const REMINDER_STORAGE_KEY = 'admin_pending_reminder';
  const REMINDER_DURATION_HOURS = 2; // Remind again after 2 hours

  const saveReminderState = useCallback((dismissed: boolean, reminderTime: Date | null) => {
    try {
      const reminderData = {
        dismissed,
        reminderTime: reminderTime?.toISOString() || null,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminderData));
    } catch (error) {
      logger.warn('Failed to save reminder state:', error);
    }
  }, []);

  const loadReminderState = useCallback(() => {
    try {
      const saved = localStorage.getItem(REMINDER_STORAGE_KEY);
      if (saved) {
        const reminderData = JSON.parse(saved);
        const savedReminderTime = reminderData.reminderTime ? new Date(reminderData.reminderTime) : null;
        
        // Check if reminder time has passed
        if (savedReminderTime && new Date() >= savedReminderTime) {
          // Reminder time has passed, reset the state
          localStorage.removeItem(REMINDER_STORAGE_KEY);
          return { dismissed: false, reminderTime: null };
        }
        
        return {
          dismissed: reminderData.dismissed || false,
          reminderTime: savedReminderTime
        };
      }
    } catch (error) {
      logger.warn('Failed to load reminder state:', error);
    }
    return { dismissed: false, reminderTime: null };
  }, []);

  const handleRemindMeLater = useCallback(() => {
    const reminderTime = new Date();
    reminderTime.setHours(reminderTime.getHours() + REMINDER_DURATION_HOURS);
    
    setReminderDismissed(true);
    setReminderTime(reminderTime);
    saveReminderState(true, reminderTime);
    
    toast.success(`Reminder set for ${reminderTime.toLocaleTimeString()}`, {
      duration: 3000,
      icon: '⏰'
    });
  }, [saveReminderState]);

  const shouldShowReminder = useCallback(() => {
    if (!stats.pendingApprovals || stats.pendingApprovals === 0) return false;
    
    const reminderState = loadReminderState();
    return !reminderState.dismissed;
  }, [stats.pendingApprovals, loadReminderState]);

  // Create notifications for new pending attendees
  const createNotificationsForNewAttendees = useCallback(async (newPendingRegistrations: any[]) => {
    if (!currentUser?.uid || !userProfile?.role || userProfile.role !== 'admin') return;

    try {
      // Get event details for each registration
      const registrationsWithEventDetails = await Promise.all(
        newPendingRegistrations.map(async (registration) => {
          try {
            const event = await EventService.getEvent(registration.eventId);
            return {
              ...registration,
              eventTitle: event?.title || 'Unknown Event'
            };
          } catch (error) {
            logger.warn(`Could not fetch event details for ${registration.eventId}:`, error);
            return {
              ...registration,
              eventTitle: 'Unknown Event'
            };
          }
        })
      );

      // Create notifications for each new pending attendee
      const notificationPromises = registrationsWithEventDetails.map(reg => 
        NotificationService.createAdminPendingAttendeeNotification(
          currentUser.uid,
          reg.userDetails?.name || 'Unknown Attendee',
          reg.eventTitle,
          reg.id,
          reg.totalAmount || 0,
          reg.currency || 'PHP'
        )
      );

      await Promise.all(notificationPromises);
      logger.log(`Created ${notificationPromises.length} notifications for new pending attendees`);
    } catch (error) {
      logger.error('Error creating notifications for new attendees:', error);
    }
  }, [currentUser?.uid, userProfile?.role]);

  // Create high priority notification if pending count is high
  const createHighPriorityNotification = useCallback(async (pendingCount: number) => {
    if (!currentUser?.uid || !userProfile?.role || userProfile.role !== 'admin') return;
    if (pendingCount < 10) return; // Only notify for high counts

    try {
      await NotificationService.createAdminHighPendingCountNotification(
        currentUser.uid,
        pendingCount
      );
      logger.log(`Created high priority notification for ${pendingCount} pending attendees`);
    } catch (error) {
      logger.error('Error creating high priority notification:', error);
    }
  }, [currentUser?.uid, userProfile?.role]);

  // Load reminder state on component mount
  useEffect(() => {
    const reminderState = loadReminderState();
    setReminderDismissed(reminderState.dismissed);
    setReminderTime(reminderState.reminderTime);
  }, [loadReminderState]);

  // Load dashboard data with optimistic UI and notifications
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser || !userProfile || userProfile.role !== 'admin') return;
      
      try {
        setLoading(true);
        
        // Fetch all data in parallel for better performance
        const [
          dashboardStats, 
          events, 
          allRegistrations
        ] = await Promise.all([
          AnalyticsService.getDashboardStats(),
          EventService.getPublishedEvents(),
          RegistrationService.getAllRegistrations()
        ]);
        
        // Update UI immediately (optimistic)
        setStats(dashboardStats);
        
        // Get recent events (last 5)
        const sortedEvents = events
          .sort((a, b) => getDateFromTimestamp(b.createdAt).getTime() - getDateFromTimestamp(a.createdAt).getTime())
          .slice(0, 5);
        setRecentEvents(sortedEvents);
        
        // Get pending attendees (registrations with pending payment status)
        const pendingRegistrations = allRegistrations
          .filter(reg => reg.paymentStatus === 'pending')
          .sort((a, b) => getDateFromTimestamp(b.registrationDate).getTime() - getDateFromTimestamp(a.registrationDate).getTime())
          .slice(0, 5);
        
        setPendingAttendees(pendingRegistrations);
        
        // Check for new pending attendees and create notifications
        const currentPendingCount = pendingRegistrations.length;
        if (currentPendingCount > previousPendingCount) {
          const newPendingRegistrations = pendingRegistrations.slice(0, currentPendingCount - previousPendingCount);
          await createNotificationsForNewAttendees(newPendingRegistrations);
        }
        
        // Create high priority notification if needed
        await createHighPriorityNotification(currentPendingCount);
        
        // Update stats with real pending data
        setStats(prev => ({
          ...prev,
          pendingApprovals: currentPendingCount,
          pendingPayments: currentPendingCount
        }));
        
        // Update previous count for next comparison
        setPreviousPendingCount(currentPendingCount);
        
      } catch (error) {
        logger.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
        // Revert to previous state on error
        setStats(prev => ({ ...prev }));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser?.uid, userProfile?.role, getDateFromTimestamp, previousPendingCount]);

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
        {stats.pendingApprovals > 0 && shouldShowReminder() && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="w-8 h-8 text-orange-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {stats.pendingApprovals} attendee registrations need your attention
                </h3>
                <p className="text-gray-600 mb-4">
                  Review and approve pending attendee registrations to complete their event access.
                </p>
                <div className="flex space-x-3">
                  <Link
                    to="/attendees"
                    className="inline-flex items-center px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                  >
                    Review Now
                  </Link>
                  <button 
                    onClick={handleRemindMeLater}
                    className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Remind Me Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reminder Status Indicator */}
        {stats.pendingApprovals > 0 && reminderDismissed && reminderTime && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <ClockIcon className="w-5 h-5 text-blue-500" />
              <div className="flex-1">
                <p className="text-sm text-blue-800">
                  Reminder set for <span className="font-medium">{reminderTime.toLocaleTimeString()}</span>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  The notification will reappear after the reminder time
                </p>
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

          {/* Latest Pending Attendees */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-semibold text-gray-900">Latest Pending Attendees</h3>
                  {stats.pendingApprovals > 10 && (
                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      High Priority
                    </div>
                  )}
                </div>
                <Link
                  to="/attendees"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Review all →
                </Link>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {pendingAttendees.slice(0, 3).map((attendee) => (
                <AttendeeCard key={attendee.id} registration={attendee} getDateFromTimestamp={getDateFromTimestamp} />
              ))}
              {pendingAttendees.length > 3 && (
                <div className="text-center pt-2">
                  <Link
                    to="/attendees"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    +{pendingAttendees.length - 3} more pending
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
