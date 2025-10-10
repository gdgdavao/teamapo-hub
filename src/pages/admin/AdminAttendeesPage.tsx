import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
  ChatBubbleLeftRightIcon,
  BellIcon,
  DocumentTextIcon,
  FunnelIcon,
  UserGroupIcon,
  CameraIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/20/solid';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import AdminLayout from '../../components/admin/AdminLayout';
import OrganizerLayout from '../../components/organizer/OrganizerLayout';
import { useAuth } from '../../contexts/AuthContext';
import { RegistrationService } from '../../services/registrationService';
import { EventService } from '../../services/eventService';
import { PaymentService } from '../../services/paymentService';
import { Registration as FirestoreRegistration, Event } from '../../types';
import { getDownloadUrlFromPath } from '../../utils/storageUtils';

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

// Safely convert Firestore Timestamp, plain object with seconds, Date, or string to ISO string
const toISOStringSafe = (value: any): string => {
  try {
    if (!value) return new Date().toISOString();
    if (typeof value?.toDate === 'function') {
      const d = value.toDate();
      return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
    }
    if (value instanceof Date) return value.toISOString();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
    }
    // Fallback to now
    return new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
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
  priority?: 'low' | 'medium' | 'high';
  promoCode?: string;
  quantity?: number;
  originalAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  currency?: string;
  ticketTypeId?: string;
  pricing?: {
    originalPrice?: number;
    currentPrice?: number;
    discountAmount?: number;
    promoCode?: {
      code?: string;
      name?: string;
      discountType?: 'percentage' | 'fixed';
      discountValue?: number;
    };
  };
}

const AdminAttendeesPage: React.FC = () => {
  const { userProfile } = useAuth();
  const { eventId } = useParams<{ eventId?: string }>();
  const isAdmin = userProfile?.role === 'admin';
  const LayoutComponent = isAdmin ? AdminLayout : OrganizerLayout;
  
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventFilter, setEventFilter] = useState<string>(eventId || 'all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string>('all');
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>('all');
  const [registrationTypeFilter, setRegistrationTypeFilter] = useState<string>('all');
  const [viewingRegistration, setViewingRegistration] = useState<Registration | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [viewMode, setViewMode] = useState<'management' | 'details'>('management');
  const [convertedImageUrls, setConvertedImageUrls] = useState<Record<string, string>>({});
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});
  const [loadingProof, setLoadingProof] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState<{
    name: string;
    email: string;
    phone: string;
    organization: string;
  } | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  
  // Bulk selection state
  const [selectedRegistrations, setSelectedRegistrations] = useState<Set<string>>(new Set());
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Load registrations from API
  useEffect(() => {
    const fetchRegistrations = async () => {
      if (!userProfile?.uid) return;
      
      try {
        setLoading(true);
        
        let firestoreRegistrations: FirestoreRegistration[];
        let organizerEvents: Event[] = [];
        
        if (isAdmin) {
          // Admin can see all registrations
          firestoreRegistrations = await RegistrationService.getAllRegistrations();
          // Fetch all events for filtering
          organizerEvents = await EventService.getAllEvents();
        } else if (userProfile.role === 'organizer') {
          // Organizers can now see all events and their registrations (updated business rule)
          organizerEvents = await EventService.getAllEvents();
          firestoreRegistrations = await RegistrationService.getAllRegistrations();
        } else {
          // Other users see nothing
          organizerEvents = [];
          firestoreRegistrations = [];
        }
        
        setEvents(organizerEvents);
        
        // If viewing a specific event, set the current event and filter registrations
        if (eventId) {
          const specificEvent = organizerEvents.find(event => event.id === eventId);
          setCurrentEvent(specificEvent || null);
        }
        
        // Transform data to match expected interface
        const transformedRegistrations: Registration[] = [];
        
        // Create a map from the events we already fetched
        const eventsCache = new Map<string, Event>();
        organizerEvents.forEach(event => {
          eventsCache.set(event.id, event);
        });
        
        for (const reg of firestoreRegistrations) {
          // Get event data from cache
          const event = eventsCache.get(reg.eventId);
          if (!event) continue; // Skip if event not found (shouldn't happen for organizers)
          
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

          const transformedReg: Registration = {
            id: reg.id,
            attendee: {
              id: reg.userId || reg.id,
              name: reg.userDetails.name,
              email: reg.userDetails.email,
              phone: reg.userDetails.phoneNumber,
              organization: reg.userDetails.organization,
              profilePicture: undefined, // Not available in current structure
              experience: undefined,
              interests: [],
              bio: undefined
            },
            event: {
              id: event.id,
              title: event.title,
              date: toISOStringSafe((event as any)?.startDate ?? (event as any)?.startDateTime ?? (event as any)?.date),
              venue: event.venue?.name || event.venue?.address || 'TBA',
              ticketPrice: (reg as any).pricing?.currentPrice || (reg.totalAmount && reg.quantity ? (reg.totalAmount / reg.quantity) : 0)
            },
            status: getDisplayStatus(reg),
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
            priority: 'medium', // Default priority
            promoCode: (reg as any).promoCode || undefined,
            quantity: (reg as any).quantity,
            originalAmount: (reg as any).originalAmount,
            discountAmount: (reg as any).discountAmount,
            totalAmount: (reg as any).totalAmount,
            currency: (reg as any).currency,
            ticketTypeId: (reg as any).ticketTypeId || undefined,
            pricing: (reg as any).pricing
          };

          
          transformedRegistrations.push(transformedReg);
        }
        
        setRegistrations(transformedRegistrations);
        setEvents(Array.from(eventsCache.values()));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching registrations:', error);
        setRegistrations([]);
        setEvents([]);
        setLoading(false);
      }
    };

    fetchRegistrations();
  }, []);

  // When opening the details modal, fetch latest payment proof if not already present
  useEffect(() => {
    const fetchLatestProof = async () => {
      if (!viewingRegistration || viewingRegistration.paymentProof) return;
      try {
        setLoadingProof(true);
        const proof = await PaymentService.getLatestPaymentProofByRegistrationId(viewingRegistration.id);
        if (proof) {
          setViewingRegistration(prev => prev ? {
            ...prev,
            paymentProof: {
              id: proof.id,
              registrationId: proof.registrationId,
              proofImageUrl: proof.proofImageUrl,
              transactionId: proof.transactionId,
              submittedAt: proof.submittedAt,
              verificationStatus: proof.verificationStatus,
              verifiedAt: proof.verifiedAt,
              verifiedBy: proof.verifiedBy,
              notes: proof.notes
            }
          } : prev);
        }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.warn('[AdminAttendeesPage] Failed to load latest payment proof', e);
        
        // Show user-friendly message if it's an index error
        if (e?.message?.includes('index') || e?.code === 'failed-precondition') {
          // eslint-disable-next-line no-console
          console.error(
            '⚠️ Firestore Index Required!\n\n' +
            'Please create the required index by visiting:\n' +
            'Firebase Console → Firestore Database → Indexes\n\n' +
            'Or use: firebase deploy --only firestore:indexes'
          );
        }
      } finally {
        setLoadingProof(false);
      }
    };

    fetchLatestProof();
  }, [viewingRegistration?.id]);


  const handleStatusChange = (registrationId: string, newStatus: Registration['status'], notes?: string) => {
    // Only handle admin status changes (approved/rejected)
    if (newStatus === 'approved' || newStatus === 'rejected') {
      const updateStatus = async () => {
        try {
          await RegistrationService.updateRegistrationStatus(
            registrationId, 
            newStatus as 'approved' | 'rejected',
            notes
          );
          
          // Update local state after successful update
          setRegistrations(prev => 
            prev.map(reg => 
              reg.id === registrationId 
                ? { ...reg, status: newStatus, notes: notes || reg.notes }
                : reg
            )
          );

          // Simulate email notification
          const registration = registrations.find(r => r.id === registrationId);
          if (registration) {
            console.log(`Email notification sent to ${registration.attendee.email} - Status: ${newStatus}`);
          }
        } catch (error) {
          console.error('Failed to update registration status:', error);
          // You might want to show a toast notification here
          alert('Failed to update registration status. Please try again.');
        }
      };
      
      updateStatus();
    } else {
      // For other status changes, just update locally for now
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === registrationId 
            ? { ...reg, status: newStatus, notes: notes || reg.notes }
            : reg
        )
      );

      // Simulate email notification
      const registration = registrations.find(r => r.id === registrationId);
      if (registration) {
        console.log(`Email notification sent to ${registration.attendee.email} - Status: ${newStatus}`);
      }
    }
  };



  const handlePaymentVerification = async (registrationId: string, action: 'approved' | 'rejected') => {
    try {
      // Find the registration
      const registration = registrations.find(r => r.id === registrationId);

      // Ensure we have a payment proof; if missing, try to fetch the latest
      let proofId: string | null = registration?.paymentProof?.id || null;
      if (!proofId) {
        const latestProof = await PaymentService.getLatestPaymentProofByRegistrationId(registrationId);
        if (!latestProof) {
          throw new Error('No payment proof found for this registration');
        }
        proofId = latestProof.id;
      }

      // Delegate verification to PaymentService which updates proof and registration
      const verifierUid = userProfile?.uid || 'system';
      const verifierName = (userProfile as any)?.displayName || (userProfile as any)?.email || 'Admin';
      await PaymentService.verifyPaymentProof(proofId, action, verifierUid, verifierName);

      // Update local state optimistically
      setRegistrations(prev => prev.map(reg => {
        if (reg.id !== registrationId) return reg;
        const updatedPaymentStatus = action === 'approved' ? 'paid' : 'failed';
        const existingProof = reg.paymentProof || undefined;
        const updatedProof = existingProof ? {
          ...existingProof,
          verificationStatus: action,
          verifiedAt: new Date().toISOString(),
          verifiedBy: verifierName
        } : existingProof;
        return {
          ...reg,
          paymentStatus: updatedPaymentStatus,
          paymentProof: updatedProof
        };
      }));

      // If the modal is open for this registration, update it too
      setViewingRegistration(prev => {
        if (!prev || prev.id !== registrationId) return prev;
        const updatedPaymentStatus = action === 'approved' ? 'paid' : 'failed';
        const updatedProof = prev.paymentProof ? {
          ...prev.paymentProof,
          verificationStatus: action,
          verifiedAt: new Date().toISOString(),
          verifiedBy: verifierName
        } : prev.paymentProof;
        return {
          ...prev,
          paymentStatus: updatedPaymentStatus,
          paymentProof: updatedProof
        };
      });

      console.log(`Payment ${action} for registration ${registrationId}`);
    } catch (error) {
      console.error('Failed to update payment status:', error);
      alert(`Failed to ${action} payment. Please try again.`);
    }
  };

  // Function to open registration details modal
  const handleViewRegistration = (registration: Registration) => {
    setViewingRegistration(registration);
  };

  // Function to start editing attendee details
  const handleStartEditingDetails = (registration: Registration) => {
    setEditingAttendee(registration.id);
    setEditingDetails({
      name: registration.attendee.name,
      email: registration.attendee.email,
      phone: registration.attendee.phone || '',
      organization: registration.attendee.organization || ''
    });
  };

  // Function to cancel editing
  const handleCancelEditingDetails = () => {
    setEditingAttendee(null);
    setEditingDetails(null);
  };

  // Function to save updated attendee details
  const handleSaveAttendeeDetails = async (registrationId: string) => {
    if (!editingDetails) return;

    try {
      setSavingDetails(true);

      // Update in Firestore
      const registrationRef = doc(db, 'registrations', registrationId);
      await updateDoc(registrationRef, {
        'userDetails.name': editingDetails.name,
        'userDetails.email': editingDetails.email,
        'userDetails.phoneNumber': editingDetails.phone,
        'userDetails.organization': editingDetails.organization,
        updatedAt: serverTimestamp()
      });

      // Update local state
      setRegistrations(prev => prev.map(reg => 
        reg.id === registrationId 
          ? {
              ...reg,
              attendee: {
                ...reg.attendee,
                name: editingDetails.name,
                email: editingDetails.email,
                phone: editingDetails.phone,
                organization: editingDetails.organization
              }
            }
          : reg
      ));

      // Reset editing state
      setEditingAttendee(null);
      setEditingDetails(null);

      // Show success message
      console.log('Attendee details updated successfully');
    } catch (error) {
      console.error('Failed to update attendee details:', error);
      alert('Failed to update attendee details. Please try again.');
    } finally {
      setSavingDetails(false);
    }
  };

  // Convert storage path to download URL when modal opens
  useEffect(() => {
    if (!viewingRegistration?.paymentProof?.proofImageUrl) {
      return;
    }

    const proofImageUrl = viewingRegistration.paymentProof.proofImageUrl;
    const cacheKey = viewingRegistration.id + '_proof';
    
    // Skip if already converted and cached
    if (convertedImageUrls[cacheKey]) {
      return;
    }
    
    // Skip if already loading
    if (imageLoadingStates[cacheKey]) {
      return;
    }
    
    // Don't try to convert if it's already a full URL
    if (proofImageUrl.startsWith('https://')) {
      return;
    }
    
    // Set loading state and convert
    const convertImage = async () => {
      setImageLoadingStates(prev => ({ ...prev, [cacheKey]: true }));
      
      try {
        const downloadUrl = await getDownloadUrlFromPath(proofImageUrl);
        if (downloadUrl) {
          setConvertedImageUrls(prev => ({ ...prev, [cacheKey]: downloadUrl }));
        }
      } catch (error) {
        console.error('Failed to convert payment proof image URL:', error);
      } finally {
        setImageLoadingStates(prev => ({ ...prev, [cacheKey]: false }));
      }
    };

    convertImage();
  }, [viewingRegistration?.id, viewingRegistration?.paymentProof?.proofImageUrl, convertedImageUrls, imageLoadingStates]);

  const exportToCSV = () => {
    // Define CSV headers
    const headers = [
      'Attendee Name',
      'Email',
      'Phone',
      'Organization'
    ];

    // Convert registrations to CSV rows
    const csvRows = [headers.join(',')];
    
    filteredRegistrations.forEach(registration => {
      const row = [
        `"${registration.attendee.name}"`,
        `"${registration.attendee.email}"`,
        `"${registration.attendee.phone || ''}"`,
        `"${registration.attendee.organization || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    // Create and download CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Get event name for filename (use first event if multiple)
      const eventName = filteredRegistrations.length > 0 
        ? filteredRegistrations[0].event.title.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        : 'event';
      
      link.setAttribute('download', `${eventName}_attendees_export.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } 
  };



  // Get unique ticket types from current event or all events
  const availableTicketTypes = React.useMemo(() => {
    const ticketTypesMap = new Map<string, { id: string; name: string; price: number }>();
    
    const eventsToCheck = currentEvent ? [currentEvent] : events;
    eventsToCheck.forEach(event => {
      event.ticketTypes?.forEach(tt => {
        if (!ticketTypesMap.has(tt.id)) {
          ticketTypesMap.set(tt.id, { id: tt.id, name: tt.name, price: tt.price });
        }
      });
    });
    
    return Array.from(ticketTypesMap.values());
  }, [currentEvent, events]);

  const filteredRegistrations = registrations.filter(registration => {
    const matchesSearch = 
      registration.attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.attendee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.attendee.organization?.toLowerCase().includes(searchTerm.toLowerCase());
    

    const matchesStatus = statusFilter === 'all' || registration.status === statusFilter;
    // If viewing a specific event, only show registrations for that event
    const matchesEvent = eventId ? registration.event.id === eventId : (eventFilter === 'all' || registration.event.id === eventFilter);
    const matchesPriority = priorityFilter === 'all' || registration.priority === priorityFilter;
    
    // Ticket type filter
    const matchesTicketType = ticketTypeFilter === 'all' || registration.ticketTypeId === ticketTypeFilter;
    
    // Price range filter
    const totalAmount = registration.totalAmount || 0;
    const matchesPriceRange = 
      priceRangeFilter === 'all' ||
      (priceRangeFilter === 'free' && totalAmount === 0) ||
      (priceRangeFilter === 'under-500' && totalAmount > 0 && totalAmount < 500) ||
      (priceRangeFilter === '500-1000' && totalAmount >= 500 && totalAmount < 1000) ||
      (priceRangeFilter === '1000-2000' && totalAmount >= 1000 && totalAmount < 2000) ||
      (priceRangeFilter === 'above-2000' && totalAmount >= 2000);
    
    // Registration type filter
    const regType = (registration as any).registrationType || 'online';
    const matchesRegistrationType = 
      registrationTypeFilter === 'all' || 
      regType === registrationTypeFilter;
    
    return matchesSearch && matchesStatus && matchesEvent && matchesPriority && matchesTicketType && matchesPriceRange && matchesRegistrationType;
  });

  // Bulk selection handlers (must be after filteredRegistrations)
  const handleSelectAll = () => {
    if (isSelectAllChecked) {
      setSelectedRegistrations(new Set());
      setIsSelectAllChecked(false);
    } else {
      const allIds = new Set(filteredRegistrations.map(r => r.id));
      setSelectedRegistrations(allIds);
      setIsSelectAllChecked(true);
    }
  };

  const handleSelectRegistration = (registrationId: string) => {
    setSelectedRegistrations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(registrationId)) {
        newSet.delete(registrationId);
      } else {
        newSet.add(registrationId);
      }
      return newSet;
    });
  };

  // Update select-all checkbox state when filtered registrations change
  useEffect(() => {
    if (selectedRegistrations.size === 0) {
      setIsSelectAllChecked(false);
    } else if (filteredRegistrations.length > 0 && selectedRegistrations.size === filteredRegistrations.length) {
      const allSelected = filteredRegistrations.every(r => selectedRegistrations.has(r.id));
      setIsSelectAllChecked(allSelected);
    } else {
      setIsSelectAllChecked(false);
    }
  }, [selectedRegistrations, filteredRegistrations]);

  // Bulk approve registrations
  const handleBulkApproveRegistrations = async () => {
    const selectedRegs = registrations.filter(r => selectedRegistrations.has(r.id));
    const pendingRegs = selectedRegs.filter(r => r.status === 'pending');
    
    if (pendingRegs.length === 0) {
      alert('No pending registrations selected. Please select registrations with pending status.');
      return;
    }

    if (!window.confirm(
      `Are you sure you want to approve ${pendingRegs.length} registration(s)?\n\n` +
      `This will change their status to "approved".`
    )) {
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const reg of pendingRegs) {
      try {
        await RegistrationService.updateRegistrationStatus(reg.id, 'approved');
        successCount++;
      } catch (error) {
        console.error(`Failed to approve registration ${reg.id}:`, error);
        failCount++;
      }
    }

    // Update local state
    setRegistrations(prev =>
      prev.map(reg =>
        pendingRegs.some(pr => pr.id === reg.id)
          ? { ...reg, status: 'approved' as const }
          : reg
      )
    );

    setIsBulkProcessing(false);
    setSelectedRegistrations(new Set());
    
    alert(
      `Bulk Approve Complete!\n\n` +
      `✓ Successfully approved: ${successCount}\n` +
      (failCount > 0 ? `✗ Failed: ${failCount}` : '')
    );
  };

  // Bulk approve payments
  const handleBulkApprovePayments = async () => {
    const selectedRegs = registrations.filter(r => selectedRegistrations.has(r.id));
    const pendingPayments = selectedRegs.filter(r => 
      r.paymentProof && 
      r.paymentProof.verificationStatus === 'pending'
    );
    
    if (pendingPayments.length === 0) {
      alert('No pending payments selected. Please select registrations with pending payment proofs.');
      return;
    }

    if (!window.confirm(
      `Are you sure you want to approve ${pendingPayments.length} payment(s)?\n\n` +
      `This will mark their payment status as "paid" and verification as "approved".`
    )) {
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;
    const verifierUid = userProfile?.uid || 'system';
    const verifierName = (userProfile as any)?.displayName || (userProfile as any)?.email || 'Admin';

    for (const reg of pendingPayments) {
      try {
        if (reg.paymentProof) {
          await PaymentService.verifyPaymentProof(reg.paymentProof.id, 'approved', verifierUid, verifierName);
          successCount++;
        }
      } catch (error) {
        console.error(`Failed to approve payment for registration ${reg.id}:`, error);
        failCount++;
      }
    }

    // Update local state
    setRegistrations(prev =>
      prev.map(reg => {
        if (pendingPayments.some(pr => pr.id === reg.id)) {
          return {
            ...reg,
            paymentStatus: 'paid' as const,
            paymentProof: reg.paymentProof ? {
              ...reg.paymentProof,
              verificationStatus: 'approved' as const,
              verifiedAt: new Date().toISOString(),
              verifiedBy: verifierName
            } : reg.paymentProof
          };
        }
        return reg;
      })
    );

    setIsBulkProcessing(false);
    setSelectedRegistrations(new Set());
    
    alert(
      `Bulk Payment Approve Complete!\n\n` +
      `✓ Successfully approved: ${successCount}\n` +
      (failCount > 0 ? `✗ Failed: ${failCount}` : '')
    );
  };

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-secondary-100 text-secondary-800';
      case 'medium':
        return 'bg-accent-100 text-accent-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <LayoutComponent title="Attendees" subtitle="Loading attendee registrations...">
        <div className="animate-pulse space-y-6">
          <div className="h-20 bg-gray-200 rounded-xl"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </LayoutComponent>
    );
  }

  const headerActions = (
    <div className="flex items-center space-x-3">
      {selectedRegistrations.size > 0 && (
        <>
          <button 
            onClick={handleBulkApproveRegistrations}
            disabled={isBulkProcessing}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircleIcon className="w-4 h-4 mr-2" />
            {isBulkProcessing ? 'Processing...' : `Approve Registrations (${selectedRegistrations.size})`}
          </button>
          <button 
            onClick={handleBulkApprovePayments}
            disabled={isBulkProcessing}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CurrencyDollarIcon className="w-4 h-4 mr-2" />
            {isBulkProcessing ? 'Processing...' : `Approve Payments (${selectedRegistrations.size})`}
          </button>
        </>
      )}
      <button 
        onClick={exportToCSV}
        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <FunnelIcon className="w-4 h-4 mr-2" />
        Export Data
      </button>
    </div>
  );

  return (
    <LayoutComponent 
      title={currentEvent ? `${currentEvent.title} - Attendees` : "Attendee Management"} 
      subtitle={currentEvent 
        ? `Manage registrations and payments for ${currentEvent.title}`
        : "Review and manage event registrations and payments efficiently."
      }
      actions={headerActions}
    >
      <div className="space-y-6">


        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <ClockIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredRegistrations.filter(r => r.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredRegistrations.filter(r => r.status === 'approved').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredRegistrations.filter(r => r.paymentStatus === 'paid').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Walk-In</p>
                <p className="text-2xl font-bold text-gray-900">
                  {filteredRegistrations.filter(r => (r as any).registrationType === 'walk-in').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{filteredRegistrations.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          {/* Search Bar - Full Width */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search attendees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
              />
            </div>
          </div>

          {/* Filters Grid - Responsive */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap gap-3 flex-1">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px] flex-shrink-0"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
                <option value="attended">Attended</option>
              </select>

              {/* Event Filter or Badge */}
              {!eventId ? (
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[180px] max-w-[280px] flex-shrink-0"
                >
                  <option value="all">All Events</option>
                  {events.map(event => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              ) : (
                currentEvent && (
                  <div className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg border border-blue-200 text-sm font-medium whitespace-nowrap flex-shrink-0">
                    📅 {currentEvent.title}
                  </div>
                )
              )}

              {/* Ticket Type Filter */}
              {availableTicketTypes.length > 0 && (
                <select
                  value={ticketTypeFilter}
                  onChange={(e) => setTicketTypeFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px] max-w-[240px] flex-shrink-0"
                >
                  <option value="all">All Ticket Types</option>
                  {availableTicketTypes.map(tt => (
                    <option key={tt.id} value={tt.id}>
                      {tt.name} (₱{tt.price.toLocaleString()})
                    </option>
                  ))}
                </select>
              )}

              {/* Price Range Filter */}
              <select
                value={priceRangeFilter}
                onChange={(e) => setPriceRangeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px] flex-shrink-0"
              >
                <option value="all">All Prices</option>
                <option value="free">Free</option>
                <option value="under-500">Under ₱500</option>
                <option value="500-1000">₱500 - ₱1K</option>
                <option value="1000-2000">₱1K - ₱2K</option>
                <option value="above-2000">Above ₱2K</option>
              </select>

              {/* Registration Type Filter */}
              <select
                value={registrationTypeFilter}
                onChange={(e) => setRegistrationTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px] flex-shrink-0"
              >
                <option value="all">All Types</option>
                <option value="online">🌐 Online</option>
                <option value="walk-in">🚶 Walk-In</option>
              </select>
            </div>

            {/* Results Count */}
            <div className="text-sm text-gray-600 font-medium whitespace-nowrap px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              {filteredRegistrations.length} result{filteredRegistrations.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl border border-gray-200 p-2">
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('management')}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                viewMode === 'management'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <UserGroupIcon className="h-5 w-5" />
                <span>Registration Management</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode('details')}
              className={`flex-1 px-6 py-3 rounded-lg font-medium transition-colors ${
                viewMode === 'details'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <DocumentTextIcon className="h-5 w-5" />
                <span>Details Management</span>
              </div>
            </button>
          </div>
        </div>

        {/* Bulk Selection Toolbar */}
        {filteredRegistrations.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelectAllChecked}
                    onChange={handleSelectAll}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Select All ({filteredRegistrations.length})
                  </span>
                </label>
                {selectedRegistrations.size > 0 && (
                  <span className="text-sm text-gray-600">
                    {selectedRegistrations.size} selected
                  </span>
                )}
              </div>
              <div className="text-sm text-gray-500">
                Showing {filteredRegistrations.length} of {registrations.length} registrations
              </div>
            </div>
          </div>
        )}

        {/* Registration Management View */}
        {viewMode === 'management' && (
        <div className="dashboard-card">
          {filteredRegistrations.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No registrations found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== 'all' || eventFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Attendee registrations will appear here once people start signing up for events.'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRegistrations.map((registration) => (
                <div key={registration.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">

                    {/* Checkbox */}
                    <div className="flex-shrink-0 pt-1">
                      <input
                        type="checkbox"
                        checked={selectedRegistrations.has(registration.id)}
                        onChange={() => handleSelectRegistration(registration.id)}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
                        <div className="flex items-center space-x-1 flex-wrap">
                          {getStatusIcon(registration.status)}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(registration.status)}`}>
                            {registration.status}
                          </span>
                          {registration.paymentStatus && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              registration.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                              registration.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              Payment: {registration.paymentStatus}
                            </span>
                          )}
                          {registration.paymentStatus === 'pending' && registration.paymentProof && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                              📄 Proof Submitted
                            </span>
                          )}
                          {/* Registration Type Badge */}
                          {(registration as any).registrationType === 'walk-in' && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 flex items-center space-x-1">
                              <span>🚶</span>
                              <span>Walk-In</span>
                            </span>
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
                  </div>

                  {/* Action Button - Only View Details */}
                  <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleViewRegistration(registration)}
                      className="btn-outline text-sm px-4 py-2"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Details Management View */}
        {viewMode === 'details' && (
          <div className="dashboard-card">
            {filteredRegistrations.length === 0 ? (
              <div className="text-center py-12">
                <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No registrations found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || statusFilter !== 'all' || eventFilter !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Attendee registrations will appear here once people start signing up for events.'
                  }
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <input
                          type="checkbox"
                          checked={isSelectAllChecked}
                          onChange={handleSelectAll}
                          className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Attendee Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Organization
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Event
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRegistrations.map((registration) => {
                      const isEditing = editingAttendee === registration.id;
                      
                      return (
                        <tr key={registration.id} className={isEditing ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedRegistrations.has(registration.id)}
                              onChange={() => handleSelectRegistration(registration.id)}
                              className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingDetails?.name || ''}
                                onChange={(e) => setEditingDetails(prev => prev ? { ...prev, name: e.target.value } : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Full Name"
                              />
                            ) : (
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10">
                                  <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                    <UserIcon className="h-5 w-5 text-gray-600" />
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{registration.attendee.name}</div>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="email"
                                value={editingDetails?.email || ''}
                                onChange={(e) => setEditingDetails(prev => prev ? { ...prev, email: e.target.value } : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="email@example.com"
                              />
                            ) : (
                              <div className="text-sm text-gray-900">{registration.attendee.email}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="tel"
                                value={editingDetails?.phone || ''}
                                onChange={(e) => setEditingDetails(prev => prev ? { ...prev, phone: e.target.value } : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Phone Number"
                              />
                            ) : (
                              <div className="text-sm text-gray-900">{registration.attendee.phone || '-'}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingDetails?.organization || ''}
                                onChange={(e) => setEditingDetails(prev => prev ? { ...prev, organization: e.target.value } : null)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Organization"
                              />
                            ) : (
                              <div className="text-sm text-gray-900">{registration.attendee.organization || '-'}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{registration.event.title}</div>
                            <div className="text-xs text-gray-500">{formatDate(registration.event.date)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            {isEditing ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleSaveAttendeeDetails(registration.id)}
                                  disabled={savingDetails}
                                  className="inline-flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                  {savingDetails ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                      Saving...
                                    </>
                                  ) : (
                                    <>
                                      <CheckIcon className="h-4 w-4 mr-1" />
                                      Save
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={handleCancelEditingDetails}
                                  disabled={savingDetails}
                                  className="inline-flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                                >
                                  <XMarkIcon className="h-4 w-4 mr-1" />
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleStartEditingDetails(registration)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                Edit Details
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Registration Details Modal */}
        {viewingRegistration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col mx-4">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Registration Details
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {viewingRegistration.attendee.name} • {viewingRegistration.event.title}
                  </p>
                </div>
                <button
                  onClick={() => setViewingRegistration(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-8">
                  {/* Status Overview */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(viewingRegistration.status)}
                          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(viewingRegistration.status)}`}>
                            {viewingRegistration.status.charAt(0).toUpperCase() + viewingRegistration.status.slice(1)}
                          </span>
                        </div>
                        {viewingRegistration.paymentStatus && (
                          <div className="flex items-center space-x-2">
                            <CurrencyDollarIcon className="h-5 w-5 text-gray-500" />
                            <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                              viewingRegistration.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                              viewingRegistration.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              Payment: {viewingRegistration.paymentStatus.charAt(0).toUpperCase() + viewingRegistration.paymentStatus.slice(1)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          ₱{viewingRegistration.event.ticketPrice.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Ticket Price</div>
                      </div>
                    </div>
                  </div>

                  {/* Main Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Attendee Information */}
                    <div className="lg:col-span-1">
                      <div className="bg-white border border-gray-200 rounded-lg p-5">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <UserIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">Attendee</h3>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Name</label>
                            <p className="text-gray-900 font-medium">{viewingRegistration.attendee.name}</p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-700">Email</label>
                            <p className="text-gray-900">{viewingRegistration.attendee.email}</p>
                          </div>
                          
                          {viewingRegistration.attendee.phone && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Phone</label>
                              <p className="text-gray-900">{viewingRegistration.attendee.phone}</p>
                            </div>
                          )}
                          
                          {viewingRegistration.attendee.organization && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Organization</label>
                              <p className="text-gray-900">{viewingRegistration.attendee.organization}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Event Information */}
                    <div className="lg:col-span-1">
                      <div className="bg-white border border-gray-200 rounded-lg p-5">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <CalendarDaysIcon className="h-5 w-5 text-green-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">Event</h3>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <label className="text-sm font-medium text-gray-700">Title</label>
                            <p className="text-gray-900 font-medium">{viewingRegistration.event.title}</p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-700">Date & Time</label>
                            <p className="text-gray-900">{formatDate(viewingRegistration.event.date)}</p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-700">Venue</label>
                            <p className="text-gray-900">{viewingRegistration.event.venue}</p>
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-700">Registration Date</label>
                            <p className="text-gray-900">{formatDate(viewingRegistration.registrationDate)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="lg:col-span-1">
                      <div className="bg-white border border-gray-200 rounded-lg p-5">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="p-2 bg-yellow-100 rounded-lg">
                            <CurrencyDollarIcon className="h-5 w-5 text-yellow-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">Pricing</h3>
                        </div>

                        <div className="space-y-4">
                          {(viewingRegistration.promoCode || viewingRegistration.pricing?.promoCode) && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <label className="text-sm font-medium text-green-700">🎫 Promo Code Applied</label>
                              <p className="text-green-900 font-mono text-sm font-semibold">
                                {viewingRegistration.promoCode || 
                                 (typeof viewingRegistration.pricing?.promoCode === 'string' 
                                   ? viewingRegistration.pricing?.promoCode 
                                   : viewingRegistration.pricing?.promoCode?.code)}
                              </p>
                            </div>
                          )}

                          {typeof viewingRegistration.quantity === 'number' && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Quantity</label>
                              <p className="text-gray-900">{viewingRegistration.quantity}</p>
                            </div>
                          )}

                          {typeof viewingRegistration.pricing?.originalPrice === 'number' && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Original Price</label>
                              <p className="text-gray-900">₱{(viewingRegistration.pricing?.originalPrice || 0).toLocaleString()}</p>
                            </div>
                          )}

                          {(typeof viewingRegistration.pricing?.discountAmount === 'number' || typeof viewingRegistration.discountAmount === 'number') && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Discount</label>
                              <p className="text-green-600">-₱{(viewingRegistration.pricing?.discountAmount ?? viewingRegistration.discountAmount ?? 0).toLocaleString()}</p>
                            </div>
                          )}

                          {typeof viewingRegistration.pricing?.currentPrice === 'number' && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Discounted Price</label>
                              <p className="text-gray-900">₱{(viewingRegistration.pricing?.currentPrice || 0).toLocaleString()}</p>
                            </div>
                          )}

                          {(typeof viewingRegistration.totalAmount === 'number') && (
                            <div className="pt-2 border-t border-gray-100">
                              <label className="text-sm font-medium text-gray-700">Total Amount</label>
                              <p className="text-gray-900 font-semibold">₱{(viewingRegistration.totalAmount || 0).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Ticket Information */}
                    <div className="lg:col-span-1">
                      <div className="bg-white border border-gray-200 rounded-lg p-5">
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="p-2 bg-indigo-100 rounded-lg">
                            <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900">Ticket Details</h3>
                        </div>
                        
                        <div className="space-y-4">
                          {(() => {
                            const ticketTypeId = viewingRegistration.ticketTypeId;
                            const event = events.find(e => e.id === viewingRegistration.event.id);
                            const ticketType = event?.ticketTypes?.find(tt => tt.id === ticketTypeId);
                            
                            return ticketType ? (
                              <>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Ticket Type</label>
                                  <p className="text-gray-900 font-medium">{ticketType.name}</p>
                                </div>
                                {ticketType.description && (
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Description</label>
                                    <p className="text-gray-900 text-sm">{ticketType.description}</p>
                                  </div>
                                )}
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Base Price</label>
                                  <p className="text-gray-900">₱{ticketType.price.toLocaleString()}</p>
                                </div>
                                {ticketType.benefits && ticketType.benefits.length > 0 && (
                                  <div>
                                    <label className="text-sm font-medium text-gray-700">Benefits</label>
                                    <ul className="mt-1 space-y-1">
                                      {ticketType.benefits.map((benefit, idx) => (
                                        <li key={idx} className="text-gray-900 text-sm flex items-start">
                                          <CheckIcon className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                          <span>{benefit}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="text-sm text-gray-500">
                                Ticket type information not available
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Payment Proof */}
                    {(viewingRegistration.paymentProof || loadingProof) && (
                      <div className="lg:col-span-1">
                        <div className="bg-white border border-gray-200 rounded-lg p-5">
                          <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <DocumentTextIcon className="h-5 w-5 text-purple-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Payment Proof</h3>
                          </div>
                          
                          <div className="space-y-4">
                            {loadingProof && !viewingRegistration.paymentProof && (
                              <div className="text-sm text-gray-500">Loading payment proof...</div>
                            )}
                            <div>
                              <label className="text-sm font-medium text-gray-700">Status</label>
                              {viewingRegistration.paymentProof && (
                                <div className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                                  viewingRegistration.paymentProof.verificationStatus === 'approved' 
                                    ? 'bg-green-100 text-green-800'
                                    : viewingRegistration.paymentProof.verificationStatus === 'rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {viewingRegistration.paymentProof.verificationStatus.charAt(0).toUpperCase() + viewingRegistration.paymentProof.verificationStatus.slice(1)}
                                </div>
                              )}
                            </div>

                            {(viewingRegistration.promoCode || viewingRegistration.pricing?.promoCode) && (
                              <div>
                                <label className="text-sm font-medium text-gray-700">Promo Code Used</label>
                                <p className="text-gray-900 font-mono text-sm bg-blue-50 px-2 py-1 rounded">
                                  {viewingRegistration.promoCode || 
                                   (typeof viewingRegistration.pricing?.promoCode === 'string' 
                                     ? viewingRegistration.pricing?.promoCode 
                                     : viewingRegistration.pricing?.promoCode?.code)}
                                </p>
                              </div>
                            )}
                            
                            {viewingRegistration.paymentProof?.transactionId && (
                              <div>
                                <label className="text-sm font-medium text-gray-700">Transaction ID</label>
                                <p className="text-gray-900 font-mono text-sm">{viewingRegistration.paymentProof.transactionId}</p>
                              </div>
                            )}
                            
                            {viewingRegistration.paymentProof && (
                            <div>
                              <label className="text-sm font-medium text-gray-700">Submitted</label>
                              <p className="text-gray-900">{formatDate(viewingRegistration.paymentProof.submittedAt)}</p>
                            </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Payment Screenshot */}
                  {viewingRegistration.paymentProof?.proofImageUrl && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <EyeIcon className="h-5 w-5 text-orange-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Payment Screenshot</h3>
                      </div>
                      
                      <div className="flex justify-center">
                        {(() => {
                          const cacheKey = viewingRegistration.id + '_proof';
                          const isLoading = imageLoadingStates[cacheKey];
                          const convertedUrl = convertedImageUrls[cacheKey];
                          const originalUrl = viewingRegistration.paymentProof!.proofImageUrl!;
                          const imageUrl = convertedUrl || originalUrl;
                          
                          // Show loading if we're currently converting
                          if (isLoading === true) {
                            return (
                              <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-3"></div>
                                <p className="text-sm">Loading payment proof image...</p>
                              </div>
                            );
                          }
                          
                          // If it's a storage path and we haven't tried converting yet, show a message
                          if (!originalUrl.startsWith('https://') && isLoading === undefined && !convertedUrl) {
                            return (
                              <div className="flex flex-col items-center justify-center p-8 text-gray-500">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mb-3"></div>
                                <p className="text-sm">Processing payment proof image...</p>
                              </div>
                            );
                          }
                          
                          return (
                            <div className="relative group cursor-pointer" onClick={() => window.open(imageUrl, '_blank')}>
                              <img 
                                src={imageUrl} 
                                alt="Payment proof"
                                className="max-w-full h-auto max-h-96 rounded-lg border border-gray-200 transition-transform group-hover:scale-105"
                                onError={(e) => {
                                  console.error('Failed to load payment proof image:', imageUrl);
                                  // Show error message instead of trying to fallback
                                  const errorDiv = document.createElement('div');
                                  errorDiv.className = 'flex flex-col items-center justify-center p-8 text-red-500 border-2 border-dashed border-red-300 rounded-lg';
                                  errorDiv.innerHTML = `
                                    <div class="text-red-500 mb-2">⚠️</div>
                                    <p class="text-sm text-center">Failed to load payment proof image</p>
                                    <p class="text-xs text-gray-500 mt-1">Path: ${originalUrl}</p>
                                  `;
                                  e.currentTarget.parentNode?.replaceChild(errorDiv, e.currentTarget);
                                }}
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-0 transition-all rounded-lg flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white bg-opacity-95 px-4 py-2 rounded-lg text-sm font-medium shadow-lg">
                                  <EyeIcon className="h-4 w-4 inline mr-2" />
                                  Click to enlarge
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Registration Form Responses */}
                  {viewingRegistration.formSubmission && Object.keys(viewingRegistration.formSubmission).length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-teal-100 rounded-lg">
                          <DocumentTextIcon className="h-5 w-5 text-teal-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Registration Form Responses</h3>
                      </div>
                      
                      <div className="space-y-4">
                        {Object.entries(viewingRegistration.formSubmission).map(([fieldId, value]) => {
                          // Get the event and its registration form to find field details
                          const event = events.find(e => e.id === viewingRegistration.event.id);
                          const formField = (event as any)?.registrationForm?.find((f: any) => f.id === fieldId);
                          const label = formField?.label || fieldId;
                          
                          // Format the value based on type
                          let displayValue: string | React.ReactNode = '';
                          
                          if (value === null || value === undefined || value === '') {
                            displayValue = <span className="text-gray-400 italic">No response</span>;
                          } else if (Array.isArray(value)) {
                            displayValue = value.length > 0 
                              ? value.join(', ') 
                              : <span className="text-gray-400 italic">No items selected</span>;
                          } else if (typeof value === 'boolean') {
                            displayValue = value ? 'Yes' : 'No';
                          } else if (typeof value === 'object' && value.name && value.phone) {
                            // Emergency contact format
                            displayValue = `${value.name} - ${value.phone}`;
                          } else {
                            displayValue = String(value);
                          }
                          
                          return (
                            <div key={fieldId} className="border-b border-gray-100 pb-3 last:border-0">
                              <label className="text-sm font-medium text-gray-700 block mb-1">
                                {label}
                              </label>
                              <div className="text-gray-900">
                                {displayValue}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {viewingRegistration.notes && (
                    <div className="bg-white border border-gray-200 rounded-lg p-5">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                          <ChatBubbleLeftRightIcon className="h-5 w-5 text-yellow-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">Notes</h3>
                      </div>
                      <p className="text-gray-700">{viewingRegistration.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="border-t border-gray-200 bg-gray-50 p-6">
                <div className="flex flex-wrap gap-3 justify-between">
                  <div className="flex flex-wrap gap-3">
                    {/* Primary Actions */}
                    {viewingRegistration.status === 'pending' && (
                      <button
                        onClick={async () => {
                          // Approve registration and payment if proof exists
                          await handleStatusChange(viewingRegistration.id, 'approved');
                          if (viewingRegistration.paymentProof && viewingRegistration.paymentProof.verificationStatus === 'pending') {
                            await handlePaymentVerification(viewingRegistration.id, 'approved');
                          }
                          setViewingRegistration(null);
                        }}
                        className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                      >
                        <CheckIcon className="h-5 w-5 mr-2" />
                        Approve Registration & Payment
                      </button>
                    )}
                    
                    {/* Payment-only Actions (when registration is already approved) */}
                    {viewingRegistration.status === 'approved' && viewingRegistration.paymentProof && viewingRegistration.paymentProof.verificationStatus === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            handlePaymentVerification(viewingRegistration.id, 'approved');
                            setViewingRegistration(null);
                          }}
                          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          <CheckIcon className="h-5 w-5 mr-2" />
                          Approve Payment
                        </button>
                        <button
                          onClick={() => {
                            handlePaymentVerification(viewingRegistration.id, 'rejected');
                            setViewingRegistration(null);
                          }}
                          className="inline-flex items-center px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                        >
                          <XMarkIcon className="h-5 w-5 mr-2" />
                          Reject Payment
                        </button>
                      </>
                    )}
                    

                    
                    {/* Reject/Cancel Action - for any non-approved status */}
                    {viewingRegistration.status !== 'rejected' && viewingRegistration.status !== 'cancelled' && (
                      <button
                        onClick={() => {
                          handleStatusChange(viewingRegistration.id, 'rejected');
                          setViewingRegistration(null);
                        }}
                        className="inline-flex items-center px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                      >
                        <XMarkIcon className="h-5 w-5 mr-2" />
                        Reject Registration
                      </button>
                    )}
                    
                    <button
                      onClick={() => setViewingRegistration(null)}
                      className="inline-flex items-center px-6 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      Close
                    </button>
                  </div>

                  {/* Delete Action - Separated on the right */}
                  <button
                    onClick={async () => {
                      if (window.confirm(
                        `Are you sure you want to permanently delete this registration?\n\n` +
                        `Attendee: ${viewingRegistration.attendee.name}\n` +
                        `Event: ${viewingRegistration.event.title}\n\n` +
                        `This will delete:\n` +
                        `• The registration record\n` +
                        `• All associated payment proofs\n` +
                        `• Payment proof images from storage\n\n` +
                        `This action cannot be undone!`
                      )) {
                        try {
                          // Delete registration and all associated data
                          await RegistrationService.deleteRegistration(viewingRegistration.id);
                          
                          // Remove from local state
                          setRegistrations(prev => prev.filter(r => r.id !== viewingRegistration.id));
                          
                          // Close modal
                          setViewingRegistration(null);
                          
                          // Show success message
                          alert('Registration deleted successfully');
                        } catch (error) {
                          console.error('Failed to delete registration:', error);
                          alert('Failed to delete registration. Please try again.');
                        }
                      }
                    }}
                    className="inline-flex items-center px-6 py-3 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors shadow-sm"
                  >
                    <XMarkIcon className="h-5 w-5 mr-2" />
                    Delete Registration
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </LayoutComponent>
  );
};

export default AdminAttendeesPage;
