import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  EyeIcon,
  PencilIcon,
  TrashIcon,
  CalendarDaysIcon,
  UsersIcon,
  ChartBarIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/20/solid';
import { Link } from 'react-router-dom';
import AdminLayout from '../../components/AdminLayout';

interface Event {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  venue: {
    type: 'online' | 'offline' | 'hybrid';
    name?: string;
  };
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  maxAttendees?: number;
  currentAttendees: number;
  ticketPrice: number;
  imageUrl?: string;
  organizer: string;
  createdAt: string;
}

const AdminEventsPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('startDate');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Mock data
  useEffect(() => {
    setTimeout(() => {
      setEvents([
        {
          id: '1',
          title: 'Web Development Workshop',
          description: 'Learn modern web development with React and TypeScript',
          startDate: '2025-01-15T09:00:00Z',
          endDate: '2025-01-15T17:00:00Z',
          venue: { type: 'offline', name: 'GDG Davao Hub' },
          status: 'completed',
          maxAttendees: 50,
          currentAttendees: 45,
          ticketPrice: 500,
          organizer: 'Admin User',
          createdAt: '2025-01-01T10:00:00Z'
        },
        {
          id: '2',
          title: 'AI/ML Fundamentals',
          description: 'Introduction to Artificial Intelligence and Machine Learning',
          startDate: '2025-01-25T14:00:00Z',
          endDate: '2025-01-25T18:00:00Z',
          venue: { type: 'online' },
          status: 'published',
          maxAttendees: 100,
          currentAttendees: 78,
          ticketPrice: 0,
          organizer: 'Admin User',
          createdAt: '2025-01-05T14:00:00Z'
        },
        {
          id: '3',
          title: 'Mobile App Development',
          description: 'Build cross-platform apps with Flutter',
          startDate: '2025-02-10T10:00:00Z',
          endDate: '2025-02-10T16:00:00Z',
          venue: { type: 'hybrid', name: 'Tech Hub Davao' },
          status: 'draft',
          maxAttendees: 40,
          currentAttendees: 0,
          ticketPrice: 750,
          organizer: 'Admin User',
          createdAt: '2025-01-10T09:00:00Z'
        },
        {
          id: '4',
          title: 'DevOps Essentials',
          description: 'Master the fundamentals of DevOps and CI/CD',
          startDate: '2025-02-20T08:00:00Z',
          endDate: '2025-02-20T17:00:00Z',
          venue: { type: 'offline', name: 'Innovation Center' },
          status: 'published',
          maxAttendees: 30,
          currentAttendees: 25,
          ticketPrice: 1000,
          organizer: 'Admin User',
          createdAt: '2025-01-12T11:00:00Z'
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'published':
        return <CheckCircleIcon className="h-5 w-5 text-blue-500" />;
      case 'ongoing':
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'published':
        return 'bg-blue-100 text-blue-800';
      case 'ongoing':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    switch (sortBy) {
      case 'startDate':
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      case 'title':
        return a.title.localeCompare(b.title);
      case 'attendees':
        return b.currentAttendees - a.currentAttendees;
      default:
        return 0;
    }
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      setEvents(events.filter(e => e.id !== eventId));
    }
  };

  const handleStatusChange = (eventId: string, newStatus: string) => {
    setEvents(events.map(e => 
      e.id === eventId ? { ...e, status: newStatus as Event['status'] } : e
    ));
  };

  if (loading) {
    return (
      <AdminLayout title="Events Management" subtitle="Create, edit, and manage all events for GDG Davao">
        <div className="flex items-center justify-center h-64">
          <div className="loading-spinner h-8 w-8"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout 
      title="Events Management" 
      subtitle="Create, edit, and manage all events for GDG Davao"
      actions={
        <Link
          to="/events/create"
          className="btn-primary flex items-center justify-center space-x-2 text-sm px-4 py-2 sm:px-6 sm:py-3"
        >
          <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">Create Event</span>
          <span className="sm:hidden">Create</span>
        </Link>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="dashboard-card">
          <div className="flex items-center">
            <CalendarDaysIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{events.length}</p>
            </div>
          </div>
        </div>
        <div className="dashboard-card">
          <div className="flex items-center">
            <UsersIcon className="h-6 w-6 sm:h-8 sm:w-8 text-success-600" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Total Attendees</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {events.reduce((sum, e) => sum + e.currentAttendees, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="dashboard-card">
          <div className="flex items-center">
            <ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-secondary-600" />
            <div className="ml-3 sm:ml-4">
              <p className="text-xs sm:text-sm font-medium text-gray-600">Avg. Attendance</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {Math.round(events.reduce((sum, e) => sum + e.currentAttendees, 0) / events.length)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="dashboard-card mb-6 sm:mb-8">
        <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1 sm:flex-none">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          >
            <option value="startDate">Sort by Date</option>
            <option value="title">Sort by Title</option>
            <option value="attendees">Sort by Attendees</option>
            <option value="revenue">Sort by Revenue</option>
          </select>
        </div>
      </div>

      {/* Events Display */}
      <div className="dashboard-card overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Venue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendees
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{event.title}</div>
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {event.description}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(event.startDate)}</div>
                      <div className="text-sm text-gray-500">
                        {event.venue.type === 'online' ? 'Online' : event.venue.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {event.currentAttendees}
                        {event.maxAttendees && ` / ${event.maxAttendees}`}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className="bg-primary-600 h-2 rounded-full" 
                          style={{ 
                            width: event.maxAttendees 
                              ? `${(event.currentAttendees / event.maxAttendees) * 100}%` 
                              : '0%' 
                          }}
                        ></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(event.status)}
                        <select
                          value={event.status}
                          onChange={(e) => handleStatusChange(event.id, e.target.value)}
                          className={`text-xs font-medium rounded-full px-2 py-1 border-0 ${getStatusColor(event.status)}`}
                        >
                          <option value="draft">Draft</option>
                          <option value="published">Published</option>
                          <option value="ongoing">Ongoing</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/events/${event.id}`}
                          className="text-primary-600 hover:text-primary-900"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Link>
                        <Link
                          to={`/events/${event.id}/edit`}
                          className="text-accent-600 hover:text-accent-900"
                          title="Edit Event"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-secondary-600 hover:text-secondary-900"
                          title="Delete Event"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="lg:hidden space-y-3 p-1">
          {sortedEvents.map((event) => (
            <div key={event.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 shadow-sm">
              {/* Event Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">
                    {event.title}
                  </h3>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {event.description}
                  </p>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  {getStatusIcon(event.status)}
                </div>
              </div>

              {/* Event Details */}
              <div className="space-y-2">
                {/* Date and Venue */}
                <div className="flex items-center text-xs text-gray-600">
                  <CalendarDaysIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span>{formatDate(event.startDate)}</span>
                </div>
                <div className="flex items-center text-xs text-gray-600">
                  <span className="w-4 h-4 mr-2 flex-shrink-0"></span>
                  <span>{event.venue.type === 'online' ? 'Online' : event.venue.name}</span>
                </div>

                {/* Attendees */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-xs text-gray-600">
                    <UsersIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      {event.currentAttendees}
                      {event.maxAttendees && ` / ${event.maxAttendees}`} attendees
                    </span>
                  </div>
                  <div className="flex-1 max-w-24 ml-3">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-primary-600 h-1.5 rounded-full" 
                        style={{ 
                          width: event.maxAttendees 
                            ? `${Math.min((event.currentAttendees / event.maxAttendees) * 100, 100)}%` 
                            : '0%' 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Status and Actions Row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 pt-3 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(event.status)}
                    <select
                      value={event.status}
                      onChange={(e) => handleStatusChange(event.id, e.target.value)}
                      className={`text-xs font-medium rounded-lg px-3 py-2 border focus:ring-2 focus:ring-primary-500 ${getStatusColor(event.status)}`}
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Link
                      to={`/events/${event.id}`}
                      className="flex items-center justify-center space-x-1 px-2 sm:px-3 py-2 text-primary-600 hover:text-primary-900 hover:bg-primary-50 rounded-lg transition-colors text-xs font-medium min-w-0"
                    >
                      <EyeIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                    <Link
                      to={`/events/${event.id}/edit`}
                      className="flex items-center justify-center space-x-1 px-2 sm:px-3 py-2 text-accent-600 hover:text-accent-900 hover:bg-accent-50 rounded-lg transition-colors text-xs font-medium min-w-0"
                    >
                      <PencilIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Edit</span>
                    </Link>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      className="flex items-center justify-center space-x-1 px-2 sm:px-3 py-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium min-w-0"
                    >
                      <TrashIcon className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden sm:inline">Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {sortedEvents.length === 0 && (
          <div className="text-center py-8 sm:py-12 px-4">
            <CalendarDaysIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No events found</h3>
            <p className="mt-1 text-xs sm:text-sm text-gray-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by creating your first event.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <div className="mt-4 sm:mt-6">
                <Link
                  to="/events/create"
                  className="btn-primary text-sm px-4 py-2 sm:px-6 sm:py-3 inline-flex items-center space-x-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Create Event</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminEventsPage;
