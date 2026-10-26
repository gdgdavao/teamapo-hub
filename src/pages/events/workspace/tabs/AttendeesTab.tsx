import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  UserGroupIcon,
  CameraIcon,
  TicketIcon,
  TagIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/20/solid';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db } from '../../../../config/firebase';
import { Badge, Button, EmptyState, Modal, Select, SkeletonList } from '../../../../components/UI';
import { useAbility } from '@casl/react';
import { asRegistration, asPaymentProof } from '../../../../auth/ability';
import { useAuth } from '../../../../contexts/AuthContext';
import { RegistrationService } from '../../../../services/registrationService';
import { EventService } from '../../../../services/eventService';
import { PaymentService } from '../../../../services/paymentService';
import { EmailService } from '../../../../services/emailService';
import { Registration as FirestoreRegistration, Event } from '../../../../types';
import { logger } from '../../../../utils/logger';
import { resolveDisplayStatus, DisplayStatus } from '../../../../utils/registrationStatus';
import {
  getRegistrationQuantity,
  getRegistrationTotalAmount,
} from '../../../../utils/pricing';
import { toISOStringSafe, formatDateTime as formatDate } from '../../../../utils/dateUtils';
import RegistrationDetailsModal, { AttendeeRegistration } from './RegistrationDetailsModal';

/** Options for the status filter, in display order. Drives both the <select>
 *  and the ?status= deep-link validation so the two can never drift. */
const STATUS_FILTER_OPTIONS: Array<{ value: DisplayStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Needs Review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'attended', label: 'Checked In' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'rejected', label: 'Rejected' },
];

const isValidStatusFilter = (value: string | null): value is DisplayStatus =>
  STATUS_FILTER_OPTIONS.some((opt) => opt.value === value);

type Registration = AttendeeRegistration;

interface AttendeesTabProps {
  /** Required. The tab renders inside /events/:eventId, and resolving the id
   *  here rather than from the route keeps the panel renderable in isolation. */
  eventId: string;
}

const AttendeesTab: React.FC<AttendeesTabProps> = ({ eventId }) => {
  const { userProfile } = useAuth();
  const ability = useAbility();
  const [searchParams] = useSearchParams();
  // Lets the dashboard deep-link straight into a review queue, e.g.
  // /attendees?status=pending. The value is validated against the same option
  // list the <select> renders so a hand-edited URL can't inject a filter that
  // silently matches nothing.
  const statusParam = searchParams.get('status');
  
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(
    isValidStatusFilter(statusParam) ? statusParam : 'all'
  );
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [ticketTypeFilter, setTicketTypeFilter] = useState<string>('all');
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>('all');
  const [registrationTypeFilter, setRegistrationTypeFilter] = useState<string>('all');
  // Payment-proof state is a different axis from registration display status:
  // resolveDisplayStatus returns 'approved' for an organizer-approved
  // registration whose proof is still pending, so no DisplayStatus can surface
  // the verification queue. This filter is deliberately orthogonal and default
  // off, which leaves countPendingRegistrations' contract with the dashboard
  // untouched.
  const [awaitingVerificationOnly, setAwaitingVerificationOnly] = useState(false);
  const [viewingRegistration, setViewingRegistration] = useState<Registration | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  
  // Bulk selection state
  const [selectedRegistrations, setSelectedRegistrations] = useState<Set<string>>(new Set());
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isBulkTransferModalOpen, setIsBulkTransferModalOpen] = useState(false);
  const [bulkTargetTicketTypeId, setBulkTargetTicketTypeId] = useState('');

  // Re-sync when the URL changes underneath us. Without this, arriving from a
  // dashboard CTA while already on /attendees would keep the old filter and
  // quietly show the wrong queue. The <select> is the source of truth once the
  // user touches it, so an absent/invalid param resets to 'all' rather than
  // overwriting their choice with a stale URL.
  useEffect(() => {
    setStatusFilter(isValidStatusFilter(statusParam) ? statusParam : 'all');
  }, [statusParam]);

  const getTicketTypeName = useCallback((registration: Registration): string => {
    const matchingEvent = events.find(event => event.id === registration.event.id);
    const ticketType = matchingEvent?.ticketTypes?.find(tt => tt.id === registration.ticketTypeId);
    if (ticketType?.name) {
      return ticketType.name;
    }
    if (typeof registration.pricing?.ticketTypeName === 'string' && registration.pricing.ticketTypeName.trim().length > 0) {
      return registration.pricing.ticketTypeName;
    }
    return registration.ticketTypeId || DEFAULT_TICKET_TYPE_LABEL;
  }, [events]);


const getRegistrationPromoCode = (registration: Registration): string | undefined => {
  if (registration.promoCode) {
    return registration.promoCode;
  }
  const pricingPromo = registration.pricing?.promoCode;
  if (!pricingPromo) {
    return undefined;
  }
  if (typeof pricingPromo === 'string') {
    return pricingPromo;
  }
  return pricingPromo?.code;
};

const formatCurrency = (amount?: number): string => {
  const value = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `₱${value.toLocaleString()}`;
};

const DEFAULT_TICKET_TYPE_LABEL = 'General Admission';

  // Load registrations for this event
  useEffect(() => {
    const fetchRegistrations = async () => {
      if (!userProfile?.uid || !eventId) return;
      
      try {
        setLoading(true);
        
        const [eventData, firestoreRegistrations] = await Promise.all([
          EventService.getEvent(eventId),
          RegistrationService.getEventRegistrations(eventId)
        ]);

        let formFields = eventData?.registrationForm || [];
        if (!formFields.length) {
          formFields = await EventService.getEventRegistrationForm(eventId).catch(() => []);
        }
        
        const enrichedEvent = eventData
          ? {
              ...eventData,
              registrationForm: formFields
            }
          : null;

        if (enrichedEvent) {
          setCurrentEvent(enrichedEvent);
          setEvents([enrichedEvent]);
        }
        
        // Transform data to match expected interface
        const transformedRegistrations: Registration[] = [];
        
        for (const reg of firestoreRegistrations) {
          const event = enrichedEvent;
          if (!event) continue;
          
          const seatQuantity = (() => {
            const rawQuantity = (reg as any).quantity;
            if (typeof rawQuantity === 'number' && rawQuantity > 0) {
              return rawQuantity;
            }
            const fallbackQuantity = (reg as any).ticketQuantity;
            if (typeof fallbackQuantity === 'number' && fallbackQuantity > 0) {
              return fallbackQuantity;
            }
            return 1;
          })();

          // Map PaymentStatus to expected format
          const mapPaymentStatus = (status: any): Registration['paymentStatus'] => {
            if (status === 'paid') return 'paid';
            if (status === 'pending' || status === 'processing') return 'pending';
            if (status === 'failed') return 'failed';
            if (status === 'refunded') return 'refunded';
            return 'pending'; // Default for any other status including 'cancelled'
          };

          const phoneFromCustom = (!reg.userDetails.phoneNumber && (reg as any).customResponses)
            ? Object.entries((reg as any).customResponses).find(([k, v]) => {
                if (!v || typeof v !== 'string') return false;
                const formField = event.registrationForm?.find(f => f.id === k);
                const label = formField ? formField.label.toLowerCase() : k.toLowerCase();
                const fieldType = formField?.type;
                return (
                  fieldType === 'phone' ||
                  k === '3' ||
                  k.toLowerCase().includes('phone') ||
                  k.toLowerCase().includes('mobile') ||
                  k.toLowerCase().includes('contact') ||
                  label.includes('phone') ||
                  label.includes('mobile') ||
                  label.includes('contact')
                );
              })?.[1]
            : undefined;

          const orgFromCustom = (!reg.userDetails.organization && (reg as any).customResponses)
            ? Object.entries((reg as any).customResponses).find(([k, v]) => {
                if (!v || typeof v !== 'string') return false;
                const formField = event.registrationForm?.find(f => f.id === k);
                const label = formField ? formField.label.toLowerCase() : k.toLowerCase();
                return (
                  k.toLowerCase().includes('organization') ||
                  k.toLowerCase().includes('company') ||
                  k.toLowerCase().includes('school') ||
                  k.toLowerCase().includes('university') ||
                  k.toLowerCase().includes('affiliation') ||
                  label.includes('organization') ||
                  label.includes('company') ||
                  label.includes('school') ||
                  label.includes('university') ||
                  label.includes('affiliation')
                );
              })?.[1]
            : undefined;

          const nameFromCustom = (!reg.userDetails.name || reg.userDetails.name === 'Anonymous Attendee') && (reg as any).customResponses
            ? (() => {
                const responses = (reg as any).customResponses as Record<string, any>;
                const fullNameField = event.registrationForm?.find(f => {
                  const l = f.label.toLowerCase();
                  return l.includes('full name') || l === 'name';
                });
                if (fullNameField && responses[fullNameField.id]) {
                  return String(responses[fullNameField.id]).trim();
                }
                const first = responses['1'] || responses['first_name'] || responses['firstName'];
                const last = responses['1762143123275'] || responses['last_name'] || responses['lastName'];
                if (first || last) {
                  return `${first || ''} ${last || ''}`.trim();
                }
                return undefined;
              })()
            : undefined;

          const transformedReg: Registration = {
            id: reg.id,
            attendee: {
              id: reg.userId || reg.id,
              name: reg.userDetails.name || nameFromCustom || 'Anonymous Attendee',
              email: reg.userDetails.email,
              phone: reg.userDetails.phoneNumber || (typeof phoneFromCustom === 'string' ? phoneFromCustom : undefined),
              organization: reg.userDetails.organization || (typeof orgFromCustom === 'string' ? orgFromCustom : undefined),
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
              ticketPrice: (reg as any).pricing?.currentPrice || (reg.totalAmount && seatQuantity ? (reg.totalAmount / seatQuantity) : 0)
            },
            status: resolveDisplayStatus(reg),
            registrationDate: toISOStringSafe(reg.registrationDate),
            paymentStatus: mapPaymentStatus(reg.paymentStatus),
            paymentProof: reg.paymentProof ? {
              id: reg.paymentProof.id,
              registrationId: reg.paymentProof.registrationId,
              proofImageUrl: reg.paymentProof.proofImageUrl,
              transactionId: reg.paymentProof.transactionId,
              submittedAt: toISOStringSafe(reg.paymentProof.submittedAt),
              verificationStatus: reg.paymentProof.verificationStatus,
              verifiedAt: reg.paymentProof.verifiedAt ? toISOStringSafe(reg.paymentProof.verifiedAt) : undefined,
              verifiedBy: reg.paymentProof.verifiedBy,
              notes: reg.paymentProof.notes
            } : undefined,
            notes: (reg as any).adminNotes || undefined,
            requirements: undefined,
            formSubmission: (reg as any).customResponses || undefined,
            priority: 'medium', // Default priority
            promoCode: (reg as any).promoCode || undefined,
            quantity: seatQuantity,
            originalAmount: (reg as any).originalAmount,
            discountAmount: (reg as any).discountAmount,
            totalAmount: (reg as any).totalAmount,
            currency: (reg as any).currency,
            ticketTypeId: (reg as any).ticketTypeId || undefined,
            pricing: (reg as any).pricing,
            registrationType: (reg as any).registrationType || 'online'
          };
          
          transformedRegistrations.push(transformedReg);
        }
        
        setRegistrations(transformedRegistrations);
        setLoading(false);
      } catch (error) {
        logger.error('Error fetching registrations:', error);
        setRegistrations([]);
        setCurrentEvent(null);
        setEvents([]);
        setLoading(false);
      }
    };

    fetchRegistrations();
  }, [userProfile?.uid, eventId]);

  // When opening the details modal, fetch latest payment proof if not already present
  useEffect(() => {
    const fetchLatestProof = async () => {
      if (!viewingRegistration || viewingRegistration.paymentProof) return;
      try {
        const eventIdToQuery = viewingRegistration.event?.id || eventId;
        const proof = await PaymentService.getLatestPaymentProofByRegistrationId(
          viewingRegistration.id,
          eventIdToQuery
        );
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
        logger.warn('[AttendeesTab] Failed to load latest payment proof', e);
        
        // Show user-friendly message if it's an index error
        if (e?.message?.includes('index') || e?.code === 'failed-precondition') {
          logger.error(
            'Firestore Index Required!\n\n' +
            'Please create the required index by visiting:\n' +
            'Firebase Console → Firestore Database → Indexes\n\n' +
            'Or use: firebase deploy --only firestore:indexes'
          );
        }
      }
    };

    fetchLatestProof();
  }, [viewingRegistration?.id, viewingRegistration?.event?.id, eventId]);


  const handleStatusChange = async (registrationId: string, newStatus: Registration['status'], notes?: string): Promise<void> => {
    // Only handle admin status changes (approved/rejected)
    if (newStatus === 'approved' || newStatus === 'rejected') {
      try {
        await RegistrationService.updateRegistrationStatus(
          registrationId, 
          newStatus as 'approved' | 'rejected',
          notes
        );
        
        // Update local state after successful update
        setRegistrations(prev => 
          prev.map(reg => {
            if (reg.id !== registrationId) return reg;
            const isFree = (reg.totalAmount === 0 || !reg.totalAmount);
            return {
              ...reg,
              status: newStatus,
              registrationStatus: newStatus,
              notes: notes || reg.notes,
              ...(newStatus === 'approved' && isFree ? { paymentStatus: 'paid' as const } : {})
            };
          })
        );

        if (viewingRegistration?.id === registrationId) {
          const isFree = (viewingRegistration.totalAmount === 0 || !viewingRegistration.totalAmount);
          setViewingRegistration(prev =>
            prev ? {
              ...prev,
              status: newStatus,
              registrationStatus: newStatus,
              notes: notes || prev.notes,
              ...(newStatus === 'approved' && isFree ? { paymentStatus: 'paid' as const } : {})
            } : null
          );
        }
      } catch (error) {
        logger.error('Failed to update registration status:', error);
        toast.error('Failed to update registration status. Please try again.');
        throw error;
      }
    } else {
      // For other status changes, just update locally for now
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === registrationId 
            ? { ...reg, status: newStatus, registrationStatus: newStatus, notes: notes || reg.notes }
            : reg
        )
      );

      if (viewingRegistration?.id === registrationId) {
        setViewingRegistration(prev =>
          prev ? { ...prev, status: newStatus, registrationStatus: newStatus, notes: notes || prev.notes } : null
        );
      }
    }
  };



  const handlePaymentVerification = async (
    registrationId: string,
    action: 'approved' | 'rejected'
  ) => {
    try {
      // Find the registration
      const registration = registrations.find(r => r.id === registrationId);

      // Ensure we have a payment proof; if missing, try to fetch the latest
      let proofId: string | null = registration?.paymentProof?.id || null;
      if (!proofId) {
        const eventIdToQuery = registration?.event?.id || eventId;
        const latestProof = await PaymentService.getLatestPaymentProofByRegistrationId(registrationId, eventIdToQuery);
        if (!latestProof) {
          throw new Error('No payment proof found for this registration');
        }
        proofId = latestProof.id;
      }

      // Delegate verification to PaymentService which updates proof and registration
      const verifierUid = userProfile?.uid || 'system';
      const verifierName = (userProfile as any)?.displayName || (userProfile as any)?.email || 'Admin';
      await PaymentService.verifyPaymentProof(proofId, action, verifierUid, verifierName);

      // Update local state optimistically. `notes` is deliberately left alone:
      // it is the attendee's own note on the proof, not a verification record.
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

      logger.log(`Payment ${action} for registration ${registrationId}`);
    } catch (error) {
      logger.error('Failed to update payment status:', error);
      toast.error(`Failed to ${action} payment. Please try again.`);
    }
  };

  // Function to open registration details modal
  const handleViewRegistration = (registration: Registration) => {
    setViewingRegistration(registration);
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

  const isAwaitingVerification = (registration: Registration): boolean => {
    // Rejecting resolves the proof alongside the registration, but legacy records
    // still carry rejected registrations with a pending proof. Those are not
    // actionable, so counting them would point the chip at dead rows.
    if (resolveDisplayStatus(registration) === 'rejected') return false;
    return (
      registration.paymentStatus === 'pending' ||
      (!!registration.paymentProof &&
        registration.paymentProof.verificationStatus === 'pending')
    );
  };

  const filteredRegistrations = registrations.filter(registration => {
    const promoCodeVal = getRegistrationPromoCode(registration);
    const matchesSearch = 
      registration.attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.attendee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.attendee.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (promoCodeVal ? promoCodeVal.toLowerCase().includes(searchTerm.toLowerCase()) : false);
    

    const matchesStatus =
      statusFilter === 'all' ||
      registration.status === statusFilter ||
      (statusFilter === 'confirmed' &&
        (registration.status === 'confirmed' ||
          registration.status === 'approved' ||
          registration.status === 'paid'));
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
    const regType = registration.registrationType || 'online';
    const matchesRegistrationType = 
      registrationTypeFilter === 'all' || 
      regType === registrationTypeFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesTicketType && matchesPriceRange && matchesRegistrationType &&
      (!awaitingVerificationOnly || isAwaitingVerification(registration));
  });

  // Net of promo discounts — totalAmount is what the attendee actually paid.
  // The old Payments tab summed paymentProof.ticketPrice (gross), which the
  // Promo Codes tab sitting one tab over would have made visibly wrong.
  const paidRegistrations = React.useMemo(
    () => registrations.filter((r) => r.paymentStatus === 'paid'),
    [registrations]
  );

  const verifiedRevenue = React.useMemo(
    () =>
      paidRegistrations.reduce((sum, r) => sum + getRegistrationTotalAmount(r), 0),
    [paidRegistrations]
  );

  const awaitingVerificationCount = React.useMemo(
    () => registrations.filter(isAwaitingVerification).length,
    [registrations]
  );

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: registrations.length,
      pending: 0,
      confirmed: 0,
      attended: 0,
      cancelled: 0,
      rejected: 0,
    };
    registrations.forEach((r) => {
      const displayStatus = resolveDisplayStatus(r);
      if (counts[displayStatus] !== undefined) {
        counts[displayStatus] += 1;
      }
      if (displayStatus === 'approved' || displayStatus === 'paid') {
        counts.confirmed = (counts.confirmed || 0) + 1;
      }
    });
    return counts;
  }, [registrations]);

  // Bulk selection handlers (must be after filteredRegistrations)
  const selectAllFiltered = () => {
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
    
    // Also find already-approved registrations with pending payments
    const approvedRegsWithPendingPayment = selectedRegs.filter(r => 
      r.status === 'approved' && 
      r.paymentProof && 
      r.paymentProof.verificationStatus === 'pending'
    );
    
    // Combine both for processing
    const regsToProcess = [...pendingRegs, ...approvedRegsWithPendingPayment];
    
    if (regsToProcess.length === 0) {
      const alreadyApproved = selectedRegs.filter(r => 
        r.status === 'approved' && 
        (!r.paymentProof || r.paymentProof.verificationStatus === 'approved')
      );
      
      let message = 'No pending registrations or payments found.\n\n';
      if (alreadyApproved.length > 0) {
        message += `• ${alreadyApproved.length} registration(s) and payment(s) already approved`;
      }
      
      alert(message);
      return;
    }

    // Count registrations with and without payment proof
    const pendingRegsWithPaymentProof = pendingRegs.filter(r => 
      r.paymentProof && r.paymentProof.verificationStatus === 'pending'
    );
    const pendingRegsWithoutPaymentProof = pendingRegs.filter(r => 
      !r.paymentProof && r.paymentStatus !== 'paid'
    );
    const approvedRegsWithoutPaymentProof = approvedRegsWithPendingPayment.filter(r =>
      !r.paymentProof && r.paymentStatus !== 'paid'
    );

    const totalWithoutProof = pendingRegsWithoutPaymentProof.length + approvedRegsWithoutPaymentProof.length;

    if (!window.confirm(
      `Are you sure you want to approve ${regsToProcess.length} item(s)?\n\n` +
      `This will:\n` +
      (pendingRegs.length > 0 ? `• Approve ${pendingRegs.length} registration(s)\n` : '') +
      (pendingRegsWithPaymentProof.length > 0 
        ? `• Approve ${pendingRegsWithPaymentProof.length} payment(s) with proof\n`
        : '') +
      (approvedRegsWithPendingPayment.length > 0 && approvedRegsWithPendingPayment.filter(r => r.paymentProof).length > 0
        ? `• Approve ${approvedRegsWithPendingPayment.filter(r => r.paymentProof).length} payment(s) for already-approved registrations\n`
        : '') +
      (totalWithoutProof > 0
        ? `• [FORCE] Approve ${totalWithoutProof} payment(s) WITHOUT proof\n`
        : '') +
      `\nContinue?`
    )) {
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;
    let paymentSuccessCount = 0;
    let paymentFailCount = 0;
    const verifierUid = userProfile?.uid || 'system';
    const verifierName = (userProfile as any)?.displayName || (userProfile as any)?.email || 'Admin';

    // Track registrations that need payment notification emails
    const registrationsToNotify: Registration[] = [];

    // Process pending registrations
    for (const reg of pendingRegs) {
      try {
        // Approve the registration
        await RegistrationService.updateRegistrationStatus(reg.id, 'approved');
        successCount++;

        let paymentApproved = false;

        // FORCE APPROVE PAYMENT - either approve payment proof or force mark as paid
        if (reg.paymentProof && reg.paymentProof.verificationStatus === 'pending') {
          // If there's a payment proof, approve it
          try {
            await PaymentService.verifyPaymentProof(reg.paymentProof.id, 'approved', verifierUid, verifierName);
            paymentSuccessCount++;
            paymentApproved = true;
          } catch (paymentError) {
            logger.error(`Failed to approve payment for registration ${reg.id}:`, paymentError);
            paymentFailCount++;
          }
        } else if (reg.paymentStatus !== 'paid') {
          // If no payment proof or payment not paid, FORCE mark as paid
          try {
            const registrationRef = doc(db, 'registrations', reg.id);
            await updateDoc(registrationRef, {
              paymentStatus: 'paid',
              'paymentDetails.forceApproved': true,
              'paymentDetails.forceApprovedBy': verifierUid,
              'paymentDetails.forceApprovedAt': serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            paymentSuccessCount++;
            paymentApproved = true;
          } catch (paymentError) {
            logger.error(`Failed to force approve payment for registration ${reg.id}:`, paymentError);
            paymentFailCount++;
          }
        }

        // Add to notification list if payment was approved
        if (paymentApproved) {
          registrationsToNotify.push(reg);
        }
      } catch (error) {
        logger.error(`Failed to approve registration ${reg.id}:`, error);
        failCount++;
      }
    }

    // Process already-approved registrations with pending payments
    for (const reg of approvedRegsWithPendingPayment) {
      let paymentApproved = false;

      if (reg.paymentProof && reg.paymentProof.verificationStatus === 'pending') {
        try {
          await PaymentService.verifyPaymentProof(reg.paymentProof.id, 'approved', verifierUid, verifierName);
          paymentSuccessCount++;
          paymentApproved = true;
        } catch (paymentError) {
          logger.error(`Failed to approve payment for registration ${reg.id}:`, paymentError);
          paymentFailCount++;
        }
      } else if (reg.paymentStatus !== 'paid') {
        // Force mark as paid if not already paid
        try {
          const registrationRef = doc(db, 'registrations', reg.id);
          await updateDoc(registrationRef, {
            paymentStatus: 'paid',
            'paymentDetails.forceApproved': true,
            'paymentDetails.forceApprovedBy': verifierUid,
            'paymentDetails.forceApprovedAt': serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          paymentSuccessCount++;
          paymentApproved = true;
        } catch (paymentError) {
          logger.error(`Failed to force approve payment for registration ${reg.id}:`, paymentError);
          paymentFailCount++;
        }
      }

      // Add to notification list if payment was approved
      if (paymentApproved) {
        registrationsToNotify.push(reg);
      }
    }

    // Update local state
    setRegistrations(prev =>
      prev.map(reg => {
        // Check if this registration was processed
        const pendingReg = pendingRegs.find(pr => pr.id === reg.id);
        const approvedRegWithPendingPayment = approvedRegsWithPendingPayment.find(ar => ar.id === reg.id);
        
        if (!pendingReg && !approvedRegWithPendingPayment) return reg;

        // Start with current registration data
        const updated = { ...reg };

        // Update registration status if it was pending
        if (pendingReg) {
          updated.status = 'approved' as const;
          updated.registrationStatus = 'approved';
          if (reg.totalAmount === 0 || !reg.totalAmount) {
            updated.paymentStatus = 'paid';
          }
        }

        // Update payment status if payment was approved
        const originalReg = pendingReg || approvedRegWithPendingPayment;
        if (originalReg && originalReg.paymentProof && originalReg.paymentProof.verificationStatus === 'pending') {
          updated.paymentStatus = 'paid';
          updated.paymentProof = {
            ...originalReg.paymentProof,
            verificationStatus: 'approved' as const,
            verifiedAt: new Date().toISOString(),
            verifiedBy: verifierName
          };
        }

        return updated;
      })
    );

    setIsBulkProcessing(false);
    setSelectedRegistrations(new Set());
    
    // Send registration approval notification emails
    if (registrationsToNotify.length > 0 && currentEvent) {
      for (const reg of registrationsToNotify) {
        try {
          await EmailService.sendPaymentNotification({
            registrationId: reg.id,
            status: 'approved',
            eventTitle: currentEvent.title,
            attendeeEmail: reg.attendee.email,
            attendeeName: reg.attendee.name,
            isFreeRegistration: getRegistrationTotalAmount(reg) === 0
          });
        } catch (emailError) {
          logger.error(`Failed to send registration approval notification to ${reg.attendee.email}:`, emailError);
          // Don't fail the whole operation if email fails
        }
      }
    }
    
    const message = `Bulk Approve Complete!\n\n` +
      `• Registrations approved: ${successCount}\n` +
      (failCount > 0 ? `• Registrations failed: ${failCount}\n` : '') +
      (paymentSuccessCount > 0 ? `\n• Payments approved: ${paymentSuccessCount}\n` : '') +
      (paymentFailCount > 0 ? `• Payments failed: ${paymentFailCount}\n` : '') +
      (registrationsToNotify.length > 0 ? `\n• Email notifications sent: ${registrationsToNotify.length}` : '');
    
    alert(message);
  };

  // Bulk approve payments
  const handleBulkApprovePayments = async () => {
    const selectedRegs = registrations.filter(r => selectedRegistrations.has(r.id));
    // Filter by paymentStatus instead of paymentProof.verificationStatus
    const pendingPayments = selectedRegs.filter(r => 
      r.paymentStatus === 'pending' || 
      (r.paymentProof && r.paymentProof.verificationStatus === 'pending')
    );
    
    if (pendingPayments.length === 0) {
      // Provide more detailed feedback
      const alreadyPaid = selectedRegs.filter(r => r.paymentStatus === 'paid');
      const withPaymentProof = selectedRegs.filter(r => r.paymentProof);
      const alreadyApproved = withPaymentProof.filter(r => r.paymentProof?.verificationStatus === 'approved');
      
      let message = 'No pending payments found in selected registrations.\n\n';
      if (alreadyPaid.length > 0) {
        message += `• ${alreadyPaid.length} registration(s) already marked as paid\n`;
      }
      if (alreadyApproved.length > 0) {
        message += `• ${alreadyApproved.length} payment proof(s) already approved\n`;
      }
      
      alert(message);
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
        const regRef = doc(db, 'registrations', reg.id);
        
        if (reg.paymentProof && reg.paymentProof.verificationStatus === 'pending') {
          // If there's a payment proof, verify it through the service
          await PaymentService.verifyPaymentProof(reg.paymentProof.id, 'approved', verifierUid, verifierName);
          successCount++;
        } else if (reg.paymentStatus === 'pending') {
          // If no payment proof but status is pending, force approve the payment
          await updateDoc(regRef, {
            paymentStatus: 'paid',
            'paymentDetails.forceApproved': true,
            'paymentDetails.forceApprovedBy': verifierUid,
            'paymentDetails.forceApprovedAt': serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          successCount++;
        }
      } catch (error) {
        logger.error(`Failed to approve payment for registration ${reg.id}:`, error);
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
    
    // Send registration approval notification emails
    if (successCount > 0 && currentEvent) {
      for (const reg of pendingPayments) {
        try {
          await EmailService.sendPaymentNotification({
            registrationId: reg.id,
            status: 'approved',
            eventTitle: currentEvent.title,
            attendeeEmail: reg.attendee.email,
            attendeeName: reg.attendee.name,
            isFreeRegistration: getRegistrationTotalAmount(reg) === 0
          });
        } catch (emailError) {
          logger.error(`Failed to send registration approval notification to ${reg.attendee.email}:`, emailError);
          // Don't fail the whole operation if email fails
        }
      }
    }
    
    alert(
      `Bulk Payment Approve Complete!\n\n` +
      `• Successfully approved: ${successCount}\n` +
      (failCount > 0 ? `• Failed: ${failCount}\n` : '') +
      (successCount > 0 ? `• Email notifications sent: ${successCount}` : '')
    );
  };

  // Force approve registrations (without payment requirement)
  const handleForceApprove = async () => {
    const selectedRegs = registrations.filter(r => selectedRegistrations.has(r.id));
    const notApproved = selectedRegs.filter(r => r.status !== 'approved' && r.status !== 'paid' && r.status !== 'attended');
    
    if (notApproved.length === 0) {
      alert('All selected registrations are already approved or attended.');
      return;
    }

    // Count registrations without payment proof
    const withoutPaymentProof = notApproved.filter(r => !r.paymentProof);
    
    if (!window.confirm(
      `FORCE APPROVE ${notApproved.length} REGISTRATION(S)\n\n` +
      `This will approve registrations regardless of payment status:\n\n` +
      `• Total to approve: ${notApproved.length}\n` +
      (withoutPaymentProof.length > 0 
        ? `• Without payment proof: ${withoutPaymentProof.length}\n`
        : '') +
      `\nThis action will mark them as "paid" even without payment verification.\n\n` +
      `Are you sure you want to continue?`
    )) {
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;
    const verifierUid = userProfile?.uid || 'system';

    for (const reg of notApproved) {
      try {
        // Approve the registration
        await RegistrationService.updateRegistrationStatus(reg.id, 'approved');
        
        // Force mark payment as paid in Firestore
        const registrationRef = doc(db, 'registrations', reg.id);
        await updateDoc(registrationRef, {
          paymentStatus: 'paid',
          'paymentDetails.forceApproved': true,
          'paymentDetails.forceApprovedBy': verifierUid,
          'paymentDetails.forceApprovedAt': serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        successCount++;
      } catch (error) {
        logger.error(`Failed to force approve registration ${reg.id}:`, error);
        failCount++;
      }
    }

    // Update local state
    setRegistrations(prev =>
      prev.map(reg => {
        const approvedReg = notApproved.find(ar => ar.id === reg.id);
        if (!approvedReg) return reg;

        return {
          ...reg,
          status: 'approved' as const,
          registrationStatus: 'approved',
          paymentStatus: 'paid' as const
        };
      })
    );

    setIsBulkProcessing(false);
    setSelectedRegistrations(new Set());
    
    // Send payment approval notification emails
    if (successCount > 0 && currentEvent) {
      for (const reg of notApproved) {
        try {
          await EmailService.sendPaymentNotification({
            registrationId: reg.id,
            status: 'approved',
            eventTitle: currentEvent.title,
            attendeeEmail: reg.attendee.email,
            attendeeName: reg.attendee.name,
            isFreeRegistration: getRegistrationTotalAmount(reg) === 0
          });
        } catch (emailError) {
          logger.error(`Failed to send payment notification to ${reg.attendee.email}:`, emailError);
          // Don't fail the whole operation if email fails
        }
      }
    }
    
    alert(
      `Force Approve Complete!\n\n` +
      `• Successfully force approved: ${successCount}\n` +
      (failCount > 0 ? `• Failed: ${failCount}\n` : '') +
      (successCount > 0 ? `• Email notifications sent: ${successCount}\n` : '') +
      `\nNotice: These registrations are marked as paid without payment verification.`
    );
  };

  // Resend approval emails to already approved registrations
  const handleResendApprovalEmails = async () => {
    const selectedRegs = registrations.filter(r => selectedRegistrations.has(r.id));
    
    // Filter for registrations with paid payment status
    const approvedAndPaidRegs = selectedRegs.filter(r => 
      r.paymentStatus === 'paid' &&
      r.attendee?.email && // Ensure email exists
      r.event?.title // Ensure event title exists
    );
    
    if (approvedAndPaidRegs.length === 0) {
      // Debug: Show what we found
      const statusBreakdown = selectedRegs.map(r => 
        `- ${r.attendee?.name || 'Unknown'}: status=${r.status}, paymentStatus=${r.paymentStatus}, hasEmail=${!!r.attendee?.email}, hasEventTitle=${!!r.event?.title}`
      ).join('\n');
      
      alert(
        `No registrations with paid payment status found in selected items.\n\n` +
        `Selected registrations breakdown:\n${statusBreakdown}\n\n` +
        `Please select registrations that have paymentStatus='paid'.`
      );
      return;
    }

    if (!window.confirm(
      `Resend Approval Email Notifications\n\n` +
      `This will resend payment approval emails to ${approvedAndPaidRegs.length} attendee(s).\n\n` +
      `Use this for registrations that were pre-approved before the email service was set up.\n\n` +
      `Continue?`
    )) {
      return;
    }

    setIsBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const reg of approvedAndPaidRegs) {
      try {
        await EmailService.sendPaymentNotification({
          registrationId: reg.id,
          status: 'approved',
          eventTitle: reg.event.title,
          attendeeEmail: reg.attendee.email,
          attendeeName: reg.attendee.name,
          isFreeRegistration: getRegistrationTotalAmount(reg) === 0
        });
        successCount++;
      } catch (error) {
        logger.error(`Failed to send email to ${reg.attendee?.email || 'unknown'}:`, error);
        failCount++;
      }
    }

    setIsBulkProcessing(false);
    setSelectedRegistrations(new Set());
    
    alert(
      `Resend Emails Complete!\n\n` +
      `• Successfully sent: ${successCount}\n` +
      (failCount > 0 ? `• Failed: ${failCount}` : '')
    );
  };

  const handleBulkTransferTicketTier = async () => {
    if (!canUpdateRegistrations) {
      toast.error('You do not have permission to update registrations');
      return;
    }
    if (!bulkTargetTicketTypeId) {
      toast.error('Please select a target ticket tier');
      return;
    }

    const selectedRegs = registrations.filter((r) => selectedRegistrations.has(r.id));
    if (selectedRegs.length === 0) return;

    const isAdmin = ability.can('manage', 'all');
    setIsBulkTransferModalOpen(false);
    setIsBulkProcessing(true);

    let transferredCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const updatedById = new Map<
      string,
      {
        ticketTypeId: string;
        targetTicketTypeName: string;
        originalAmount: number;
        discountAmount: number;
        totalAmount: number;
        pricing: Record<string, any>;
      }
    >();

    for (const reg of selectedRegs) {
      try {
        const res = await RegistrationService.transferTicketType({
          registrationId: reg.id,
          targetTicketTypeId: bulkTargetTicketTypeId,
          forceCapacity: isAdmin,
        });
        if (res.alreadyOnTarget) {
          skippedCount += 1;
        } else {
          transferredCount += 1;
          updatedById.set(reg.id, {
            ticketTypeId: res.targetTicketTypeId,
            targetTicketTypeName: res.targetTicketTypeName,
            originalAmount: res.originalAmount,
            discountAmount: res.discountAmount,
            totalAmount: res.totalAmount,
            pricing: res.pricing,
          });
        }
      } catch (err) {
        logger.error(`Failed to transfer ticket tier for registration ${reg.id}:`, err);
        failedCount += 1;
      }
    }

    if (updatedById.size > 0) {
      setRegistrations((prev) =>
        prev.map((reg) => {
          const patch = updatedById.get(reg.id);
          if (!patch) return reg;
          return {
            ...reg,
            ticketTypeId: patch.ticketTypeId,
            originalAmount: patch.originalAmount,
            discountAmount: patch.discountAmount,
            totalAmount: patch.totalAmount,
            pricing: {
              ...reg.pricing,
              ...patch.pricing,
              ticketTypeName: patch.targetTicketTypeName,
            },
          };
        })
      );
    }

    setIsBulkProcessing(false);
    setSelectedRegistrations(new Set());

    if (failedCount > 0) {
      toast.error(
        `Transferred ${transferredCount} registration(s), ${failedCount} failed${
          skippedCount > 0 ? `, ${skippedCount} already on tier` : ''
        }.`
      );
    } else {
      toast.success(
        `Transferred ${transferredCount} registration(s)${
          skippedCount > 0 ? ` (${skippedCount} already on tier)` : ''
        }.`
      );
    }
  };

  const getStatusBadge = (status: DisplayStatus | string) => {
    switch (status) {
      case 'attended':
        return (
          <Badge tone="info">
            <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Checked In</span>
          </Badge>
        );
      case 'confirmed':
      case 'approved':
      case 'paid':
        return (
          <Badge tone="success">
            <CheckCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Confirmed</span>
          </Badge>
        );
      case 'rejected':
        return (
          <Badge tone="danger">
            <XCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Rejected</span>
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge tone="neutral">
            <XCircleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Cancelled</span>
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge tone="warning">
            <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Needs Review</span>
          </Badge>
        );
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
      <div className="py-6">
        <SkeletonList rows={5} />
      </div>
    );
  }

  const canUpdateRegistrations = ability.can('update', 'Registration');
  const canDeleteRegistrations = ability.can('delete', 'Registration');
  const canVerifyPayments = ability.can('update', 'PaymentProof');

  const headerActions = selectedRegistrations.size > 0 ? (
    <div className="flex flex-wrap items-center gap-3">
      <button 
        onClick={handleBulkApproveRegistrations}
        disabled={isBulkProcessing || !canUpdateRegistrations}
        className="inline-flex items-center px-4 py-2 bg-success text-white rounded-lg hover:bg-success-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={!canUpdateRegistrations ? 'Update permission required' : "Approve registrations and their pending payments"}
      >
        <CheckCircleIcon className="w-4 h-4 mr-2" />
        {isBulkProcessing ? 'Processing...' : `Approve All (${selectedRegistrations.size})`}
      </button>
      <button 
        onClick={handleBulkApprovePayments}
        disabled={isBulkProcessing || !canVerifyPayments}
        className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={!canVerifyPayments ? 'Payment verification permission required' : "Approve only pending payments"}
      >
        <CurrencyDollarIcon className="w-4 h-4 mr-2" />
        {isBulkProcessing ? 'Processing...' : `Approve Payments Only (${selectedRegistrations.size})`}
      </button>
      <button 
        onClick={handleForceApprove}
        disabled={isBulkProcessing || !canUpdateRegistrations || !canVerifyPayments}
        className="inline-flex items-center px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={!canUpdateRegistrations || !canVerifyPayments ? 'Update & payment verification permission required' : "Force approve registrations without payment verification - USE WITH CAUTION"}
      >
        <BellIcon className="w-4 h-4 mr-2" />
        {isBulkProcessing ? 'Processing...' : `Force Approve (${selectedRegistrations.size})`}
      </button>
      <button 
        onClick={handleResendApprovalEmails}
        disabled={isBulkProcessing}
        className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Resend approval emails to already approved registrations"
      >
        <EnvelopeIcon className="w-4 h-4 mr-2" />
        {isBulkProcessing ? 'Processing...' : `Resend Emails (${selectedRegistrations.size})`}
      </button>
      {availableTicketTypes.length > 1 && (
        <button
          type="button"
          onClick={() => {
            setBulkTargetTicketTypeId(availableTicketTypes[0]?.id || '');
            setIsBulkTransferModalOpen(true);
          }}
          disabled={isBulkProcessing || !canUpdateRegistrations}
          className="inline-flex items-center px-4 py-2 bg-surface-container-highest text-on-surface border border-outline-variant rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !canUpdateRegistrations
              ? 'Update permission required'
              : 'Transfer selected registrations to another ticket tier'
          }
        >
          <TicketIcon className="w-4 h-4 mr-2 text-primary" />
          {isBulkProcessing ? 'Processing...' : `Transfer Ticket (${selectedRegistrations.size})`}
        </button>
      )}
    </div>
  ) : null;

  const pageContent = (
    <div className="space-y-6">
      {headerActions && (
        <div className="flex flex-wrap items-center justify-end gap-3 pb-2">
          {headerActions}
        </div>
      )}
      {/* Loading Overlay */}
      <Modal
        open={isBulkProcessing}
        onClose={() => {}}
        title="Processing Bulk Operation"
        size="sm"
        closeOnBackdrop={false}
      >
        <div className="flex flex-col items-center space-y-4 text-center">
          <div className="relative" aria-hidden="true">
            <div className="w-16 h-16 border-4 border-outline-variant rounded-full"></div>
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full motion-essential animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="text-sm text-on-surface-variant">
            Please wait while we process your request...
          </p>
        </div>
      </Modal>

      {/* Bulk Ticket Tier Transfer Modal */}
      <Modal
        open={isBulkTransferModalOpen}
        onClose={() => setIsBulkTransferModalOpen(false)}
        title="Transfer Ticket Tier"
        size="sm"
        footer={
          <div className="flex w-full items-center justify-end gap-2">
            <Button
              variant="outlined"
              size="sm"
              onClick={() => setIsBulkTransferModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="filled"
              size="sm"
              onClick={handleBulkTransferTicketTier}
              disabled={!bulkTargetTicketTypeId}
            >
              Transfer {selectedRegistrations.size} Attendee{selectedRegistrations.size === 1 ? '' : 's'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Move <strong>{selectedRegistrations.size}</strong> selected registration
            {selectedRegistrations.size === 1 ? '' : 's'} to a different ticket tier. Ticket inventory counters and promo discount snapshots will update automatically.
          </p>
          <div>
            <label
              htmlFor="bulk-transfer-ticket-select"
              className="block text-xs font-semibold text-on-surface-variant mb-1.5"
            >
              Target Ticket Tier
            </label>
            <Select
              id="bulk-transfer-ticket-select"
              value={bulkTargetTicketTypeId}
              onChange={(e) => setBulkTargetTicketTypeId(e.target.value)}
              size="md"
              aria-label="Target ticket tier"
            >
              {availableTicketTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name} (₱{tt.price.toLocaleString()})
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      <div className="space-y-6">

        {/* Verified revenue. Carried over from the retired Payments tab, and
            scoped to the whole event rather than the current filter, so it
            reads as a total the way the old one did. */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-white px-4 py-3 text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <CurrencyDollarIcon className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
            <span className="font-medium text-success">Verified Revenue:</span>
            <span className="font-bold text-on-success-container">
              ₱{verifiedRevenue.toLocaleString('en-PH', { minimumFractionDigits: 0 })}
            </span>
          </div>
          <span className="text-xs text-on-surface-variant">
            {paidRegistrations.length} paid registration{paidRegistrations.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Search and Filters Card with Integrated Status Buttons */}
        <div className="bg-white rounded-xl border border-outline-variant p-4 sm:p-5 shadow-sm space-y-4">
          {/* Status Filter Buttons with Attendee Counts */}
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none [scrollbar-width:none]"
            role="tablist"
            aria-label="Filter attendees by status"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => {
              const isSelected = statusFilter === opt.value;
              const count = statusCounts[opt.value] ?? 0;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`inline-flex min-h-[44px] items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap active:scale-[0.97] transition-[color,background-color,border-color,transform] duration-short2 ease-emphasized-standard focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    isSelected
                      ? 'bg-primary text-white shadow-sm border border-primary'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-outline-variant'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold transition-colors duration-fast ease-quart ${
                      isSelected
                        ? 'bg-primary-hover text-white animate-pop-in motion-reduce:animate-none'
                        : 'bg-surface-container-high text-on-surface'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-outline-variant/60" />

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Search Bar - Full Width on Mobile, Flexible on Desktop */}
            <div className="relative flex-1 min-w-0 sm:min-w-[240px]">
              <MagnifyingGlassIcon
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-outline-variant h-4 w-4"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search attendees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full min-h-[44px] h-11 pl-10 pr-4 text-[16px] sm:text-sm bg-surface text-on-surface border border-outline-variant rounded-lg placeholder:text-outline-variant focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                aria-label="Search attendees"
              />
            </div>

            {/* Filter Dropdowns - Aligned with Consistent Height & Cross-Browser Styling */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">

              {/* Ticket Type Filter */}
              {availableTicketTypes.length > 0 && (
                <div className="w-full sm:w-auto min-w-[150px] flex-1 sm:flex-initial">
                  <Select
                    value={ticketTypeFilter}
                    onChange={(e) => setTicketTypeFilter(e.target.value)}
                    size="md"
                    aria-label="Filter by ticket type"
                  >
                    <option value="all">All Ticket Types</option>
                    {availableTicketTypes.map((tt) => (
                      <option key={tt.id} value={tt.id}>
                        {tt.name} (₱{tt.price.toLocaleString()})
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Price Range Filter */}
              <div className="w-full sm:w-auto min-w-[130px] flex-1 sm:flex-initial">
                <Select
                  value={priceRangeFilter}
                  onChange={(e) => setPriceRangeFilter(e.target.value)}
                  size="md"
                  aria-label="Filter by price range"
                >
                  <option value="all">All Prices</option>
                  <option value="free">Free</option>
                  <option value="under-500">Under ₱500</option>
                  <option value="500-1000">₱500 - ₱1K</option>
                  <option value="1000-2000">₱1K - ₱2K</option>
                  <option value="above-2000">Above ₱2K</option>
                </Select>
              </div>

              {/* Registration Type Filter */}
              <div className="w-full sm:w-auto min-w-[130px] flex-1 sm:flex-initial">
                <Select
                  value={registrationTypeFilter}
                  onChange={(e) => setRegistrationTypeFilter(e.target.value)}
                  size="md"
                  aria-label="Filter by registration type"
                >
                  <option value="all">All Types</option>
                  <option value="online">Online</option>
                  <option value="walk-in">Walk-In</option>
                </Select>
              </div>

              {/* Verification Queue Toggle. A press-button rather than a <select> because it
                  is a boolean, and a select with All/On values is worse than a
                  toggle at every screen size. Hidden entirely when nothing is
                  waiting, so the free-event case loses no row. */}
              {awaitingVerificationCount > 0 && (
                <button
                  type="button"
                  aria-pressed={awaitingVerificationOnly}
                  onClick={() => setAwaitingVerificationOnly((prev) => !prev)}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-3.5 text-sm font-medium transition-[color,background-color,border-color] duration-fast ease-quart focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    awaitingVerificationOnly
                      ? 'border-warning bg-warning-container text-on-warning-container'
                      : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-outline hover:text-on-surface'
                  }`}
                >
                  Awaiting verification
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      awaitingVerificationOnly
                        ? 'bg-warning text-white'
                        : 'bg-surface-container-high text-on-surface'
                    }`}
                  >
                    {awaitingVerificationCount}
                  </span>
                </button>
              )}

              {/* Reset Filters when any filter is active */}
              {(statusFilter !== 'all' || searchTerm.trim() !== '' || ticketTypeFilter !== 'all' || priceRangeFilter !== 'all' || registrationTypeFilter !== 'all' || awaitingVerificationOnly) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setSearchTerm('');
                    setTicketTypeFilter('all');
                    setPriceRangeFilter('all');
                    setRegistrationTypeFilter('all');
                    setAwaitingVerificationOnly(false);
                  }}
                  className="min-h-[44px] px-3.5 text-xs font-medium text-on-surface-variant hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg border border-outline-variant hover:border-outline"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bulk Selection Toolbar */}
        {filteredRegistrations.length > 0 && (
          <div className="bg-white rounded-xl border border-outline-variant p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSelectAllChecked}
                    onChange={selectAllFiltered}
                    className="w-5 h-5 text-primary border-outline-variant rounded focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-on-surface-variant">
                    Select All ({filteredRegistrations.length})
                  </span>
                </label>
                {selectedRegistrations.size > 0 && (
                  <span className="text-sm text-on-surface-variant">
                    {selectedRegistrations.size} selected
                  </span>
                )}
              </div>
              <div className="text-xs sm:text-sm font-medium text-on-surface-variant">
                Showing {filteredRegistrations.length} of {registrations.length} attendee{registrations.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
        )}

        {/* Attendee Registrations List */}
        <div className="dashboard-card">
          {filteredRegistrations.length === 0 ? (
            <EmptyState
              icon={<UserIcon className="h-6 w-6" />}
              title="No registrations found"
              description={
                searchTerm || statusFilter !== 'all' || ticketTypeFilter !== 'all' || priceRangeFilter !== 'all' || registrationTypeFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Attendee registrations will appear here once people start signing up for events.'
              }
              compact
            />
          ) : (
            <div className="divide-y divide-outline-variant">
              {filteredRegistrations.map((registration) => {
                const ticketQuantity = getRegistrationQuantity(registration);
                const totalAmount = getRegistrationTotalAmount(registration);
                const promoCodeValue = getRegistrationPromoCode(registration);
                const ticketTypeName = getTicketTypeName(registration);

                return (
                <div key={registration.id} className="p-6 hover:bg-surface-container-low transition-colors">
                  <div className="flex items-start space-x-4">

                    {/* Checkbox */}
                    <div className="flex-shrink-0 pt-1">
                      <input
                        type="checkbox"
                        checked={selectedRegistrations.has(registration.id)}
                        onChange={() => handleSelectRegistration(registration.id)}
                        className="w-5 h-5 text-primary border-outline-variant rounded focus:ring-2 focus:ring-primary cursor-pointer"
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
                        <div className="h-12 w-12 rounded-full bg-surface-container-highest flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-on-surface-variant" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-on-surface">
                          {registration.attendee.name}
                        </h3>
                        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                          {/* Primary Lifecycle Status Badge */}
                          {getStatusBadge(registration.status)}

                          {/* Actionable or contextual badges only */}
                          {registration.paymentStatus === 'failed' && (
                            <Badge tone="danger">
                              <span>Payment Failed</span>
                            </Badge>
                          )}
                          {registration.registrationType === 'walk-in' && (
                            <Badge tone="neutral">
                              <UserIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>Walk-In</span>
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-on-surface-variant">
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
                              <span className="text-sm font-medium text-success">
                                ₱{registration.event.ticketPrice.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          {ticketTypeName && (
                            <div className="flex items-center space-x-2">
                              <TagIcon className="h-4 w-4" />
                              <span>{ticketTypeName}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-2">
                            <TicketIcon className="h-4 w-4" />
                            <span>{ticketQuantity} ticket{ticketQuantity !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <CurrencyDollarIcon className="h-4 w-4" />
                            <span>{formatCurrency(totalAmount)}</span>
                          </div>
                          {promoCodeValue && (
                            <span className="inline-flex items-center px-2 py-1 text-sm font-medium rounded-full bg-primary-container text-on-primary-container">
                              Promo: {promoCodeValue}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button - Only View Details */}
                  <div className="flex items-center justify-end mt-4 pt-4 border-t border-outline-variant">
                    <Button
                      variant="outlined"
                      size="sm"
                      onClick={() => handleViewRegistration(registration)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Registration Details Modal */}
        <RegistrationDetailsModal
          isOpen={!!viewingRegistration}
          onClose={() => setViewingRegistration(null)}
          registration={viewingRegistration}
          events={events}
          onUpdateRegistration={(updatedReg) => {
            setViewingRegistration(updatedReg);
            setRegistrations((prev) =>
              prev.map((r) => (r.id === updatedReg.id ? updatedReg : r))
            );
          }}
          onStatusChange={handleStatusChange}
          onPaymentVerification={handlePaymentVerification}
          onDeleteRegistration={async (registrationId) => {
            const isAdmin = ability.can('manage', 'all');
            if (!canDeleteRegistrations && !isAdmin) {
              toast.error('You do not have permission to delete registrations');
              return;
            }
            await RegistrationService.deleteRegistration(registrationId, isAdmin);
            setRegistrations((prev) => prev.filter((r) => r.id !== registrationId));
          }}
        />
      </div>
    </div>
  );

  return pageContent;
};

export default AttendeesTab;
