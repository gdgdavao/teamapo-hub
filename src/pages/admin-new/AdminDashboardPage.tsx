import React, { useState, useEffect, useRef } from 'react';
import { 
  ChartBarIcon, 
  CalendarDaysIcon, 
  UserGroupIcon, 
  PlusIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  BellIcon,
  ShareIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
  UserCircleIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout';
import AdminAccessInfo from '../../components/AdminAccessInfo';
import { AnalyticsService, DashboardStats } from '../../services/analyticsService';
import { EventService } from '../../services/eventService';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    totalRegistrations: 0,
    pendingApprovals: 0,
    certificatesIssued: 0,
    upcomingEvents: 0,
    monthlyGrowth: {
      events: 0,
      registrations: 0,
      certificates: 0
    },
    totalRevenue: 0,
    pendingPayments: 0
  });

  const [loading, setLoading] = useState(true);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const fetchingRef = useRef(false);
  const dataFetchedRef = useRef(false);

  const { currentUser, userProfile } = useAuth();

  // Helper function to handle different timestamp formats
  const getDateFromTimestamp = (timestamp: any): Date => {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    } else if (timestamp && timestamp.seconds) {
      // Handle Firestore timestamp format
      return new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      return timestamp;
    } else if (typeof timestamp === 'number') {
      return new Date(timestamp);
    } else if (timestamp && timestamp._methodName === 'serverTimestamp') {
      // Handle unresolved serverTimestamp
      console.warn('Unresolved serverTimestamp found, using current date');
      return new Date();
    } else {
      // Fallback to current date if timestamp is invalid
      console.warn('Invalid timestamp format:', timestamp);
      return new Date();
    }
  };

  // Reset data fetched state when user changes
  useEffect(() => {
    dataFetchedRef.current = false;
    fetchingRef.current = false;
  }, [currentUser?.uid]);

  // Load dashboard data from API
  useEffect(() => {
    const fetchDashboardData = async () => {
      // Prevent multiple simultaneous calls
      if (fetchingRef.current || dataFetchedRef.current) {
        return;
      }
      
      // Set the flag immediately to prevent race conditions
      fetchingRef.current = true;
      
      console.log('📊 Fetching dashboard data...', { 
        currentUser: !!currentUser, 
        userProfile: !!userProfile, 
        role: userProfile?.role,
        dataFetched: dataFetchedRef.current,
        fetching: fetchingRef.current
      });
      
      try {
        setLoading(true);
        
        if (!currentUser) {
          throw new Error('User not authenticated');
        }
        
        if (!userProfile) {
          throw new Error('User profile not loaded');
        }
        
        if (userProfile.role !== 'admin') {
          throw new Error(`User role is '${userProfile.role}', but 'admin' is required`);
        }
        
        // Fetch dashboard stats and recent events in parallel
        const [dashboardStats, events] = await Promise.all([
          AnalyticsService.getDashboardStats(),
          EventService.getPublishedEvents()
        ]);
        
        setStats(dashboardStats);
        
        // Get recent events (last 5)
        const sortedEvents = events
          .sort((a, b) => getDateFromTimestamp(b.createdAt).getTime() - getDateFromTimestamp(a.createdAt).getTime())
          .slice(0, 5);
        setRecentEvents(sortedEvents);
        
        // TODO: Implement pending approvals from registrations service
        setPendingApprovals([]);
        dataFetchedRef.current = true;
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
        fetchingRef.current = false;
      }
    };

    // Only fetch data if user profile is loaded and user is admin and data hasn't been fetched yet
    if (userProfile && userProfile.role === 'admin' && currentUser && !dataFetchedRef.current) {
      fetchDashboardData();
    }
  }, [userProfile?.role, currentUser?.uid]); // More specific dependencies

  const quickActions = [
    {
      title: 'Create Event',
      description: 'Set up a new event with speakers and agenda',
      icon: CalendarDaysIcon,
      href: '/events/create',
      color: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-500'
    },
    {
      title: 'Check-In Station',
      description: 'Scan QR codes and check in attendees',
      icon: QrCodeIcon,
      href: '/admin/checkin',
      color: 'from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-500'
    },
    {
      title: 'Review Attendees',
      description: 'Approve or reject pending registrations',
      icon: UserGroupIcon,
      href: '/attendees',
      color: 'from-orange-500 to-orange-600',
      iconBg: 'bg-orange-500',
      badge: stats.pendingApprovals,
      urgent: stats.pendingApprovals > 10
    },
    {
      title: 'User Management',
      description: 'Manage organizers and admin accounts',
      icon: UserCircleIcon,
      href: '/users',
      color: 'from-teal-500 to-teal-600',
      iconBg: 'bg-teal-500'
    },
    {
      title: 'Social Media',
      description: 'Create posts with AI-generated captions',
      icon: ShareIcon,
      href: '/social',
      color: 'from-pink-500 to-pink-600',
      iconBg: 'bg-pink-500'
    },
    {
      title: 'Form Builder',
      description: 'Create custom registration and feedback forms',
      icon: DocumentTextIcon,
      href: '/forms',
      color: 'from-green-500 to-green-600',
      iconBg: 'bg-green-500'
    },
    {
      title: 'Certificate Templates',
      description: 'Design and manage certificate templates',
      icon: AcademicCapIcon,
      href: '/certificates',
      color: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-500'
    },
    {
      title: 'Analytics & Insights',
      description: 'View detailed analytics with AI insights',
      icon: ChartBarIcon,
      href: '/analytics',
      color: 'from-indigo-500 to-indigo-600',
      iconBg: 'bg-indigo-500'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'ongoing':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckIcon className="w-4 h-4" />;
      case 'upcoming':
        return <ClockIcon className="w-4 h-4" />;
      case 'ongoing':
        return <ArrowUpIcon className="w-4 h-4" />;
      default:
        return <ClockIcon className="w-4 h-4" />;
    }
  };

  const handleQuickApproval = (approvalId: number, action: 'approve' | 'reject') => {
    // Handle approval logic here
    console.log(`${action} approval ${approvalId}`);
  };

  if (loading) {
    return (
      <AdminLayout title="Dashboard" subtitle="Loading your dashboard...">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const headerActions = (
    <Link
      to="/events/create"
      className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
    >
      <PlusIcon className="w-5 h-5 mr-2" />
      Create Event
    </Link>
  );

  // Create dynamic welcome message
  const getWelcomeMessage = () => {
    const firstName = userProfile?.displayName?.split(' ')[0] || 'Admin';
    return `Welcome back, ${firstName}! 👋`;
  };

  const getWelcomeSubtitle = () => {
    const hour = new Date().getHours();
    let timeGreeting = '';
    
    if (hour < 12) {
      timeGreeting = 'Good morning! ☀️';
    } else if (hour < 17) {
      timeGreeting = 'Good afternoon! 🌤️';
    } else {
      timeGreeting = 'Good evening! 🌙';
    }
    
    return `${timeGreeting} Ready to manage some amazing events?`;
  };

  return (
    <AdminLayout 
      title={getWelcomeMessage()} 
      subtitle={getWelcomeSubtitle()}
      actions={headerActions}
    >
      <div className="space-y-6">
        {/* Only show dashboard content if user has admin access */}
        {userProfile?.role === 'admin' && (
          <>
            {/* Priority Actions Section */}
            {stats.pendingApprovals > 0 && (
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="w-8 h-8 text-orange-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {stats.pendingApprovals} registrations need your attention
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
                  <button className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Remind Me Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics - Simplified */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
                <p className="text-sm text-gray-600">Total Events</p>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-600 font-medium">+{stats.monthlyGrowth.events}%</span>
              <span className="text-gray-500 ml-1">this month</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{stats.totalRegistrations.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Registrations</p>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-600 font-medium">+{stats.monthlyGrowth.registrations}%</span>
              <span className="text-gray-500 ml-1">this month</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <AcademicCapIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{stats.certificatesIssued}</p>
                <p className="text-sm text-gray-600">Certificates Issued</p>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-600 font-medium">+{stats.monthlyGrowth.certificates}%</span>
              <span className="text-gray-500 ml-1">this month</span>
            </div>
          </div>
        </div>

        {/* Quick Actions - Streamlined */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            <Link 
              to="/analytics" 
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <ChartBarIcon className="w-4 h-4 mr-1" />
              View Full Analytics
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/events/create"
              className="group bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CalendarDaysIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Create Event</h3>
                  <p className="text-blue-100 text-sm">Set up new event</p>
                </div>
              </div>
            </Link>

            <Link
              to="/attendees"
              className="group bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-lg hover:shadow-xl relative"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <UserGroupIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Review Attendees</h3>
                  <p className="text-orange-100 text-sm">{stats.pendingApprovals} pending</p>
                </div>
              </div>
              {stats.pendingApprovals > 0 && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-red-400 rounded-full animate-pulse"></div>
              )}
            </Link>

            <Link
              to="/payment-verification"
              className="group bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl relative"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CurrencyDollarIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Payment Verification</h3>
                  <p className="text-green-100 text-sm">5 pending payments</p>
                </div>
              </div>
              <div className="absolute top-2 right-2 w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
            </Link>

            <Link
              to="/social"
              className="group bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-xl p-6 hover:from-pink-600 hover:to-pink-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg flex items-center">
                  <ShareIcon className="w-5 h-5 mr-1" />
                  <SparklesIcon className="w-3 h-3" />
                </div>
                <div>
                  <h3 className="font-semibold">AI Social Posts</h3>
                  <p className="text-pink-100 text-sm">Create with AI</p>
                </div>
              </div>
            </Link>

            <Link
              to="/certificates"
              className="group bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <AcademicCapIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">Certificates</h3>
                  <p className="text-purple-100 text-sm">Manage templates</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity - Improved */}
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
                <div key={event.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {getStatusIcon(event.status)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-gray-900 truncate">{event.title}</h4>
                        <div className="flex items-center mt-1 text-sm text-gray-600 space-x-3">
                          <span>{getDateFromTimestamp(event.startDate).toLocaleDateString()}</span>
                          <span>{event.currentAttendees}/{event.maxAttendees || '∞'} attendees</span>
                          {/* TODO: Add revenue calculation when payment system is implemented */}
                        </div>
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
                  to="/attendees"
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
                    <img
                      src={approval.avatar}
                      alt={approval.attendeeName}
                      className="w-10 h-10 rounded-full flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-gray-900 truncate">{approval.attendeeName}</h4>
                      <p className="text-sm text-gray-600 truncate">{approval.eventTitle}</p>
                      <div className="flex items-center mt-1 text-xs text-gray-500 space-x-2">
                        <span>{new Date(approval.registrationDate).toLocaleDateString()}</span>
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
                    to="/attendees"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    +{pendingApprovals.length - 3} more pending
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
