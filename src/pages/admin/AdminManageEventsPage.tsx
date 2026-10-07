import React, { useState, useEffect } from 'react';
import { Can } from '@casl/react';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  EyeIcon,
  CalendarDaysIcon,
  UsersIcon,
  FunnelIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ShareIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/20/solid';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/shared/UI/LoadingSpinner';
import ProgressBar from '../../components/shared/UI/ProgressBar';
import { EventService } from '../../services/eventService';
import { RegistrationService } from '../../services/registrationService';
import { Event } from '../../types';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';
import DashboardShell from '../../components/shared/DashboardShell';

// Removed FeedbackModalState - now using dedicated page

const EventsWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, loading: authLoading } = useAuth();

  // Dev diagnostics helper (no-ops in production)
  const isDevEnv = process.env.NODE_ENV !== 'production';
  const logDiagnostics = React.useCallback(
    (label: string, payload: any) => {
      if (!isDevEnv) return;
      // Use groupCollapsed to avoid noisy consoles but keep data accessible
      console.groupCollapsed(`[AdminManageEventsPage] ${label}`);
      logger.log(payload);
      console.groupEnd();
    },
    [isDevEnv]
  );

  // This page is now admin-only
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('startDate');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);


  // Removed feedbackModal state - now using dedicated page

  // This page is now admin-only, so always fetch all events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        // Admin can see all events
        const eventsData = await EventService.getAllEvents();

        logDiagnostics(
          'Fetched events snapshot',
          eventsData.map(event => ({
            id: event.id,
            status: event.status,
            registrationStatus: event.registrationStatus,
            feedbackRequestsSentAt: event.feedbackRequestsSentAt?.toDate
              ? event.feedbackRequestsSentAt.toDate().toISOString()
              : event.feedbackRequestsSentAt ?? null,
            currentAttendees: event.currentAttendees
          }))
        );
        
        // Calculate real attendee counts from approved registrations
        const eventsWithRealCounts = await Promise.all(
          eventsData.map(async (event) => {
            try {
              // Get registrations for this event
              const registrations = await RegistrationService.getEventRegistrations(event.id);

              if (registrations.length && isDevEnv) {
                const attendanceBreakdown = registrations.reduce<Record<string, number>>((acc, reg) => {
                  const attendanceStatus = reg.attendanceStatus ?? 'unknown';
                  acc[attendanceStatus] = (acc[attendanceStatus] || 0) + 1;
                  return acc;
                }, {});

                const registrationStatusBreakdown = registrations.reduce<Record<string, number>>((acc, reg) => {
                  const regStatus = (reg as any).registrationStatus ?? 'unset';
                  acc[regStatus] = (acc[regStatus] || 0) + 1;
                  return acc;
                }, {});

                logDiagnostics(`Registration breakdown for event ${event.id}`, {
                  eventTitle: event.title,
                  attendanceBreakdown,
                  registrationStatusBreakdown
                });
              }

              // Count approved registrations only
              const approvedAttendees = registrations
                .filter(reg => (reg as any).registrationStatus === 'approved')
                .reduce((sum, reg) => sum + (reg.quantity || 1), 0);
              
              return {
                ...event,
                currentAttendees: approvedAttendees
              };
            } catch (error) {
              logger.warn(`Failed to get attendee count for event ${event.id}:`, error);
              return event; // Return original event if count fails
            }
          })
        );
        
        setEvents(eventsWithRealCounts);
        logDiagnostics(
          'Events state updated',
          eventsWithRealCounts.map(event => ({
            id: event.id,
            status: event.status,
            registrationStatus: event.registrationStatus,
            currentAttendees: event.currentAttendees
          }))
        );
      } catch (error) {
        logger.error('Error fetching events:', error);
        toast.error('Failed to load events');
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [userProfile?.role]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-success" />;
      case 'published':
        return <CheckCircleIcon className="h-5 w-5 text-primary" />;
      case 'ongoing':
        return <ClockIcon className="h-5 w-5 text-warning" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-error" />;
      default:
        return <ClockIcon className="h-5 w-5 text-on-surface-variant" />;
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
                         (event.description?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (event.shortDescription?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || event.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    switch (sortBy) {
      case 'startDate':
      {
        // Handle both Firestore timestamps and regular Date objects
        let aDate, bDate;
        
        if (a.startDate?.toDate) {
          aDate = a.startDate.toDate();
        } else if (a.startDate?.seconds && typeof a.startDate.seconds === 'number') {
          aDate = new Date(a.startDate.seconds * 1000);
        } else {
          aDate = new Date(a.startDate as any);
        }
        
        if (b.startDate?.toDate) {
          bDate = b.startDate.toDate();
        } else if (b.startDate?.seconds && typeof b.startDate.seconds === 'number') {
          bDate = new Date(b.startDate.seconds * 1000);
        } else {
          bDate = new Date(b.startDate as any);
        }
        
        // Check if dates are valid
        if (isNaN(aDate.getTime()) || isNaN(bDate.getTime())) {
          return 0; // Keep original order if dates are invalid
        }
        
        return bDate.getTime() - aDate.getTime();
      }
      case 'title':
        return a.title.localeCompare(b.title);
      case 'attendees':
        return b.currentAttendees - a.currentAttendees;
      case 'createdAt':
      {
        // Handle both Firestore timestamps and regular Date objects
        let aCreatedDate, bCreatedDate;
        
        if (a.createdAt?.toDate) {
          aCreatedDate = a.createdAt.toDate();
        } else if (a.createdAt?.seconds && typeof a.createdAt.seconds === 'number') {
          aCreatedDate = new Date(a.createdAt.seconds * 1000);
        } else {
          aCreatedDate = new Date(a.createdAt as any);
        }
        
        if (b.createdAt?.toDate) {
          bCreatedDate = b.createdAt.toDate();
        } else if (b.createdAt?.seconds && typeof b.createdAt.seconds === 'number') {
          bCreatedDate = new Date(b.createdAt.seconds * 1000);
        } else {
          bCreatedDate = new Date(b.createdAt as any);
        }
        
        // Check if dates are valid
        if (isNaN(aCreatedDate.getTime()) || isNaN(bCreatedDate.getTime())) {
          return 0; // Keep original order if dates are invalid
        }
        
        return bCreatedDate.getTime() - aCreatedDate.getTime();
      }
      default:
        return 0;
    }
  });

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
      logger.warn('Invalid date:', timestamp);
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
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



  const handleShareEvent = (eventId: string, eventTitle: string, eventSlug?: string) => {
    // Use slug-based URL if available, otherwise fall back to ID
    const shareUrl = eventSlug 
      ? `${window.location.origin}/e/${eventSlug}`
      : `${window.location.origin}/events/${eventId}/register`;
    
    // Copy link to clipboard
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success(`Registration link for "${eventTitle}" copied to clipboard!`, {
        duration: 4000,
        icon: '🔗'
      });
    }).catch(() => {
      toast.error('Failed to copy link to clipboard');
    });
  };

  const getPageTitle = () => {
    return 'Events Management';
  };

  const getPageSubtitle = () => {
    return 'Create, edit, and manage all events for GDG Davao';
  };

  const LayoutComponent = DashboardShell;

  if (loading) {
    return (
      <LayoutComponent title={getPageTitle()} subtitle={getPageSubtitle()}>
        <div className="flex items-center justify-center h-64">
          <div className="motion-essential animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-on-surface-variant">Loading events...</span>
        </div>
      </LayoutComponent>
    );
  }

  return (
    <LayoutComponent 
      title={getPageTitle()} 
      subtitle={getPageSubtitle()}
      actions={
        // Home for the "Create Event" action now that it no longer lives on the
        // dashboard. Gated on the same permission as the /events/create route it
        // links to, so the CTA and the destination cannot disagree.
        <Can do="read" on="all" passThrough>
          <Link
            to="/events/create"
            className="inline-flex items-center min-h-[48px] px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors duration-200 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            Create Event
          </Link>
        </Can>
      }
    >
        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 sm:mb-8">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-outline-variant" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm w-full sm:w-64"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
              >
                <option value="startDate">Sort by Date</option>
                <option value="title">Sort by Title</option>
                <option value="attendees">Sort by Attendees</option>
                <option value="createdAt">Sort by Created</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg active:scale-[0.96] transition-[color,background-color,transform] duration-short2 ease-emphasized-standard ${
                  viewMode === 'grid' 
                    ? 'bg-secondary-container text-primary font-semibold' 
                    : 'text-outline-variant hover:text-on-surface hover:bg-surface-container'
                }`}
                title="Grid view"
                aria-label="Grid view"
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg active:scale-[0.96] transition-[color,background-color,transform] duration-short2 ease-emphasized-standard ${
                  viewMode === 'list' 
                    ? 'bg-secondary-container text-primary font-semibold' 
                    : 'text-outline-variant hover:text-on-surface hover:bg-surface-container'
                }`}
                title="List view"
                aria-label="List view"
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Events Display */}
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
            {sortedEvents.map((event, index) => (
              <div
                key={event.id}
                style={{ animationDelay: `${Math.min(index * 30, 150)}ms` }}
                className="group bg-white rounded-lg shadow-elevation-0 border border-outline-variant overflow-hidden hover:shadow-elevation-1 hover:-translate-y-0.5 transition-[transform,box-shadow] duration-fast ease-quart animate-rise-in motion-reduce:animate-none"
              >
                {/* Event Image */}
                <div className="relative h-48 bg-surface-container-high overflow-hidden">
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover transition-transform duration-base ease-quart group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-secondary-container to-primary-container">
                      <CalendarDaysIcon className="h-12 w-12 text-primary transition-transform duration-fast ease-quart group-hover:scale-110" />
                    </div>
                  )}
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3 flex items-center">
                    <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold shadow-sm ${getStatusColor(event.status)}`}>
                      {getStatusIcon(event.status)}
                      <span className="capitalize">{event.status}</span>
                    </div>
                  </div>
                  {/* Price Badge */}
                  <div className="absolute bottom-3 left-3">
                    <div className="bg-black bg-opacity-75 text-white px-2 py-1 rounded-md text-sm font-medium">
                      {formatPrice(event.ticketTypes)}
                    </div>
                  </div>
                </div>

                {/* Event Content */}
                <div className="p-4">
                  {/* Title and Category */}
                  <div className="mb-3">
                    <Link to={`/events/${event.id}`} className="block group">
                      <h3 className="text-lg font-semibold text-on-surface mb-1 line-clamp-2 group-hover:text-primary-hover transition-colors">
                        {event.title}
                      </h3>
                    </Link>
                    <div className="flex items-center space-x-2 text-sm text-on-surface-variant">
                      <span className="bg-surface-container px-2 py-1 rounded-md">{event.category}</span>
                      {event.tags?.slice(0, 2).map((tag, index) => (
                        <span key={index} className="bg-secondary-container text-primary px-2 py-1 rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-on-surface-variant mb-4 line-clamp-3">
                    {event.shortDescription || event.description}
                  </p>

                  {/* Event Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <CalendarDaysIcon className="h-4 w-4 mr-2 text-outline-variant" />
                      <span>{formatDate(event.startDate)}</span>
                    </div>
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <UsersIcon className="h-4 w-4 mr-2 text-outline-variant" />
                      <span>
                        {event.currentAttendees} attendees
                        {event.maxAttendees && ` / ${event.maxAttendees} max`}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-on-surface-variant">
                      <svg className="h-4 w-4 mr-2 text-outline-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{event.venue.type === 'online' ? 'Online' : event.venue.name || event.venue.city}</span>
                    </div>
                  </div>

                  {/* Attendee Progress Bar */}
                  {event.maxAttendees && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm text-on-surface-variant mb-1">
                        <span>Registration Progress</span>
                        <span>{Math.round((event.currentAttendees / event.maxAttendees) * 100)}%</span>
                      </div>
                      <ProgressBar
                        value={Math.min((event.currentAttendees / event.maxAttendees) * 100, 100)}
                        size="sm"
                        color="bg-blue-600"
                        label="Registration progress"
                        showValue
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                    <Link
                      to={`/events/${event.id}`}
                      className="inline-flex min-h-[44px] items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg bg-primary-container text-primary hover:bg-secondary-container active:scale-[0.98] transition-[background-color,color,transform] duration-fast ease-quart"
                    >
                      <span>Manage Event</span>
                      <ArrowRightIcon className="h-4 w-4 transition-transform duration-fast ease-quart group-hover:translate-x-0.5" />
                    </Link>

                    <button
                      onClick={() => event.status === 'published' ? handleShareEvent(event.id, event.title, event.slug) : null}
                      className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                        event.status === 'published'
                          ? 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container cursor-pointer'
                          : 'text-outline-variant cursor-not-allowed'
                      }`}
                      title={event.status === 'published' ? 'Share Registration Link' : 'Event must be published to share'}
                      disabled={event.status !== 'published'}
                      aria-label="Share Registration Link"
                    >
                      <ShareIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-outline-variant">
                  <thead className="bg-surface-container-low">
                    <tr>
                      <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                        Event
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                        Date & Venue
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                        Attendees
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                        Pricing
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-sm font-medium text-on-surface-variant uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-outline-variant">
                    {sortedEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-surface-container-low">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {event.imageUrl && (
                              <img
                                src={event.imageUrl}
                                alt={event.title}
                                className="w-10 h-10 rounded-lg object-cover mr-3"
                              />
                            )}
                            <div>
                              <Link
                                to={`/events/${event.id}`}
                                className="text-sm font-semibold text-on-surface hover:text-primary-hover transition-colors"
                              >
                                {event.title}
                              </Link>
                              <div className="text-sm text-on-surface-variant truncate max-w-xs">
                                {event.shortDescription || event.description}
                              </div>
                              <div className="text-sm text-outline-variant mt-1">
                                {event.category} • {event.tags?.slice(0, 2).join(', ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-on-surface">{formatDate(event.startDate)}</div>
                          <div className="text-sm text-on-surface-variant">
                            {event.venue.type === 'online' ? 'Online' : event.venue.name || event.venue.city}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-on-surface">
                            {event.currentAttendees}
                            {event.maxAttendees && ` / ${event.maxAttendees}`}
                          </div>
                          {event.maxAttendees && (
                            <div className="w-full bg-surface-container-high rounded-full h-2 mt-1">
                              <div 
                                className="bg-primary h-2 rounded-full" 
                                style={{ 
                                  width: `${(event.currentAttendees / event.maxAttendees) * 100}%` 
                                }}
                              ></div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-on-surface">
                            {formatPrice(event.ticketTypes)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center space-x-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${getStatusColor(event.status)}`}>
                            {getStatusIcon(event.status)}
                            <span className="capitalize">{event.status}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/events/${event.id}`}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-md text-primary bg-primary-container hover:bg-primary-container transition-colors"
                              title="Open Event Hub"
                            >
                              Manage
                            </Link>
                            <button
                              onClick={() => event.status === 'published' ? handleShareEvent(event.id, event.title, event.slug) : null}
                              className={`p-1 rounded ${
                                event.status === 'published'
                                  ? 'text-primary hover:text-on-primary-container hover:bg-primary-container cursor-pointer'
                                  : 'text-outline-variant cursor-not-allowed'
                              }`}
                              title={event.status === 'published' ? 'Share Registration Link' : 'Event must be published to share'}
                              disabled={event.status !== 'published'}
                            >
                              <ShareIcon className="h-4 w-4" />
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
            <div className="lg:hidden space-y-3 p-4">
              {sortedEvents.map((event) => (
                <div key={event.id} className="bg-surface-container-low rounded-lg p-4 border border-outline-variant">
                  {/* Event Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center">
                        {event.imageUrl && (
                          <img
                            src={event.imageUrl}
                            alt={event.title}
                            className="w-12 h-12 rounded-lg object-cover mr-3"
                          />
                        )}
                        <div>
                          <h3 className="text-sm font-semibold text-on-surface truncate">
                            <Link to={`/events/${event.id}`} className="hover:text-primary-hover transition-colors">
                              {event.title}
                            </Link>
                          </h3>
                          <p className="text-sm text-on-surface-variant mt-1 line-clamp-2">
                            {event.shortDescription || event.description}
                          </p>
                          <div className="text-sm text-outline-variant mt-1">
                            {event.category} • {event.tags?.slice(0, 2).join(', ')}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      {getStatusIcon(event.status)}
                    </div>
                  </div>

                  {/* Event Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-on-surface-variant mb-3">
                    <div>
                      <span className="font-medium">Date:</span>
                      <div>{formatDate(event.startDate)}</div>
                    </div>
                    <div>
                      <span className="font-medium">Venue:</span>
                      <div>{event.venue.type === 'online' ? 'Online' : event.venue.name || event.venue.city}</div>
                    </div>
                    <div>
                      <span className="font-medium">Attendees:</span>
                      <div>{event.currentAttendees}{event.maxAttendees && ` / ${event.maxAttendees}`}</div>
                    </div>
                    <div>
                      <span className="font-medium">Pricing:</span>
                      <div>{formatPrice(event.ticketTypes)}</div>
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 pt-3 border-t border-outline-variant">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center space-x-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${getStatusColor(event.status)}`}>
                        {getStatusIcon(event.status)}
                        <span className="capitalize">{event.status}</span>
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      <Link
                        to={`/events/${event.id}`}
                        className="flex items-center justify-center space-x-1 px-3 py-2 min-h-[44px] bg-primary-container text-primary hover:bg-primary-container rounded-lg transition-colors text-sm font-medium"
                      >
                        <EyeIcon className="h-4 w-4 flex-shrink-0" />
                        <span>Manage</span>
                      </Link>
                      <button
                        onClick={() => event.status === 'published' ? handleShareEvent(event.id, event.title, event.slug) : null}
                        className={`flex items-center justify-center space-x-1 p-2 min-h-[44px] min-w-[44px] rounded-lg transition-colors text-sm font-medium ${
                          event.status === 'published'
                            ? 'text-primary hover:text-on-primary-container hover:bg-primary-container cursor-pointer'
                            : 'text-outline-variant cursor-not-allowed bg-surface-container-low'
                        }`}
                        title={event.status === 'published' ? 'Share Registration Link' : 'Event must be published to share'}
                        disabled={event.status !== 'published'}
                      >
                        <ShareIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="sr-only">Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {sortedEvents.length === 0 && (
          <div className="text-center py-8 sm:py-12 px-4">
            <CalendarDaysIcon className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-outline-variant" />
            <h3 className="mt-2 text-sm font-medium text-on-surface">No events found</h3>
            <p className="mt-1 text-sm sm:text-sm text-on-surface-variant max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by creating your first event.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Can do="read" on="all" passThrough>
                <div className="mt-4 sm:mt-6">
                  <Link
                  to="/events/create"
                  className="inline-flex items-center min-h-[48px] px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors duration-200 font-medium">
                    <PlusIcon className="w-5 h-5 mr-2" />
                    Create Event
                    </Link>
                </div>
              </Can>
            )}
          </div>
        )}



        {/* Feedback modal removed - now using dedicated page */}
      </LayoutComponent>
    );
  };


// No role check of its own: /events is gated on `read 'all'` in App.tsx, which
// only admins hold. The page previously enforced the same rule twice - a
// redirect effect that fired a toast and a `return null` that blanked the screen
// while it did - so an organizer saw a flash, an error, and a bounce.
const ManageEventsPage: React.FC = () => <EventsWorkspace />;

export default ManageEventsPage; 