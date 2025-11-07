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
  ListBulletIcon,
  ShareIcon,
  LinkIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/20/solid';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { EventService } from '../../services/eventService';
import { RegistrationService } from '../../services/registrationService';
import { Event } from '../../types';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/admin/AdminLayout';
// OrganizerLayout import removed - this page is now admin-only
import ConfirmationModal from '../../components/shared/UI/ConfirmationModal';

interface DeleteModalState {
  isOpen: boolean;
  eventId: string | null;
  eventTitle: string;
  isLoading: boolean;
  message: string;
  confirmText: string;
  type: 'danger' | 'warning' | 'info';
  isForceDelete: boolean;
}

// Removed FeedbackModalState - now using dedicated page

const ManageEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, loading: authLoading, currentUser } = useAuth();

  // This page is now admin-only
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('startDate');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    eventId: null,
    eventTitle: '',
    message: '',
    confirmText: 'Delete',
    type: 'warning',
    isLoading: false,
    isForceDelete: false
  });

  // Removed feedbackModal state - now using dedicated page

  // Redirect non-admin users to dashboard
  useEffect(() => {
    if (!authLoading && userProfile && userProfile.role !== 'admin') {
      toast.error('Only administrators can manage events');
      navigate('/dashboard');
    }
  }, [authLoading, userProfile, navigate]);

  // Don't render the component if user is not admin
  if (authLoading) {
    return <div>Loading...</div>;
  }

  if (!userProfile || userProfile.role !== 'admin') {
    return null; // Will redirect via useEffect
  }

  // This page is now admin-only, so always fetch all events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        // Admin can see all events
        const eventsData = await EventService.getAllEvents();
        
        // Calculate real attendee counts from approved registrations
        const eventsWithRealCounts = await Promise.all(
          eventsData.map(async (event) => {
            try {
              // Get registrations for this event
              const registrations = await RegistrationService.getEventRegistrations(event.id);
              // Count approved registrations only
              const approvedAttendees = registrations
                .filter(reg => (reg as any).registrationStatus === 'approved')
                .reduce((sum, reg) => sum + (reg.quantity || 1), 0);
              
              return {
                ...event,
                currentAttendees: approvedAttendees
              };
            } catch (error) {
              console.warn(`Failed to get attendee count for event ${event.id}:`, error);
              return event; // Return original event if count fails
            }
          })
        );
        
        setEvents(eventsWithRealCounts);
      } catch (error) {
        console.error('Error fetching events:', error);
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

  const getRegistrationStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'closed':
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case 'walk-in-only':
        return <UserGroupIcon className="h-4 w-4 text-orange-500" />;
      default:
        return <ClockIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRegistrationStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'walk-in-only':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRegistrationStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Open';
      case 'closed':
        return 'Closed';
      case 'walk-in-only':
        return 'Walk-In Only';
      default:
        return 'Unknown';
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
        // Handle both Firestore timestamps and regular Date objects
        let aDate, bDate;
        
        if (a.startDate?.toDate) {
          aDate = a.startDate.toDate();
        } else if (a.startDate?.seconds && typeof a.startDate.seconds === 'number') {
          aDate = new Date(a.startDate.seconds * 1000);
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
      case 'title':
        return a.title.localeCompare(b.title);
      case 'attendees':
        return b.currentAttendees - a.currentAttendees;
      case 'createdAt':
        // Handle both Firestore timestamps and regular Date objects
        let aCreatedDate, bCreatedDate;
        
        if (a.createdAt?.toDate) {
          aCreatedDate = a.createdAt.toDate();
        } else if (a.createdAt?.seconds && typeof a.createdAt.seconds === 'number') {
          aCreatedDate = new Date(a.createdAt.seconds * 1000);
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
      default:
        return 0;
    }
  });

  // Calculate stats based on filtered events
  const statsData = {
    totalEvents: sortedEvents.length,
    totalAttendees: sortedEvents.reduce((sum, e) => sum + e.currentAttendees, 0),
    publishedEvents: sortedEvents.filter(e => e.status === 'published').length,
    isFiltered: searchTerm.trim() !== '' || statusFilter !== 'all'
  };

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
      console.warn('Invalid date:', timestamp);
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

  const openDeleteModal = (eventId: string, eventTitle: string) => {
    setDeleteModal({
      isOpen: true,
      eventId,
      eventTitle,
      isLoading: false,
      message: `Are you sure you want to delete "${eventTitle}"? This action cannot be undone and will permanently remove the event and all associated data.`,
      confirmText: 'Delete Event',
      type: 'danger',
      isForceDelete: false
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      eventId: null,
      eventTitle: '',
      isLoading: false,
      message: '',
      confirmText: 'Delete Event',
      type: 'danger',
      isForceDelete: false
    });
  };

  const handleDeleteEvent = async () => {
    if (!deleteModal.eventId) return;
    
    setDeleteModal(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Ensure auth token is fresh before making function calls
      if (currentUser) {
        try {
          await currentUser.getIdToken(true); // Force token refresh
          console.log('Auth token refreshed for delete operation');
        } catch (authError) {
          console.error('Auth token refresh failed:', authError);
          toast.error('Authentication expired. Please sign in again.');
          setDeleteModal(prev => ({ ...prev, isLoading: false }));
          return;
        }
      }
      
      // First try to delete without force
      await EventService.deleteEvent(deleteModal.eventId, false);
      setEvents(events.filter(e => e.id !== deleteModal.eventId));
      toast.success('Event deleted successfully');
      closeDeleteModal();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      
      // Check if the error is due to registrations
      if (error.message && error.message.includes('registrations')) {
        // Show a more specific modal for events with registrations
        setDeleteModal(prev => ({
          ...prev,
          isLoading: false,
          message: `This event has registrations and cannot be deleted normally. This will permanently delete the event and all associated data including registrations. Are you sure you want to proceed?`,
          confirmText: 'Delete Anyway',
          type: 'danger'
        }));
      } else {
        toast.error('Failed to delete event');
        setDeleteModal(prev => ({ ...prev, isLoading: false }));
      }
    }
  };

  const handleForceDelete = async () => {
    if (!deleteModal.eventId) return;
    
    setDeleteModal(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Ensure auth token is fresh before making function calls
      if (currentUser) {
        try {
          await currentUser.getIdToken(true); // Force token refresh
          console.log('Auth token refreshed for force delete operation');
        } catch (authError) {
          console.error('Auth token refresh failed:', authError);
          toast.error('Authentication expired. Please sign in again.');
          setDeleteModal(prev => ({ ...prev, isLoading: false }));
          return;
        }
      }
      
      await EventService.deleteEvent(deleteModal.eventId, true);
      setEvents(events.filter(e => e.id !== deleteModal.eventId));
      toast.success('Event deleted successfully');
      closeDeleteModal();
    } catch (error) {
      console.error('Error force deleting event:', error);
      toast.error('Failed to delete event');
      setDeleteModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleRegistrationStatusChange = async (eventId: string, newRegistrationStatus: 'open' | 'closed' | 'walk-in-only') => {
    try {
      console.log('🔄 Updating registration status:', { eventId, newRegistrationStatus });
      
      // Call the service to update Firebase
      await EventService.updateRegistrationStatus(eventId, newRegistrationStatus);
      console.log('✅ Firebase registration status update successful for event:', eventId);
      
      // Update local state
      setEvents(events.map(e => 
        e.id === eventId ? { 
          ...e, 
          registrationStatus: newRegistrationStatus
        } : e
      ));
      
      toast.success(`Registration status updated to ${getRegistrationStatusLabel(newRegistrationStatus)}`);
    } catch (error) {
      console.error('❌ Error updating registration status:', error);
      toast.error('Failed to update registration status');
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    try {
      console.log('🔄 Updating event status:', { eventId, newStatus });
      
      // Call the service to update Firebase
      await EventService.updateEventStatus(eventId, newStatus);
      console.log('✅ Firebase update successful for event:', eventId, 'new status:', newStatus);
      
      // Update local state - update both status and isPublished
      const updatedIsPublished = newStatus === 'published';
      setEvents(events.map(e => 
        e.id === eventId ? { 
          ...e, 
          status: newStatus as Event['status'],
          isPublished: updatedIsPublished
        } : e
      ));
      
      console.log('✅ Local state updated successfully', {
        eventId,
        newStatus,
        isPublished: updatedIsPublished
      });
      
      toast.success('Event status updated successfully');
    } catch (error) {
      console.error('❌ Error updating event status:', error);
      toast.error('Failed to update event status');
    }
  };

  const handleShareEvent = (eventId: string, eventTitle: string) => {
    const shareUrl = `${window.location.origin}/events/${eventId}/register`;
    
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

  const handleViewFeedback = (eventId: string) => {
    navigate(`/admin/events/${eventId}/feedback`);
  };

  const getPageTitle = () => {
    return 'Events Management';
  };

  const getPageSubtitle = () => {
    return 'Create, edit, and manage all events for GDG Davao';
  };

  const LayoutComponent = AdminLayout;

  if (loading) {
    return (
      <LayoutComponent title={getPageTitle()} subtitle={getPageSubtitle()}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading events...</span>
        </div>
      </LayoutComponent>
    );
  }

  return (
    <LayoutComponent 
      title={getPageTitle()} 
      subtitle={getPageSubtitle()}
      actions={
        // Create Event functionality removed - only admins can create events
        null
      }
    >
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <CalendarDaysIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">
                  {statsData.isFiltered ? 'Filtered Events' : 'Total Events'}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{statsData.totalEvents}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <UsersIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">
                  {statsData.isFiltered ? 'Filtered Attendees' : 'Total Attendees'}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {statsData.totalAttendees}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center">
              <ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
              <div className="ml-3 sm:ml-4">
                <p className="text-xs sm:text-sm font-medium text-gray-600">
                  {statsData.isFiltered ? 'Filtered Published' : 'Published Events'}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {statsData.publishedEvents}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 sm:mb-8">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm w-full sm:w-64"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
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
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-blue-100 text-blue-600' 
                    : 'text-gray-400 hover:text-gray-600'
                }`}
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
            {sortedEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {/* Event Image */}
                <div className="relative h-48 bg-gray-200">
                  {event.imageUrl ? (
                    <img
                      src={event.imageUrl}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200">
                      <CalendarDaysIcon className="h-12 w-12 text-blue-500" />
                    </div>
                  )}
                  {/* Status Badges */}
                  <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                      {getStatusIcon(event.status)}
                      <span className="capitalize">{event.status}</span>
                    </div>
                    <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getRegistrationStatusColor(event.registrationStatus || 'open')}`}>
                      {getRegistrationStatusIcon(event.registrationStatus || 'open')}
                      <span className="capitalize">{getRegistrationStatusLabel(event.registrationStatus || 'open')}</span>
                    </div>
                  </div>
                  {/* Price Badge */}
                  <div className="absolute bottom-3 left-3">
                    <div className="bg-black bg-opacity-75 text-white px-2 py-1 rounded-md text-xs font-medium">
                      {formatPrice(event.ticketTypes)}
                    </div>
                  </div>
                </div>

                {/* Event Content */}
                <div className="p-4">
                  {/* Title and Category */}
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                      {event.title}
                    </h3>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span className="bg-gray-100 px-2 py-1 rounded-md">{event.category}</span>
                      {event.tags?.slice(0, 2).map((tag, index) => (
                        <span key={index} className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                    {event.shortDescription || event.description}
                  </p>

                  {/* Event Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <CalendarDaysIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{formatDate(event.startDate)}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <UsersIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span>
                        {event.currentAttendees} attendees
                        {event.maxAttendees && ` / ${event.maxAttendees} max`}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="h-4 w-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{event.venue.type === 'online' ? 'Online' : event.venue.name || event.venue.city}</span>
                    </div>
                  </div>

                  {/* Attendee Progress Bar */}
                  {event.maxAttendees && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Registration Progress</span>
                        <span>{Math.round((event.currentAttendees / event.maxAttendees) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ 
                            width: `${Math.min((event.currentAttendees / event.maxAttendees) * 100, 100)}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Organizer Info */}
                  <div className="mb-4 p-2 bg-gray-50 rounded-md">
                    <div className="text-xs text-gray-500">Organizer</div>
                    <div className="text-sm font-medium text-gray-900">{event.organizer.name}</div>
                    <div className="text-xs text-gray-600">{event.organizer.email}</div>
                  </div>

                  {/* Status Selectors */}
                  <div className="mb-4 space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Event Status</label>
                      <select
                        value={event.status}
                        onChange={(e) => handleStatusChange(event.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="ongoing">Ongoing</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Registration Status</label>
                      <select
                        value={event.registrationStatus || 'open'}
                        onChange={(e) => handleRegistrationStatusChange(event.id, e.target.value as 'open' | 'closed' | 'walk-in-only')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="walk-in-only">Walk-In Only</option>
                      </select>
                      <div className={`mt-1 px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 ${getRegistrationStatusColor(event.registrationStatus || 'open')}`}>
                        {getRegistrationStatusIcon(event.registrationStatus || 'open')}
                        <span>{getRegistrationStatusLabel(event.registrationStatus || 'open')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/admin/events/${event.id}/attendees`}
                        className="flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Attendees"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Link>
                      <Link
                        to={`/admin/events/edit/${event.id}`}
                        className="flex items-center justify-center w-8 h-8 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors"
                        title="Edit Event"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => event.status === 'published' ? handleShareEvent(event.id, event.title) : null}
                        className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                          event.status === 'published'
                            ? 'text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 cursor-pointer'
                            : 'text-gray-400 cursor-not-allowed bg-gray-50'
                        }`}
                        title={event.status === 'published' ? 'Share Registration Link' : 'Event must be published to share'}
                        disabled={event.status !== 'published'}
                      >
                        <ShareIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleViewFeedback(event.id)}
                        className="flex items-center justify-center w-8 h-8 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-lg transition-colors"
                        title="View Feedback Responses"
                      >
                        <ChatBubbleLeftRightIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/admin/analytics?eventId=${event.id}`}
                        className="flex items-center justify-center w-8 h-8 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Analytics"
                      >
                        <ChartBarIcon className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => openDeleteModal(event.id, event.title)}
                        className="flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Event"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
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
                        Pricing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Organizer
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
                          <div className="flex items-center">
                            {event.imageUrl && (
                              <img
                                src={event.imageUrl}
                                alt={event.title}
                                className="w-10 h-10 rounded-lg object-cover mr-3"
                              />
                            )}
                            <div>
                              <div className="text-sm font-medium text-gray-900">{event.title}</div>
                              <div className="text-sm text-gray-500 truncate max-w-xs">
                                {event.shortDescription || event.description}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {event.category} • {event.tags?.slice(0, 2).join(', ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(event.startDate)}</div>
                          <div className="text-sm text-gray-500">
                            {event.venue.type === 'online' ? 'Online' : event.venue.name || event.venue.city}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {event.currentAttendees}
                            {event.maxAttendees && ` / ${event.maxAttendees}`}
                          </div>
                          {event.maxAttendees && (
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ 
                                  width: `${(event.currentAttendees / event.maxAttendees) * 100}%` 
                                }}
                              ></div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatPrice(event.ticketTypes)}
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
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{event.organizer.name}</div>
                          <div className="text-sm text-gray-500">{event.organizer.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`/admin/events/${event.id}/attendees`}
                              className="text-blue-600 hover:text-blue-900"
                              title="View Attendees"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </Link>
                            <Link
                              to={`/admin/events/edit/${event.id}`}
                              className="text-green-600 hover:text-green-900"
                              title="Edit Event"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => event.status === 'published' ? handleShareEvent(event.id, event.title) : null}
                              className={`${
                                event.status === 'published'
                                  ? 'text-indigo-600 hover:text-indigo-900 cursor-pointer'
                                  : 'text-gray-400 cursor-not-allowed'
                              }`}
                              title={event.status === 'published' ? 'Share Registration Link' : 'Event must be published to share'}
                              disabled={event.status !== 'published'}
                            >
                              <ShareIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleViewFeedback(event.id)}
                              className="text-orange-600 hover:text-orange-900"
                              title="View Feedback Responses"
                            >
                              <ChatBubbleLeftRightIcon className="h-4 w-4" />
                            </button>
                            <Link
                              to={`/admin/analytics?eventId=${event.id}`}
                              className="text-purple-600 hover:text-purple-900"
                              title="Analytics"
                            >
                              <ChartBarIcon className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => openDeleteModal(event.id, event.title)}
                              className="text-red-600 hover:text-red-900"
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
            <div className="lg:hidden space-y-3 p-4">
              {sortedEvents.map((event) => (
                <div key={event.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
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
                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                            {event.title}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                            {event.shortDescription || event.description}
                          </p>
                          <div className="text-xs text-gray-400 mt-1">
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
                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 mb-3">
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 pt-3 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(event.status)}
                      <select
                        value={event.status}
                        onChange={(e) => handleStatusChange(event.id, e.target.value)}
                        className={`text-xs font-medium rounded-lg px-3 py-2 border focus:ring-2 focus:ring-blue-500 ${getStatusColor(event.status)}`}
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
                        to={`/admin/events/${event.id}/attendees`}
                        className="flex items-center justify-center space-x-1 px-2 sm:px-3 py-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors text-xs font-medium min-w-0"
                      >
                        <EyeIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Attendees</span>
                      </Link>
                      <Link
                        to={`/admin/events/edit/${event.id}`}
                        className="flex items-center justify-center space-x-1 px-2 sm:px-3 py-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors text-xs font-medium min-w-0"
                      >
                        <PencilIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Edit</span>
                      </Link>
                      <button
                        onClick={() => event.status === 'published' ? handleShareEvent(event.id, event.title) : null}
                        className={`flex items-center justify-center space-x-1 px-2 sm:px-3 py-2 rounded-lg transition-colors text-xs font-medium min-w-0 ${
                          event.status === 'published'
                            ? 'text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 cursor-pointer'
                            : 'text-gray-400 cursor-not-allowed bg-gray-50'
                        }`}
                        title={event.status === 'published' ? 'Share Registration Link' : 'Event must be published to share'}
                        disabled={event.status !== 'published'}
                      >
                        <ShareIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Share</span>
                      </button>
                      <button
                        onClick={() => handleViewFeedback(event.id)}
                        className="flex items-center justify-center space-x-1 px-2 sm:px-3 py-2 text-orange-600 hover:text-orange-900 hover:bg-orange-50 rounded-lg transition-colors text-xs font-medium min-w-0"
                      >
                        <ChatBubbleLeftRightIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Feedback</span>
                      </button>
                      <Link
                        to={`/admin/analytics?eventId=${event.id}`}
                        className="flex items-center justify-center space-x-1 px-2 sm:px-3 py-2 text-purple-600 hover:text-purple-900 hover:bg-purple-50 rounded-lg transition-colors text-xs font-medium min-w-0"
                      >
                        <ChartBarIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Analytics</span>
                      </Link>
                      <button
                        onClick={() => openDeleteModal(event.id, event.title)}
                        className="flex items-center justify-center space-x-1 px-2 sm:px-3 py-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium min-w-0"
                      >
                        <TrashIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="hidden sm:inline">Delete</span>
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
                className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl
                hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl font-medium">
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Create Event
                  </Link>
              </div>
            )}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          onConfirm={deleteModal.isForceDelete ? handleForceDelete : handleDeleteEvent}
          title="Delete Event"
          message={deleteModal.message}
          confirmText={deleteModal.confirmText}
          cancelText="Cancel"
          type={deleteModal.type}
          isLoading={deleteModal.isLoading}
        />

        {/* Feedback modal removed - now using dedicated page */}
      </LayoutComponent>
    );
  };

  export default ManageEventsPage; 