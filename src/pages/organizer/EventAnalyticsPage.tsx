import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ChartBarIcon, 
  UsersIcon, 
  CurrencyDollarIcon, 
  CalendarDaysIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
  TrendingUpIcon,
  TrendingDownIcon
} from '@heroicons/react/24/outline';
import { AnalyticsService } from '../../services/analyticsService';
import { EventService } from '../../services/eventService';
import { RegistrationService } from '../../services/registrationService';
import { Event, EventStats } from '../../types';
import AdminLayout from '../../components/AdminLayout';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import toast from 'react-hot-toast';

const EventAnalyticsPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      if (!eventId) return;
      
      try {
        setLoading(true);
        
        // Load event data and analytics in parallel
        const [eventData, statsData, registrationsData] = await Promise.all([
          EventService.getEvent(eventId),
          AnalyticsService.getEventStats(eventId),
          RegistrationService.getEventRegistrations(eventId)
        ]);
        
        setEvent(eventData);
        setStats(statsData);
        setRegistrations(registrationsData);
      } catch (error) {
        console.error('Error loading analytics:', error);
        toast.error('Failed to load event analytics');
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [eventId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'N/A';
    
    let date;
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp?.seconds && typeof timestamp.seconds === 'number') {
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString()}`;
  };

  const getAttendanceRate = () => {
    if (!stats || stats.registrations === 0) return 0;
    return Math.round((stats.checkedIn / stats.registrations) * 100);
  };

  const getNoShowRate = () => {
    if (!stats || stats.registrations === 0) return 0;
    return Math.round((stats.noShows / stats.registrations) * 100);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    );
  }

  if (!event || !stats) {
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
              <p className="text-xl text-gray-600">{event.title}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Event Date</p>
              <p className="font-medium text-gray-900">{formatDate(event.startDate)}</p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UsersIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Registrations</p>
                <p className="text-2xl font-bold text-gray-900">{stats.registrations}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Checked In</p>
                <p className="text-2xl font-bold text-gray-900">{stats.checkedIn}</p>
                <p className="text-sm text-green-600">{getAttendanceRate()}% attendance</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-8 w-8 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.revenue)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircleIcon className="h-8 w-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">No Shows</p>
                <p className="text-2xl font-bold text-gray-900">{stats.noShows}</p>
                <p className="text-sm text-red-600">{getNoShowRate()}% no-show rate</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Registration Trends */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Trends</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Registrations</span>
                <span className="font-medium text-gray-900">{stats.registrations}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Paid Registrations</span>
                <span className="font-medium text-gray-900">
                  {registrations.filter(r => r.paymentStatus === 'paid').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Free Registrations</span>
                <span className="font-medium text-gray-900">
                  {registrations.filter(r => r.paymentStatus === 'paid' && r.totalAmount === 0).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Pending Payments</span>
                <span className="font-medium text-gray-900">
                  {registrations.filter(r => r.paymentStatus === 'pending').length}
                </span>
              </div>
            </div>
          </div>

          {/* Feedback & Certificates */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Engagement Metrics</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Feedback Responses</span>
                <span className="font-medium text-gray-900">{stats.feedbackResponses}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Average Rating</span>
                <span className="font-medium text-gray-900">
                  {stats.averageRating > 0 ? `${stats.averageRating.toFixed(1)}/5` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Certificates Issued</span>
                <span className="font-medium text-gray-900">{stats.certificatesIssued}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Response Rate</span>
                <span className="font-medium text-gray-900">
                  {stats.registrations > 0 
                    ? `${Math.round((stats.feedbackResponses / stats.registrations) * 100)}%` 
                    : '0%'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Registrations */}
        <div className="mt-8 bg-white rounded-lg shadow-sm">
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
                    Registration Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {registrations.slice(0, 10).map((registration) => (
                  <tr key={registration.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {registration.userDetails?.name || 'Unknown Name'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {registration.userDetails?.email || 'No email'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(registration.registrationDate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        registration.paymentStatus === 'paid' 
                          ? 'bg-green-100 text-green-800'
                          : registration.paymentStatus === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {registration.paymentStatus.charAt(0).toUpperCase() + registration.paymentStatus.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        registration.attendanceStatus === 'checked-in'
                          ? 'bg-green-100 text-green-800'
                          : registration.attendanceStatus === 'no-show'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {registration.attendanceStatus.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(registration.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {registrations.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No registrations found for this event.</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex space-x-4">
          <Link
            to={`/events/${eventId}/attendees`}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <UsersIcon className="h-4 w-4 mr-2" />
            View All Attendees
          </Link>
          <Link
            to={`/events/${eventId}`}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <CalendarDaysIcon className="h-4 w-4 mr-2" />
            View Event Details
          </Link>
        </div>
      </div>
    </AdminLayout>
  );
};

export default EventAnalyticsPage; 