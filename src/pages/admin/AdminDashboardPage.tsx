import React, { useState, useEffect } from 'react';
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
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import AdminNavbar from '../../components/AdminNavbar';

const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAttendees: 0,
    pendingApprovals: 0,
    certificatesIssued: 0,
    upcomingEvents: 0,
    monthlyGrowth: {
      events: 0,
      attendees: 0,
      certificates: 0
    }
  });

  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setStats({
        totalEvents: 24,
        totalAttendees: 1847,
        pendingApprovals: 12,
        certificatesIssued: 943,
        upcomingEvents: 6,
        monthlyGrowth: {
          events: 15.3,
          attendees: 23.1,
          certificates: 18.7
        }
      });
      setLoading(false);
    }, 1000);
  }, []);

  const recentEvents = [
    {
      id: 1,
      title: 'Web Development Workshop',
      date: '2025-01-15',
      attendees: 45,
      maxAttendees: 50,
      status: 'completed',
      revenue: 22500
    },
    {
      id: 2,
      title: 'AI/ML Fundamentals',
      date: '2025-01-20',
      attendees: 78,
      maxAttendees: 100,
      status: 'upcoming',
      revenue: 0
    },
    {
      id: 3,
      title: 'Mobile App Development',
      date: '2025-01-25',
      attendees: 32,
      maxAttendees: 40,
      status: 'ongoing',
      revenue: 24000
    }
  ];

  const pendingApprovals = [
    {
      id: 1,
      attendeeName: 'John Doe',
      eventTitle: 'React Advanced Workshop',
      registrationDate: '2025-01-10',
      email: 'john@example.com',
      avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=4F46E5&color=fff'
    },
    {
      id: 2,
      attendeeName: 'Jane Smith',
      eventTitle: 'Flutter Development',
      registrationDate: '2025-01-11',
      email: 'jane@example.com',
      avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=059669&color=fff'
    },
    {
      id: 3,
      attendeeName: 'Mike Johnson',
      eventTitle: 'DevOps Essentials',
      registrationDate: '2025-01-12',
      email: 'mike@example.com',
      avatar: 'https://ui-avatars.com/api/?name=Mike+Johnson&background=DC2626&color=fff'
    }
  ];

  const quickActions = [
    {
      title: 'Create Event',
      description: 'Set up a new event with speakers and agenda',
      icon: CalendarDaysIcon,
      href: '/admin/events/create',
      color: 'from-blue-500 to-blue-600',
      iconBg: 'bg-blue-500'
    },
    {
      title: 'Review Attendees',
      description: 'Approve or reject pending registrations',
      icon: UserGroupIcon,
      href: '/admin/attendees',
      color: 'from-orange-500 to-orange-600',
      iconBg: 'bg-orange-500',
      badge: stats.pendingApprovals,
      urgent: stats.pendingApprovals > 10
    },
    {
      title: 'Social Media',
      description: 'Create posts with AI-generated captions',
      icon: ShareIcon,
      href: '/admin/social',
      color: 'from-pink-500 to-pink-600',
      iconBg: 'bg-pink-500'
    },
    {
      title: 'Form Builder',
      description: 'Create custom registration and feedback forms',
      icon: DocumentTextIcon,
      href: '/admin/forms',
      color: 'from-green-500 to-green-600',
      iconBg: 'bg-green-500'
    },
    {
      title: 'Certificate Templates',
      description: 'Design and manage certificate templates',
      icon: AcademicCapIcon,
      href: '/admin/certificates',
      color: 'from-purple-500 to-purple-600',
      iconBg: 'bg-purple-500'
    },
    {
      title: 'Analytics & Insights',
      description: 'View detailed analytics with AI insights',
      icon: ChartBarIcon,
      href: '/admin/analytics',
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
      <div className="min-h-screen bg-gray-50">
        <AdminNavbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome back! 👋</h1>
              <p className="mt-2 text-gray-600">Here's your event management overview.</p>
            </div>
            <div className="flex space-x-3">
              <Link
                to="/admin/events/create"
                className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Create Event
              </Link>
            </div>
          </div>
        </div>

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
                  {stats.pendingApprovals} registrations need your attention
                </h3>
                <p className="text-gray-600 mb-4">
                  Review and approve pending attendee registrations to complete their event access.
                </p>
                <div className="flex space-x-3">
                  <Link
                    to="/admin/attendees"
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
                <p className="text-2xl font-bold text-gray-900">{stats.totalAttendees.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Attendees</p>
              </div>
            </div>
            <div className="flex items-center text-sm">
              <ArrowTrendingUpIcon className="w-4 h-4 text-green-500 mr-1" />
              <span className="text-green-600 font-medium">+{stats.monthlyGrowth.attendees}%</span>
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
              to="/admin/analytics" 
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <ChartBarIcon className="w-4 h-4 mr-1" />
              View Full Analytics
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/admin/events/create"
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
              to="/admin/attendees"
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
              to="/admin/social"
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
              to="/admin/certificates"
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
                  to="/admin/events"
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
                          <span>{new Date(event.date).toLocaleDateString()}</span>
                          <span>{event.attendees}/{event.maxAttendees} attendees</span>
                          {event.revenue > 0 && (
                            <span className="text-green-600 font-medium">₱{event.revenue.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                      {event.status}
                    </span>
                    <Link 
                      to={`/admin/events/${event.id}`}
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
                  to="/admin/attendees"
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
                    to="/admin/attendees"
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
      </div>
    </div>
  );
};

export default AdminDashboardPage;
