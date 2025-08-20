import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  UserGroupIcon, 
  ChartBarIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  DocumentTextIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import { useAuth } from '../../contexts/AuthContext';
import EventService from '../../services/eventService';
import { Event } from '../../types';
import LoadingSpinner from '../../components/shared/UI/LoadingSpinner';

const OrganizerDashboardPage: React.FC = () => {
  const { userProfile } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrganizerEvents = async () => {
      if (!userProfile?.uid) return;
      
      try {
        setLoading(true);
        const userEvents = await EventService.getEventsByOrganizer(userProfile.uid);
        setEvents(userEvents);
      } catch (error) {
        console.error('Error fetching organizer events:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizerEvents();
  }, [userProfile?.uid]);

  const totalEvents = events.length;
  const activeEvents = events.filter(event => event.status === 'published').length;
  const totalRegistrations = events.reduce((sum, event) => sum + (event.currentAttendees || 0), 0);

  const statsCards = [
    {
      title: 'Total Events',
      value: totalEvents,
      icon: CalendarDaysIcon,
      color: 'bg-blue-500',
      change: '+12%',
      changeType: 'increase' as const
    },
    {
      title: 'Active Events',
      value: activeEvents,
      icon: EyeIcon,
      color: 'bg-green-500',
      change: '+5%',
      changeType: 'increase' as const
    },
    {
      title: 'Total Registrations',
      value: totalRegistrations,
      icon: UserGroupIcon,
      color: 'bg-purple-500',
      change: '+23%',
      changeType: 'increase' as const
    }
  ];

  const recentEvents = events.slice(0, 5);

  if (loading) {
    return (
      <OrganizerLayout>
        <LoadingSpinner />
      </OrganizerLayout>
    );
  }

  return (
    <OrganizerLayout
      title="Welcome back!"
      subtitle={`Here's what's happening with your events, ${userProfile?.displayName || 'Organizer'}.`}
      actions={
        <Link
          to="/events/create"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Event
        </Link>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {statsCards.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${stat.color}`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
            <div className="mt-4">
              <span className={`text-sm font-medium ${
                stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
              }`}>
                {stat.change}
              </span>
              <span className="text-sm text-gray-600"> from last month</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          to="/attendees"
          className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-500 group-hover:bg-green-600 transition-colors">
              <UserGroupIcon className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 group-hover:text-green-600 transition-colors">
                Manage Attendees
              </h3>
              <p className="text-sm text-gray-600">Check in attendees and manage registrations</p>
            </div>
          </div>
        </Link>

        <Link
          to="/forms"
          className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-orange-500 group-hover:bg-orange-600 transition-colors">
              <DocumentTextIcon className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                Custom Forms
              </h3>
              <p className="text-sm text-gray-600">Create registration and feedback forms</p>
            </div>
          </div>
        </Link>

        <Link
          to="/certificates"
          className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-indigo-500 group-hover:bg-indigo-600 transition-colors">
              <AcademicCapIcon className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                Certificates
              </h3>
              <p className="text-sm text-gray-600">Generate and manage event certificates</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Recent Events</h3>
            <Link
              to="/events"
              className="text-sm font-medium text-blue-600 hover:text-blue-500"
            >
              View all
            </Link>
          </div>
        </div>
        <div className="p-6">
          {recentEvents.length > 0 ? (
            <div className="space-y-4">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${
                      event.status === 'published' ? 'bg-green-400' : 
                      event.status === 'draft' ? 'bg-yellow-400' : 'bg-gray-400'
                    }`} />
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{event.title}</h4>
                      <p className="text-sm text-gray-500">
                        {event.startDate.toDate().toLocaleDateString()} • {event.currentAttendees || 0} registered
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/events/${event.id}`}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <EyeIcon className="w-3 h-3 mr-1" />
                      View
                    </Link>
                    <Link
                      to={`/events/edit/${event.id}`}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <PencilIcon className="w-3 h-3 mr-1" />
                      Edit
                    </Link>
                    <Link
                      to={`/events/${event.id}/analytics`}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <ChartBarIcon className="w-3 h-3 mr-1" />
                      Analytics
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarDaysIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No events yet</h3>
              <p className="text-gray-600 mb-4">Get started by creating your first event</p>
              <Link
                to="/events/create"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                Create Event
              </Link>
            </div>
          )}
        </div>
      </div>
    </OrganizerLayout>
  );
};

export default OrganizerDashboardPage; 