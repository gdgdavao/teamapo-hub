import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MagnifyingGlassIcon, MapPinIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import EventService from '../../services/eventService';
import { Event } from '../../types';

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'free' | 'paid' | 'online' | 'offline'>('all');

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        // Fetch only published events for public discovery
        const publishedEvents = await EventService.getPublishedEvents();
        setEvents(publishedEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Filter events based on search and filter criteria
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    switch (filterType) {
      case 'free':
        return matchesSearch && event.ticketTypes.every(ticket => ticket.price === 0);
      case 'paid':
        return matchesSearch && event.ticketTypes.some(ticket => ticket.price > 0);
      case 'online':
        return matchesSearch && event.venue.type === 'online';
      case 'offline':
        return matchesSearch && event.venue.type === 'offline';
      default:
        return matchesSearch;
    }
  });

  const formatDate = (date: any) => {
    if (!date) return 'TBA';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getEventPrice = (ticketTypes: any[]) => {
    if (!ticketTypes || ticketTypes.length === 0) return 'Free';
    const minPrice = Math.min(...ticketTypes.map(t => t.price));
    const maxPrice = Math.max(...ticketTypes.map(t => t.price));
    
    if (minPrice === 0 && maxPrice === 0) return 'Free';
    if (minPrice === maxPrice) return `₱${minPrice.toLocaleString()}`;
    return `₱${minPrice.toLocaleString()} - ₱${maxPrice.toLocaleString()}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Upcoming Events
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Discover and join amazing tech events organized by GDG Davao. 
          No account required - register in under 2 minutes!
        </p>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'all', label: 'All Events' },
              { key: 'free', label: 'Free' },
              { key: 'paid', label: 'Paid' },
              { key: 'online', label: 'Online' },
              { key: 'offline', label: 'In-Person' }
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setFilterType(filter.key as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === filter.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6 animate-pulse">
              <div className="w-full h-48 bg-gray-200 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="flex justify-between">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDaysIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || filterType !== 'all' ? 'No events found' : 'No events available'}
          </h3>
          <p className="text-gray-600">
            {searchTerm || filterType !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Check back soon for upcoming events.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              {/* Event Image */}
              <div className="w-full h-48 bg-gradient-to-br from-blue-500 to-indigo-600 relative">
                {event.imageUrl ? (
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <CalendarDaysIcon className="w-16 h-16" />
                  </div>
                )}
                {/* Price Badge */}
                <div className="absolute top-4 right-4">
                  <span className="bg-white/90 backdrop-blur-sm text-gray-900 px-3 py-1 rounded-full text-sm font-medium">
                    {getEventPrice(event.ticketTypes)}
                  </span>
                </div>
              </div>

              {/* Event Details */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {event.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {event.shortDescription || event.description}
                </p>

                {/* Event Meta */}
                <div className="space-y-2 text-sm text-gray-500">
                  <div className="flex items-center">
                    <CalendarDaysIcon className="w-4 h-4 mr-2" />
                    <span>{formatDate(event.startDate)}</span>
                  </div>
                  <div className="flex items-center">
                    <MapPinIcon className="w-4 h-4 mr-2" />
                    <span className="line-clamp-1">
                      {event.venue.type === 'online' 
                        ? 'Online Event' 
                        : event.venue.name || event.venue.city
                      }
                    </span>
                  </div>
                </div>

                {/* Attendee Count */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {event.currentAttendees} registered
                      {event.maxAttendees && ` / ${event.maxAttendees} max`}
                    </span>
                    <span className="text-blue-600 font-medium">
                      View Details →
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsPage; 