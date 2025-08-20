import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  MapPinIcon, 
  UsersIcon, 
  ClockIcon,
  TagIcon,
  UserCircleIcon,
  GlobeAltIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon as ClockIconSolid
} from '@heroicons/react/24/outline';
import { EventService } from '../../services/eventService';
import { Event } from '../../types';
import Layout from '../../components/public/Layout/Layout';
import LoadingSpinner from '../../components/shared/UI/LoadingSpinner';
import toast from 'react-hot-toast';

const EventDetailPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvent = async () => {
      if (!eventId) return;
      
      try {
        setLoading(true);
        const eventData = await EventService.getEvent(eventId);
        setEvent(eventData);
      } catch (error) {
        console.error('Error loading event:', error);
        toast.error('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'TBD';
    
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
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (ticketTypes: Event['ticketTypes']) => {
    if (!ticketTypes || ticketTypes.length === 0) return 'Free';
    const minPrice = Math.min(...ticketTypes.map(t => t.price));
    const maxPrice = Math.max(...ticketTypes.map(t => t.price));
    const currency = ticketTypes[0]?.currency || 'PHP';
    
    if (minPrice === maxPrice) {
      return `${currency} ${minPrice.toLocaleString()}`;
    }
    return `${currency} ${minPrice.toLocaleString()} - ${maxPrice.toLocaleString()}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'published':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'draft':
        return <ClockIconSolid className="h-5 w-5 text-yellow-500" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIconSolid className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Event Not Found</h1>
          <p className="text-gray-600 mb-8">The event you're looking for doesn't exist or has been removed.</p>
          <Link
            to="/events"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Browse All Events
          </Link>
        </div>
      </div>
    );
  }

  return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-2 mb-4">
            <Link to="/events" className="text-blue-600 hover:text-blue-800">
              ← Back to Events
            </Link>
          </div>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                {getStatusIcon(event.status)}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                  {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                </span>
              </div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{event.title}</h1>
              <p className="text-xl text-gray-600 mb-4">{event.shortDescription}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Event Image */}
            {event.imageUrl && (
              <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Event Description */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">About This Event</h2>
              <div className="prose max-w-none">
                <p className="text-gray-700 leading-relaxed">{event.description}</p>
              </div>
            </div>

            {/* Event Details */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Event Details</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CalendarDaysIcon className="h-6 w-6 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900">Date & Time</h3>
                    <p className="text-gray-600">{formatDate(event.startDate)}</p>
                    {event.endDate && (
                      <p className="text-gray-600">Ends: {formatDate(event.endDate)}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  {event.venue.type === 'online' ? (
                    <GlobeAltIcon className="h-6 w-6 text-gray-400 mt-0.5" />
                  ) : (
                    <MapPinIcon className="h-6 w-6 text-gray-400 mt-0.5" />
                  )}
                  <div>
                    <h3 className="font-medium text-gray-900">Venue</h3>
                    <p className="text-gray-600">
                      {event.venue.type === 'online' ? 'Online Event' : event.venue.name || 'TBD'}
                    </p>
                    {event.venue.address && (
                      <p className="text-gray-600">{event.venue.address}</p>
                    )}
                    {event.venue.city && (
                      <p className="text-gray-600">{event.venue.city}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <UsersIcon className="h-6 w-6 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900">Attendees</h3>
                    <p className="text-gray-600">
                      {event.currentAttendees} registered
                      {event.maxAttendees && ` / ${event.maxAttendees} max`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <CurrencyDollarIcon className="h-6 w-6 text-gray-400 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-gray-900">Pricing</h3>
                    <p className="text-gray-600">{formatPrice(event.ticketTypes)}</p>
                  </div>
                </div>

                {event.category && (
                  <div className="flex items-start space-x-3">
                    <TagIcon className="h-6 w-6 text-gray-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-gray-900">Category</h3>
                      <p className="text-gray-600">{event.category}</p>
                    </div>
                  </div>
                )}

                {event.tags && event.tags.length > 0 && (
                  <div className="flex items-start space-x-3">
                    <TagIcon className="h-6 w-6 text-gray-400 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-gray-900">Tags</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {event.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Requirements */}
            {event.requirements && event.requirements.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Requirements</h2>
                <ul className="space-y-2">
                  {event.requirements.map((requirement, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{requirement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Organizer Info */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Organizer</h3>
              <div className="flex items-center space-x-3">
                <UserCircleIcon className="h-10 w-10 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900">{event.organizer.name}</p>
                  <p className="text-sm text-gray-600">{event.organizer.email}</p>
                </div>
              </div>
            </div>

            {/* Registration CTA */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Join This Event</h3>
              <p className="text-gray-600 mb-4">
                Don't miss out on this amazing event! Register now to secure your spot.
              </p>
              <Link
                to={`/events/${eventId}/register`}
                className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Register Now
              </Link>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-medium ${getStatusColor(event.status)}`}>
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Attendees</span>
                  <span className="font-medium text-gray-900">
                    {event.currentAttendees}
                    {event.maxAttendees && ` / ${event.maxAttendees}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price</span>
                  <span className="font-medium text-gray-900">{formatPrice(event.ticketTypes)}</span>
                </div>
                {event.timezone && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Timezone</span>
                    <span className="font-medium text-gray-900">{event.timezone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default EventDetailPage; 