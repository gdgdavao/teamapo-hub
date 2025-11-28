import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  CheckIcon,
  XMarkIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  UserIcon,
  EyeIcon,
  DocumentTextIcon,
  FunnelIcon,
  UserGroupIcon,
  QrCodeIcon,
  ArrowDownTrayIcon,
  ChatBubbleLeftRightIcon,
  ArrowLeftIcon,
  HomeIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/20/solid';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { RegistrationService } from '../../services/registrationService';
import { EventService } from '../../services/eventService';
import { PaymentService } from '../../services/paymentService';
import { Registration as FirestoreRegistration, Event } from '../../types';
import { logger } from '../../utils/logger';

// Utility function to format dates
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface Registration {
  id: string;
  attendee: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    profilePicture?: string;
    experience?: string;
    interests?: string[];
    bio?: string;
  };
  event: {
    id: string;
    title: string;
    date: string;
    venue: string;
    ticketPrice: number;
  };
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'attended' | 'cancelled';
  quantity: number;
  registrationDate: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentProof?: {
    id: string;
    registrationId: string;
    proofImageUrl?: string;
    transactionId?: string;
    submittedAt: string;
    verificationStatus: 'pending' | 'approved' | 'rejected';
    verifiedAt?: string;
    verifiedBy?: string;
    notes?: string;
  };
  notes?: string;
  requirements?: string[];
  formSubmission?: Record<string, any>;
  qrCode?: string;
  checkInTime?: string;
}

const AttendeesPage: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'attendees' | 'payments'>('attendees');
  const [selectedRegistrations, setSelectedRegistrations] = useState<string[]>([]);
  const [viewingRegistration, setViewingRegistration] = useState<Registration | null>(null);
  const [showingQRCode, setShowingQRCode] = useState<Registration | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState<Registration | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');

  const getSeatCount = (
    items: Registration[],
    predicate?: (registration: Registration) => boolean
  ): number => {
    if (!items.length) {
      return 0;
    }

    return items.reduce((total, registration) => {
      if (predicate && !predicate(registration)) {
        return total;
      }

      const seatCount = registration.quantity && registration.quantity > 0 ? registration.quantity : 1;
      return total + seatCount;
    }, 0);
  };

  const totalAttendeeCount = getSeatCount(registrations);
  const totalPendingPaymentCount = getSeatCount(
    registrations,
    registration => registration.paymentStatus === 'pending'
  );
  const totalPaidCount = getSeatCount(
    registrations,
    registration => registration.paymentStatus === 'paid'
  );
  const totalCheckedInCount = getSeatCount(
    registrations,
    registration => registration.status === 'attended'
  );

  // Load registrations and events from Firestore
  useEffect(() => {
    const fetchData = async () => {
      if (!userProfile?.uid) return;
      
      try {
        setLoading(true);
        
        // First, fetch organizer's events
        const organizerEvents = await EventService.getEventsByOrganizer(userProfile.uid);
        setEvents(organizerEvents);
        
        if (organizerEvents.length === 0) {
          setRegistrations([]);
          setLoading(false);
          return;
        }
        
        // Get all registrations for organizer's events
        const allRegistrations: Registration[] = [];
        
        for (const event of organizerEvents) {
          try {
            const eventRegistrations = await RegistrationService.getEventRegistrations(event.id);
            
            // Transform each registration
            const transformedRegs: Registration[] = eventRegistrations.map(reg => {
              // Map status from Firestore to expected format
              const getDisplayStatus = (fsReg: FirestoreRegistration): Registration['status'] => {
                // First check registrationStatus if it exists
                if ((fsReg as any).registrationStatus) {
                  const regStatus = (fsReg as any).registrationStatus;
                  if (regStatus === 'approved') return 'approved';
                  if (regStatus === 'rejected') return 'rejected';
                  if (regStatus === 'pending') return 'pending';
                }
                
                // Fall back to other status fields
                if (fsReg.attendanceStatus === 'checked-in') return 'attended';
                if (fsReg.attendanceStatus === 'cancelled') return 'cancelled';
                if (fsReg.paymentStatus === 'paid') return 'paid';
                if (fsReg.paymentStatus === 'pending') return 'pending';
                
                return 'pending'; // Default status
              };

              // Map PaymentStatus to expected format
              const mapPaymentStatus = (status: any): Registration['paymentStatus'] => {
                if (status === 'paid') return 'paid';
                if (status === 'pending' || status === 'processing') return 'pending';
                if (status === 'failed') return 'failed';
                if (status === 'refunded') return 'refunded';
                return 'pending'; // Default for any other status including 'cancelled'
              };

              return {
                id: reg.id,
                attendee: {
                  id: reg.userId || reg.id,
                  name: reg.userDetails.name,
                  email: reg.userDetails.email,
                  phone: reg.userDetails.phoneNumber,
                  organization: reg.userDetails.organization,
                  profilePicture: undefined,
                  experience: undefined,
                  interests: [],
                  bio: undefined
                },
                event: {
                  id: event.id,
                  title: event.title,
                  date: event.startDate.toDate().toISOString(),
                  venue: event.venue?.name || event.venue?.address || 'TBA',
                  ticketPrice: reg.totalAmount || 0
                },
                status: getDisplayStatus(reg),
                quantity: reg.quantity || 1,
                registrationDate: reg.registrationDate.toDate().toISOString(),
                paymentStatus: mapPaymentStatus(reg.paymentStatus),
                paymentProof: reg.paymentProof ? {
                  id: reg.paymentProof.id,
                  registrationId: reg.paymentProof.registrationId,
                  proofImageUrl: reg.paymentProof.proofImageUrl,
                  transactionId: reg.paymentProof.transactionId,
                  submittedAt: reg.paymentProof.submittedAt.toDate().toISOString(),
                  verificationStatus: reg.paymentProof.verificationStatus,
                  verifiedAt: reg.paymentProof.verifiedAt ? reg.paymentProof.verifiedAt.toDate().toISOString() : undefined,
                  verifiedBy: reg.paymentProof.verifiedBy,
                  notes: reg.paymentProof.notes
                } : undefined,
                notes: (reg as any).adminNotes || undefined,
                requirements: undefined,
                formSubmission: (reg as any).customResponses || undefined,
                qrCode: reg.qrCode,
                checkInTime: reg.checkInTime ? reg.checkInTime.toDate().toISOString() : undefined
              };
            });
            
            allRegistrations.push(...transformedRegs);
          } catch (error) {
            logger.warn(`Failed to fetch registrations for event ${event.id}:`, error);
          }
        }
        
        setRegistrations(allRegistrations);
        setLoading(false);
      } catch (error) {
        logger.error('Error fetching attendee data:', error);
        setRegistrations([]);
        setEvents([]);
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile?.uid]);

  // Debug logging
  useEffect(() => {
    logger.log('Current registrations:', registrations);
    logger.log('View mode:', viewMode);
    logger.log('Viewing registration:', viewingRegistration);
  }, [registrations, viewMode, viewingRegistration]);

  const handleCheckIn = async (registrationId: string) => {
    try {
      await RegistrationService.organizerCheckInAttendee(registrationId);
      
      // Update local state
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === registrationId 
            ? { ...reg, status: 'attended' as Registration['status'], checkInTime: new Date().toISOString() }
            : reg
        )
      );
      
      logger.log(`Attendee checked in successfully: ${registrationId}`);
    } catch (error: any) {
      logger.error('Failed to check in attendee:', error);
      alert(`Failed to check in attendee: ${error.message || 'Please try again.'}`);
    }
  };

  const handleBulkCheckIn = async () => {
    if (selectedRegistrations.length === 0) return;

    try {
      const checkInPromises = selectedRegistrations.map(registrationId =>
        RegistrationService.organizerCheckInAttendee(registrationId)
      );

      await Promise.all(checkInPromises);

      // Update local state
      setRegistrations(prev => 
        prev.map(reg => 
          selectedRegistrations.includes(reg.id)
            ? { ...reg, status: 'attended' as Registration['status'], checkInTime: new Date().toISOString() }
            : reg
        )
      );

      setSelectedRegistrations([]);
      logger.log(`Bulk check-in completed for ${selectedRegistrations.length} attendees`);
    } catch (error: any) {
      logger.error('Failed to bulk check in attendees:', error);
      alert(`Failed to bulk check in attendees: ${error.message || 'Please try again.'}`);
    }
  };

  const handleExportData = async () => {
    if (eventFilter === 'all') {
      alert('Please select a specific event to export data.');
      return;
    }
    
    try {
      const csvData = await RegistrationService.exportRegistrations(eventFilter);
      
      // Create and download CSV file
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const event = events.find(e => e.id === eventFilter);
      link.download = `${event?.title || 'Event'}_Attendees_${new Date().toISOString().split('T')[0]}.csv`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      logger.log('Attendee data exported successfully');
    } catch (error) {
      logger.error('Failed to export data:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const toggleRegistrationSelection = (registrationId: string) => {
    setSelectedRegistrations(prev => 
      prev.includes(registrationId)
        ? prev.filter(id => id !== registrationId)
        : [...prev, registrationId]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = filteredRegistrations.map(reg => reg.id);
    setSelectedRegistrations(visibleIds);
  };

  const clearSelection = () => {
    setSelectedRegistrations([]);
  };

  const handlePaymentVerification = async (registrationId: string, status: 'approved' | 'rejected') => {
    if (!userProfile?.uid) return;
    
    try {
      await PaymentService.verifyPaymentProof(
        registrationId,
        status,
        userProfile.uid,
        userProfile.displayName || 'Organizer',
        verificationNotes
      );

      // Refresh registrations data
      const organizerEvents = await EventService.getEventsByOrganizer(userProfile.uid);
      const allRegistrations: Registration[] = [];
      
      for (const event of organizerEvents) {
        const eventRegistrations = await RegistrationService.getEventRegistrations(event.id);
        const transformedRegs: Registration[] = eventRegistrations.map(reg => {
          // Transform registration data (same logic as in useEffect)
          const getDisplayStatus = (fsReg: any): Registration['status'] => {
            const regStatus = fsReg.attendanceStatus || fsReg.status;
            if (regStatus === 'checked_in' || regStatus === 'attended') return 'attended';
            if (regStatus === 'approved') return 'approved';
            if (regStatus === 'rejected') return 'rejected';
            if (regStatus === 'cancelled') return 'cancelled';
            
            if (fsReg.paymentStatus === 'paid') return 'paid';
            if (fsReg.paymentStatus === 'pending') return 'pending';
            return 'pending';
          };

          const mapPaymentStatus = (status: any): Registration['paymentStatus'] => {
            if (status === 'paid' || status === 'completed') return 'paid';
            if (status === 'pending' || status === 'processing') return 'pending';
            if (status === 'failed') return 'failed';
            if (status === 'refunded') return 'refunded';
            return 'pending';
          };

          return {
            id: reg.id,
            attendee: {
              id: reg.userId || reg.id,
              name: reg.userDetails.name,
              email: reg.userDetails.email,
              phone: reg.userDetails.phoneNumber,
              organization: reg.userDetails.organization,
            },
            event: {
              id: event.id,
              title: event.title,
              date: event.startDate.toDate().toISOString(),
              venue: event.venue?.name || event.venue?.address || 'TBA',
              ticketPrice: reg.totalAmount || 0
            },
            status: getDisplayStatus(reg),
            quantity: reg.quantity || 1,
            registrationDate: reg.registrationDate.toDate().toISOString(),
            paymentStatus: mapPaymentStatus(reg.paymentStatus),
            qrCode: reg.qrCode,
            checkInTime: reg.checkInTime?.toDate().toISOString()
          };
        });
        allRegistrations.push(...transformedRegs);
      }
      
      setRegistrations(allRegistrations);
      setVerifyingPayment(null);
      setVerificationNotes('');
      
      logger.log(`Payment ${status} successfully`);
    } catch (error) {
      logger.error('Error verifying payment:', error);
      alert('Failed to verify payment. Please try again.');
    }
  };

  const filteredRegistrations = registrations.filter(registration => {
    const matchesSearch = 
      registration.attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.attendee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.attendee.organization?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // In payment verification mode, only show registrations with pending payments
    if (viewMode === 'payments') {
      return matchesSearch && registration.paymentStatus === 'pending';
    }
    
    const matchesStatus = statusFilter === 'all' || registration.status === statusFilter;
    const matchesEvent = eventFilter === 'all' || registration.event.id === eventFilter;
    
    if (statusFilter === 'attended') {
      const statusMatch = 
        registration.status === 'attended' || 
        registration.checkInTime !== undefined;
      return matchesSearch && matchesEvent && statusMatch;
    }
    
    return matchesSearch && matchesEvent && matchesStatus;
  });
  const filteredAttendeeCount = getSeatCount(filteredRegistrations);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-secondary-500" />;
      case 'paid':
        return <CurrencyDollarIcon className="h-5 w-5 text-accent-500" />;
      case 'attended':
        return <CheckCircleIcon className="h-5 w-5 text-purple-500" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-accent-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success-100 text-success-800';
      case 'rejected':
        return 'bg-secondary-100 text-secondary-800';
      case 'paid':
        return 'bg-accent-100 text-accent-800';
      case 'attended':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-accent-100 text-accent-800';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded-xl"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/organizer')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 mr-2" />
                Back to Dashboard
              </button>
              <div className="h-6 border-l border-gray-300" />
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <HomeIcon className="w-4 h-4" />
                <span>Organizer</span>
                <ChevronRightIcon className="w-4 h-4" />
                <span className="text-gray-900 font-medium">Attendees</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/organizer/events"
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <CalendarDaysIcon className="w-4 h-4 mr-2" />
                Manage Events
              </Link>
              {/* Create Event functionality removed - only admins can create events */}
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex">
            <button
              onClick={() => {
                setViewMode('attendees');
                setStatusFilter('all'); // Reset filter when switching views
              }}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'attendees'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Attendees
              <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                {totalAttendeeCount}
              </span>
            </button>
            <button
              onClick={() => {
                setViewMode('payments');
                setStatusFilter('pending'); // Auto-filter to pending payments
              }}
              className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                viewMode === 'payments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Payment Verification
              <span className="ml-2 bg-yellow-100 text-yellow-800 py-0.5 px-2.5 rounded-full text-xs">
                {totalPendingPaymentCount}
              </span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Attendee Management</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage attendees for your events and track their status.
              </p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center space-x-3">
              {selectedRegistrations.length > 0 && viewMode !== 'payments' && (
                <button
                  onClick={handleBulkCheckIn}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <CheckIcon className="w-4 h-4 mr-2" />
                  Check In Selected ({selectedRegistrations.length})
                </button>
              )}
              <button
                onClick={handleExportData}
                disabled={eventFilter === 'all'}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                Export Data
              </button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <UserGroupIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Total Attendees</p>
                  <p className="text-2xl font-bold text-gray-900">{totalAttendeeCount}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircleIcon className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Checked In</p>
                  <p className="text-2xl font-bold text-gray-900">{totalCheckedInCount}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <CurrencyDollarIcon className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Paid</p>
                  <p className="text-2xl font-bold text-gray-900">{totalPaidCount}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <CalendarDaysIcon className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-600">Events</p>
                  <p className="text-2xl font-bold text-gray-900">{events.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search attendees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
                  />
                </div>

                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Events</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                  <option value="attended">Attended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="text-sm text-gray-600">
                {filteredAttendeeCount} attendee{filteredAttendeeCount !== 1 ? 's' : ''} found
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedRegistrations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedRegistrations.length} attendee{selectedRegistrations.length !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={selectAllVisible}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Select All Visible ({filteredRegistrations.length})
              </button>
            </div>
            
            <div className="text-sm text-gray-500">
              Showing {filteredAttendeeCount} of {totalAttendeeCount} attendees
            </div>
          </div>

          {/* Attendees List */}
          <div className="bg-white rounded-xl border border-gray-200">
            {filteredRegistrations.length === 0 ? (
              <div className="text-center py-12">
                <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No attendees found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || statusFilter !== 'all' || eventFilter !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : events.length === 0 
                      ? 'Create an event first to start receiving registrations.'
                      : 'Attendees will appear here once people start registering for your events.'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredRegistrations.map((registration) => (
                  <div key={registration.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start space-x-4">
                      {/* Selection Checkbox */}
                      <div className="flex items-center pt-1">
                        <input
                          type="checkbox"
                          checked={selectedRegistrations.includes(registration.id)}
                          onChange={() => toggleRegistrationSelection(registration.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </div>

                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {registration.attendee.profilePicture ? (
                          <img
                            src={registration.attendee.profilePicture}
                            alt={registration.attendee.name}
                            className="h-12 w-12 rounded-full"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                            <UserIcon className="h-6 w-6 text-gray-600" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {registration.attendee.name}
                          </h3>
                          <div className="flex items-center space-x-1">
                            {viewMode === 'payments' ? (
                              <>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  registration.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                  registration.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  Payment: {registration.paymentStatus}
                                </span>
                                {registration.paymentStatus === 'pending' && (
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    registration.paymentProof ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {registration.paymentProof ? '📄 Proof Submitted' : '❌ No Proof'}
                                  </span>
                                )}
                              </>
                            ) : (
                              <>
                                {getStatusIcon(registration.status)}
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(registration.status)}`}>
                                  {registration.status}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <EnvelopeIcon className="h-4 w-4" />
                              <span>{registration.attendee.email}</span>
                            </div>
                            {registration.attendee.phone && (
                              <div className="flex items-center space-x-2">
                                <PhoneIcon className="h-4 w-4" />
                                <span>{registration.attendee.phone}</span>
                              </div>
                            )}
                            {registration.attendee.organization && (
                              <div className="flex items-center space-x-2">
                                <BuildingOfficeIcon className="h-4 w-4" />
                                <span>{registration.attendee.organization}</span>
                              </div>
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <CalendarDaysIcon className="h-4 w-4" />
                              <span>{registration.event.title}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <DocumentTextIcon className="h-4 w-4" />
                              <span>Registered: {formatDate(registration.registrationDate)}</span>
                            </div>
                            {registration.checkInTime && (
                              <div className="flex items-center space-x-2">
                                <CheckIcon className="h-4 w-4" />
                                <span>Checked in: {formatDate(registration.checkInTime)}</span>
                              </div>
                            )}
                            {registration.event.ticketPrice > 0 && (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-green-600">
                                  ₱{registration.event.ticketPrice.toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        {viewMode === 'payments' ? (
                          // Payment verification buttons
                          <>
                            {registration.paymentStatus === 'pending' && registration.paymentProof && (
                              <>
                                <button
                                  onClick={() => handlePaymentVerification(registration.id, 'approved')}
                                  className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                                >
                                  <CheckIcon className="w-4 h-4 mr-1" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handlePaymentVerification(registration.id, 'rejected')}
                                  className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                                >
                                  <XMarkIcon className="w-4 h-4 mr-1" />
                                  Reject
                                </button>
                              </>
                            )}
                            {registration.paymentStatus === 'pending' && !registration.paymentProof && (
                              <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-md">
                                Waiting for proof
                              </span>
                            )}
                            <button
                              onClick={() => {
                                logger.log('View Payment clicked for:', registration);
                                setViewingRegistration(registration);
                              }}
                              className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                            >
                              <EyeIcon className="w-4 h-4 mr-1" />
                              View Payment
                            </button>
                          </>
                        ) : (
                          // Regular attendee management buttons
                          <>
                            {registration.status !== 'attended' && registration.status !== 'cancelled' && (
                              <button
                                onClick={() => handleCheckIn(registration.id)}
                                className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                              >
                                <CheckIcon className="w-4 h-4 mr-1" />
                                Check In
                              </button>
                            )}
                            <button
                              onClick={() => setViewingRegistration(registration)}
                              className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                            >
                              <EyeIcon className="w-4 h-4 mr-1" />
                              View
                            </button>
                            {registration.qrCode && (
                              <button
                                onClick={() => setShowingQRCode(registration)}
                                className="inline-flex items-center px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                              >
                                <QrCodeIcon className="w-4 h-4 mr-1" />
                                QR
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Registration Details Modal */}
          {viewingRegistration && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {viewMode === 'payments' ? 'Payment Verification' : 'Attendee Details'}
                  </h2>
                  <button
                    onClick={() => setViewingRegistration(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                
                {/* Content */}
                <div className="p-4">
                  {viewMode === 'payments' ? (
                    // Payment verification view
                    <div className="space-y-6">
                      {/* Payment Status */}
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-700">Payment Status</span>
                            <div className={`inline-block px-2 py-1 text-xs font-medium rounded-full ml-2 ${
                              viewingRegistration.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                              viewingRegistration.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {viewingRegistration.paymentStatus}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Amount</span>
                            <div className="text-gray-900 font-semibold">
                              ₱{viewingRegistration.event.ticketPrice.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Attendee Info */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Attendee Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-700">Name</span>
                            <div className="text-gray-900">
                              {viewingRegistration.attendee.name}
                            </div>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-700">Email</span>
                            <div className="text-gray-900">
                              {viewingRegistration.attendee.email}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Payment Proof Section */}
                      {viewingRegistration.paymentProof && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Proof</h3>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-700">Transaction ID</span>
                                <div className="text-gray-900 font-mono text-sm">
                                  {viewingRegistration.paymentProof.transactionId || 'N/A'}
                                </div>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-700">Submitted</span>
                                <div className="text-gray-900 text-sm">
                                  {formatDate(viewingRegistration.paymentProof.submittedAt)}
                                </div>
                              </div>
                            </div>
                            
                            {viewingRegistration.paymentProof.notes && (
                              <div>
                                <span className="text-sm font-medium text-gray-700">Notes</span>
                                <div className="text-gray-900 text-sm mt-1">
                                  {viewingRegistration.paymentProof.notes}
                                </div>
                              </div>
                            )}
                            
                            {viewingRegistration.paymentProof.proofImageUrl && (
                              <div>
                                <span className="text-sm font-medium text-gray-700">Payment Screenshot</span>
                                <div className="mt-2">
                                  <img
                                    src={viewingRegistration.paymentProof.proofImageUrl}
                                    alt="Payment proof"
                                    className="max-w-full h-auto max-h-64 rounded-lg border border-gray-200 cursor-pointer"
                                    onClick={() => window.open(viewingRegistration.paymentProof?.proofImageUrl, '_blank')}
                                  />
                                  <p className="text-xs text-gray-500 mt-1">Click to view full size</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* No Payment Proof Warning */}
                      {!viewingRegistration.paymentProof && viewingRegistration.paymentStatus === 'pending' && (
                        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-yellow-800">No Payment Proof Submitted</h3>
                              <p className="text-sm text-yellow-700 mt-1">
                                This registration is marked as pending payment, but no payment proof has been submitted yet.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Payment Actions */}
                      <div className="flex justify-between pt-4 border-t">
                        <button
                          onClick={() => setViewingRegistration(null)}
                          className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
                        >
                          Close
                        </button>
                        {viewingRegistration.paymentStatus === 'pending' && viewingRegistration.paymentProof && (
                          <div className="flex space-x-3">
                            <button
                              onClick={() => {
                                handlePaymentVerification(viewingRegistration.id, 'rejected');
                                setViewingRegistration(null);
                              }}
                              className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                            >
                              Reject Payment
                            </button>
                            <button
                              onClick={() => {
                                handlePaymentVerification(viewingRegistration.id, 'approved');
                                setViewingRegistration(null);
                              }}
                              className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                            >
                              Approve Payment
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Regular attendee view
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Attendee Info */}
                      <div className="space-y-4">
                        <div>
                          <span className="text-sm font-medium text-gray-700">Name</span>
                          <div className="text-lg font-semibold text-gray-900">
                            {viewingRegistration.attendee.name}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Email</span>
                          <div className="text-gray-900">
                            {viewingRegistration.attendee.email}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Phone</span>
                          <div className="text-gray-900">
                            {viewingRegistration.attendee.phone || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Organization</span>
                          <div className="text-gray-900">
                            {viewingRegistration.attendee.organization || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Status</span>
                          <div className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(viewingRegistration.status)}`}>
                            {viewingRegistration.status}
                          </div>
                        </div>
                      </div>
                      
                      {/* Event Info */}
                      <div className="space-y-4">
                        <div>
                          <span className="text-sm font-medium text-gray-700">Event</span>
                          <div className="text-lg font-semibold text-gray-900">
                            {viewingRegistration.event.title}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Date & Time</span>
                          <div className="text-gray-900">
                            {formatDate(viewingRegistration.event.date)}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Venue</span>
                          <div className="text-gray-900">
                            {viewingRegistration.event.venue}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Ticket Price</span>
                          <div className="text-gray-900">
                            ₱{viewingRegistration.event.ticketPrice.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-700">Registration Date</span>
                          <div className="text-gray-900">
                            {formatDate(viewingRegistration.registrationDate)}
                          </div>
                        </div>
                        {viewingRegistration.checkInTime && (
                          <div>
                            <span className="text-sm font-medium text-gray-700">Check-in Time</span>
                            <div className="text-gray-900">
                              {formatDate(viewingRegistration.checkInTime)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Notes and QR Code */}
                  <div className="mt-6 space-y-4">
                    {viewingRegistration.qrCode && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">QR Code</span>
                        <div className="text-gray-900 font-mono text-sm bg-gray-100 p-2 rounded">
                          {viewingRegistration.qrCode}
                        </div>
                      </div>
                    )}
                    
                    {viewingRegistration.notes && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">Notes</span>
                        <div className="text-gray-900 text-sm bg-gray-100 p-2 rounded">
                          {viewingRegistration.notes}
                        </div>
                      </div>
                    )}

                    {viewingRegistration.formSubmission && Object.keys(viewingRegistration.formSubmission).length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-gray-700">Form Responses</span>
                        <div className="text-gray-900 text-sm bg-gray-100 p-2 rounded space-y-1">
                          {Object.entries(viewingRegistration.formSubmission).map(([key, value]) => (
                            <div key={key}>
                              <strong>{key}:</strong> {String(value)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Footer */}
                {viewMode !== 'payments' && (
                  <div className="flex justify-between items-center p-4 border-t">
                    <div className="flex space-x-2">
                      {viewingRegistration.status !== 'attended' && viewingRegistration.status !== 'cancelled' && (
                        <button
                          onClick={() => {
                            handleCheckIn(viewingRegistration.id);
                            setViewingRegistration(null);
                          }}
                          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                        >
                          <CheckIcon className="w-4 h-4 mr-2" />
                          Check In
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setViewingRegistration(null)}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* QR Code Modal */}
          {showingQRCode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-900">
                    QR Code - {showingQRCode.attendee.name}
                  </h2>
                  <button
                    onClick={() => setShowingQRCode(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
                
                {/* Content */}
                <div className="p-6 text-center">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Event: {showingQRCode.event.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      Scan this QR code for check-in
                    </p>
                  </div>
                  
                  {/* QR Code Image */}
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200 inline-block">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(showingQRCode.qrCode || '')}`}
                      alt="QR Code"
                      className="w-48 h-48"
                      onError={(e) => {
                        // Fallback if QR service fails
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLImageElement).parentElement;
                        if (parent) {
                          parent.innerHTML = `
                            <div class="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-500 text-sm text-center p-4">
                              <div>
                                <div class="font-mono text-xs break-all">${showingQRCode.qrCode}</div>
                                <div class="mt-2 text-xs">QR Code: ${showingQRCode.qrCode}</div>
                              </div>
                            </div>
                          `;
                        }
                      }}
                    />
                  </div>
                  
                  {/* QR Code Text */}
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-2">QR Code Text:</p>
                    <p className="text-sm font-mono bg-gray-100 p-2 rounded text-gray-700 break-all">
                      {showingQRCode.qrCode}
                    </p>
                  </div>
                  
                  {/* Status Info */}
                  <div className="mt-4 text-sm">
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(showingQRCode.status)}`}>
                      {showingQRCode.status}
                    </div>
                    {showingQRCode.checkInTime && (
                      <p className="text-xs text-gray-500 mt-2">
                        Checked in: {formatDate(showingQRCode.checkInTime)}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Footer */}
                <div className="flex justify-between items-center p-4 border-t">
                  <div className="flex space-x-2">
                    {showingQRCode.status !== 'attended' && showingQRCode.status !== 'cancelled' && (
                      <button
                        onClick={() => {
                          handleCheckIn(showingQRCode.id);
                          setShowingQRCode(null);
                        }}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                      >
                        <CheckIcon className="w-4 h-4 mr-2" />
                        Check In
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowingQRCode(null)}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AttendeesPage; 