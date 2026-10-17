import React, { useState, useEffect } from 'react';
import { useAbility } from '@casl/react';
import {
  UserIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  TicketIcon,
  PencilSquareIcon,
  CheckIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
  Button,
  Modal,
  ConfirmationModal,
  Badge,
  Input,
  type BadgeTone,
} from '../../../../components/UI';
import { RegistrationService } from '../../../../services/registrationService';
import { EmailService, type EmailLog } from '../../../../services/emailService';
import { asRegistration, asPaymentProof } from '../../../../auth/ability';
import { Event } from '../../../../types';
import { getDownloadUrlFromPath } from '../../../../utils/storageUtils';
import { getRegistrationTotalAmount } from '../../../../utils/pricing';
import { logger } from '../../../../utils/logger';
import { formatDateTime as formatDate } from '../../../../utils/dateUtils';

export interface AttendeeRegistration {
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
  status: 'pending' | 'confirmed' | 'approved' | 'rejected' | 'paid' | 'attended' | 'cancelled';
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
  quantity: number;
  originalAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  currency?: string;
  ticketTypeId?: string;
  pricing?: {
    originalPrice?: number;
    currentPrice?: number;
    discountAmount?: number;
    ticketTypeName?: string;
    promoCode?: {
      code?: string;
      name?: string;
      discountType?: 'percentage' | 'fixed';
      discountValue?: number;
    };
  };
  registrationType?: 'online' | 'walk-in';
}

export interface RegistrationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  registration: AttendeeRegistration | null;
  events: Event[];
  onUpdateRegistration: (updated: AttendeeRegistration) => void;
  onStatusChange: (
    registrationId: string,
    newStatus: AttendeeRegistration['status'],
    notes?: string
  ) => Promise<void> | void;
  onPaymentVerification: (
    registrationId: string,
    action: 'approved' | 'rejected',
    notes?: string
  ) => Promise<void> | void;
  onDeleteRegistration: (registrationId: string) => Promise<void> | void;
}

const EMAIL_TYPE_LABELS: Record<string, string> = {
  email_confirmation_sent: 'Registration Confirmation',
  payment_notification_sent: 'Payment Notification',
  event_reminder_sent: 'Event Reminder',
  feedback_request_sent: 'Feedback & Certificate',
  checkin_notification_sent: 'Check-in Confirmation',
};

const formatCurrency = (amount?: number): string => {
  const value = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return `₱${value.toLocaleString()}`;
};

const getStatusBadgeTone = (status: AttendeeRegistration['status']): BadgeTone => {
  switch (status) {
    case 'confirmed':
    case 'approved':
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
    case 'cancelled':
      return 'danger';
    case 'attended':
      return 'info';
    default:
      return 'neutral';
  }
};

/**
 * One payment verdict for the whole modal, derived once.
 *
 * This existed twice before, and the two copies disagreed. The hero badge read
 * `registration.paymentStatus` through a tone table; the Payment Verification card
 * read `paymentProof.verificationStatus` with a hardcoded `warning` fallback. So
 * an accepted free registration rendered "PAID" in an amber warning badge (no
 * proof exists, so the card fell through to warning), and a rejected registration
 * with no proof rendered "PENDING" in amber, because rejecting writes
 * registrationStatus but never clears a stale paymentStatus.
 */
type PaymentView =
  | { kind: 'not_required' }
  | { kind: 'pending'; label: string; tone: BadgeTone }
  | { kind: 'paid'; label: string; tone: BadgeTone }
  | { kind: 'rejected'; label: string; tone: BadgeTone };

const derivePaymentView = (
  registration: AttendeeRegistration,
  isFree: boolean
): PaymentView => {
  if (isFree) return { kind: 'not_required' };

  const proofStatus = registration.paymentProof?.verificationStatus;
  if (proofStatus === 'approved') return { kind: 'paid', label: 'PAID', tone: 'success' };
  if (proofStatus === 'rejected') return { kind: 'rejected', label: 'REJECTED', tone: 'danger' };
  // Rejecting never clears a stale paymentStatus, so the registration verdict
  // has to win here or a rejected attendee keeps showing as awaiting payment.
  if (registration.status === 'rejected') {
    return { kind: 'rejected', label: 'REJECTED', tone: 'danger' };
  }
  if (registration.paymentStatus === 'failed' || registration.paymentStatus === 'refunded') {
    return { kind: 'rejected', label: registration.paymentStatus.toUpperCase(), tone: 'danger' };
  }
  if (registration.paymentStatus === 'paid') {
    return { kind: 'paid', label: 'PAID', tone: 'success' };
  }
  if (proofStatus === 'pending') {
    return { kind: 'pending', label: 'AWAITING VERIFICATION', tone: 'warning' };
  }
  return { kind: 'pending', label: 'PENDING', tone: 'warning' };
};

const formatFormResponseValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'No response';
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : 'None selected';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, any>;
    if (obj.name && obj.phone) {
      return `${obj.name} (${obj.phone})`;
    }
    return JSON.stringify(value);
  }
  return String(value);
};

export const RegistrationDetailsModal: React.FC<RegistrationDetailsModalProps> = ({
  isOpen,
  onClose,
  registration,
  events,
  onUpdateRegistration,
  onStatusChange,
  onPaymentVerification,
  onDeleteRegistration,
}) => {
  const ability = useAbility();

  // Inline edit state for attendee details
  const [isEditingAttendee, setIsEditingAttendee] = useState(false);
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [attendeePhone, setAttendeePhone] = useState('');
  const [attendeeOrg, setAttendeeOrg] = useState('');
  const [isSavingAttendee, setIsSavingAttendee] = useState(false);

  // Action states
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Payment proof image resolution
  const [resolvedProofUrl, setResolvedProofUrl] = useState<string | null>(null);
  const [isLoadingProofImage, setIsLoadingProofImage] = useState(false);
  const [proofImageError, setProofImageError] = useState(false);

  // Lightbox modal for receipt
  const [showProofLightbox, setShowProofLightbox] = useState(false);

  // Email history. Collapsed by default and fetched on first expand — this
  // modal is opened for every attendee whose details are read, and a query per
  // open is a query nobody looks at the answer to.
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [emailHistory, setEmailHistory] = useState<EmailLog[] | null>(null);
  const [isLoadingEmailHistory, setIsLoadingEmailHistory] = useState(false);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);
  const [overrideEmailFor, setOverrideEmailFor] = useState<string | null>(null);
  const [overrideEmail, setOverrideEmail] = useState('');

  // Sync state whenever registration changes
  useEffect(() => {
    if (registration) {
      setAttendeeName(registration.attendee.name || '');
      setAttendeeEmail(registration.attendee.email || '');
      setAttendeePhone(registration.attendee.phone || '');
      setAttendeeOrg(registration.attendee.organization || '');
      setIsEditingAttendee(false);
      setProofImageError(false);

      const rawUrl = registration.paymentProof?.proofImageUrl;
      if (rawUrl) {
        if (rawUrl.startsWith('https://') || rawUrl.startsWith('http://')) {
          setResolvedProofUrl(rawUrl);
          setIsLoadingProofImage(false);
        } else {
          setIsLoadingProofImage(true);
          getDownloadUrlFromPath(rawUrl)
            .then((url) => {
              setResolvedProofUrl(url);
              setIsLoadingProofImage(false);
            })
            .catch((err) => {
              logger.warn('Failed to resolve payment proof download URL:', err);
              setResolvedProofUrl(null);
              setIsLoadingProofImage(false);
            });
        }
      } else {
        setResolvedProofUrl(null);
        setIsLoadingProofImage(false);
      }
    }
  }, [registration]);

  if (!registration) return null;

  const currentEvent = events.find((e) => e.id === registration.event.id);
  const eventOrganizerUid = currentEvent?.organizer?.uid || (registration as any)?.organizerUid;
  const registrationEntity = asRegistration({
    ...(registration as any),
    organizerUid: eventOrganizerUid,
  });
  const paymentProofEntity = asPaymentProof({
    organizerUid: eventOrganizerUid,
  } as any);

  const canDelete = ability.can('delete', registrationEntity);
  const canUpdate = ability.can('update', registrationEntity);
  const canVerifyPayment = ability.can('update', paymentProofEntity);
  const ticketType = currentEvent?.ticketTypes?.find(
    (tt) => tt.id === registration.ticketTypeId
  );

  const attendeeInitials = registration.attendee.name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AT';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} copied to clipboard`))
      .catch(() => toast.error('Failed to copy to clipboard. Please try again.'));
  };

  const handleSaveAttendeeDetails = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canUpdate) {
      toast.error('You do not have permission to update attendee details');
      return;
    }
    if (!attendeeName.trim()) {
      toast.error('Attendee name is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!attendeeEmail.trim() || !emailRegex.test(attendeeEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setIsSavingAttendee(true);
      await RegistrationService.updateAttendeeDetails(registration.id, {
        name: attendeeName,
        email: attendeeEmail,
        phone: attendeePhone,
        organization: attendeeOrg,
      });

      const updatedRegistration: AttendeeRegistration = {
        ...registration,
        attendee: {
          ...registration.attendee,
          name: attendeeName.trim(),
          email: attendeeEmail.trim().toLowerCase(),
          phone: attendeePhone.trim() || undefined,
          organization: attendeeOrg.trim() || undefined,
        },
      };

      onUpdateRegistration(updatedRegistration);
      setIsEditingAttendee(false);
      toast.success('Attendee details updated successfully');
    } catch (error) {
      logger.error('Failed to update attendee details:', error);
      toast.error('Failed to update attendee details. Please try again.');
    } finally {
      setIsSavingAttendee(false);
    }
  };

  // Free registrations have no proof to verify, and RegistrationService already
  // flips paymentStatus to 'paid' on approval when totalAmount === 0. A paid
  // registration always has a proof: payment is a prerequisite for registration.
  const isFree = getRegistrationTotalAmount(registration) === 0;
  const hasPendingProof =
    !!registration.paymentProof &&
    registration.paymentProof.verificationStatus === 'pending';
  const paymentView = derivePaymentView(registration, isFree);

  const isAlreadyAccepted =
    registration.status === 'confirmed' ||
    registration.status === 'paid' ||
    registration.status === 'attended' ||
    (registration.status === 'approved' && !hasPendingProof);

  const isConfirmed =
    registration.status === 'confirmed' ||
    registration.status === 'paid' ||
    registration.status === 'attended' ||
    registration.status === 'approved' ||
    registration.paymentStatus === 'paid';

  const handleAccept = async () => {
    if (!canUpdate) {
      toast.error('You do not have permission to update registrations');
      return;
    }
    if (!isFree && hasPendingProof && !canVerifyPayment) {
      toast.error('You do not have permission to verify payments');
      return;
    }
    // AGENTS.md §3.4: re-submitting a decision must not re-send its email.
    if (isAlreadyAccepted) {
      toast('Registration is already marked as accepted.');
      return;
    }
    try {
      setIsProcessingAction(true);
      await onStatusChange(registration.id, 'approved');
      if (!isFree && hasPendingProof) {
        await onPaymentVerification(registration.id, 'approved');
      }
      toast.success(isFree ? 'Registration accepted' : 'Registration and payment accepted');
      onClose();
    } catch (error) {
      logger.error('Error accepting registration:', error);
      toast.error('Failed to accept registration. Please try again.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleReject = async () => {
    if (!canUpdate) {
      toast.error('You do not have permission to update registrations');
      return;
    }
    if (registration.status === 'rejected') {
      toast('Registration is already marked as rejected.');
      return;
    }
    try {
      setIsProcessingAction(true);
      await onStatusChange(registration.id, 'rejected');
      // Rejecting only the registration leaves an approved record with a failed
      // payment. Both, so the attendee also leaves the awaiting-payment queue.
      if (hasPendingProof) {
        await onPaymentVerification(registration.id, 'rejected');
      }
      toast.success('Registration rejected');
      onClose();
    } catch (error) {
      logger.error('Error rejecting registration:', error);
      toast.error('Failed to reject registration. Please try again.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleToggleEmailHistory = async () => {
    const next = !showEmailHistory;
    setShowEmailHistory(next);
    // Fetch on first expand only; re-opening should not refetch.
    if (!next || emailHistory !== null || !registration) return;

    try {
      setIsLoadingEmailHistory(true);
      const logs = await EmailService.getAttendeeEmails(
        registration.event.id,
        registration.attendee.email
      );
      setEmailHistory(logs);
    } catch (error) {
      logger.error('Error fetching email history:', error);
      toast.error('Failed to load email history. Please try again.');
      setEmailHistory([]);
    } finally {
      setIsLoadingEmailHistory(false);
    }
  };

  const handleResendEmail = async (log: EmailLog) => {
    const target = overrideEmail.trim();
    if (overrideEmailFor === log.id && target && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setResendingEmailId(log.id);
      const result = await EmailService.resendEmail(
        log,
        overrideEmailFor === log.id && target ? target : undefined
      );
      if (result.success) {
        toast.success('Email resent');
        setOverrideEmailFor(null);
        setOverrideEmail('');
        // The resend writes a new activity_log, so the cached list is stale.
        setEmailHistory(null);
      } else {
        toast.error(result.message || 'Failed to resend email. Please try again.');
      }
    } catch (error) {
      logger.error('Error resending email:', error);
      toast.error('Failed to resend email. Please try again.');
    } finally {
      setResendingEmailId(null);
    }
  };

  const handleDeleteRegistration = async () => {
    if (!canDelete) {
      toast.error('You do not have permission to delete registrations.');
      setShowDeleteConfirm(false);
      return;
    }
    if (isConfirmed) {
      toast.error('Confirmed registrations cannot be deleted.');
      setShowDeleteConfirm(false);
      return;
    }
    try {
      setIsDeleting(true);
      await onDeleteRegistration(registration.id);
      toast.success('Registration deleted successfully');
      setShowDeleteConfirm(false);
      onClose();
    } catch (error: any) {
      logger.error('Error deleting registration:', error);
      toast.error(error?.message || 'Failed to delete registration. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Modal
        open={isOpen}
        onClose={onClose}
        title="Registration Details"
        size="2xl"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-sm">
            {/* Destructive Action */}
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isProcessingAction || isSavingAttendee || isConfirmed || !canDelete}
              title={
                !canDelete
                  ? 'Delete permission required'
                  : isConfirmed
                  ? 'Confirmed registrations cannot be deleted'
                  : undefined
              }
              icon={<XMarkIcon className="h-4 w-4" />}
            >
              Delete Registration
            </Button>

            {/* Once a registration is accepted it is final: both buttons disable
                so the organizer cannot toggle a confirmed attendee. */}
            <div className="flex flex-wrap items-center gap-xs">
              <Button
                variant="outlined"
                size="sm"
                onClick={handleReject}
                loading={isProcessingAction}
                disabled={isAlreadyAccepted || isSavingAttendee || !canUpdate}
                title={!canUpdate ? 'Update permission required' : undefined}
                className="!text-error !border-error/50 enabled:hover:!bg-error-container/20"
                icon={<XMarkIcon className="h-4 w-4" />}
              >
                Reject
              </Button>

              <Button
                variant="filled"
                size="sm"
                onClick={handleAccept}
                loading={isProcessingAction}
                disabled={isAlreadyAccepted || isSavingAttendee || !canUpdate || (!isFree && hasPendingProof && !canVerifyPayment)}
                title={
                  !canUpdate
                    ? 'Update permission required'
                    : !isFree && hasPendingProof && !canVerifyPayment
                    ? 'Payment verification permission required'
                    : undefined
                }
                icon={<CheckIcon className="h-4 w-4" />}
              >
                Accept
              </Button>

              <Button variant="outlined" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-md">
          {/* Top Hero Banner */}
          <div className="rounded-xl border border-outline-variant bg-surface-container-low p-md">
            <div className="flex flex-col gap-md sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-md">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container font-semibold text-base shadow-sm"
                  aria-hidden="true"
                >
                  {attendeeInitials}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-xs">
                    <h3 className="text-lg font-semibold text-on-surface">
                      {registration.attendee.name}
                    </h3>
                    {registration.registrationType === 'walk-in' ? (
                      <Badge tone="live">Walk-In</Badge>
                    ) : (
                      <Badge tone="neutral">Online</Badge>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                    <span>{registration.event.title}</span>
                    <span>•</span>
                    <span>Registered {formatDate(registration.registrationDate)}</span>
                  </p>
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-xs">
                <Badge tone={getStatusBadgeTone(registration.status)}>
                  Status:{' '}
                  {registration.status === 'confirmed'
                    ? 'CONFIRMED'
                    : registration.status === 'attended'
                    ? 'CHECKED IN'
                    : registration.status === 'pending'
                    ? 'NEEDS REVIEW'
                    : registration.status.toUpperCase()}
                </Badge>
                {/* A free registration has no payment to report, so it gets no payment pill
                    rather than one that says PENDING about money that was never
                    owed. */}
                {paymentView.kind !== 'not_required' && (
                  <Badge tone={paymentView.tone}>Payment: {paymentView.label}</Badge>
                )}
                <div className="rounded-md border border-outline-variant bg-surface px-sm py-1 text-xs font-semibold text-on-surface">
                  {formatCurrency(registration.totalAmount ?? registration.event.ticketPrice)}
                </div>
              </div>
            </div>
          </div>

          {/* Main 2-Column Content Grid */}
          <div className="grid grid-cols-1 gap-md lg:grid-cols-12">
            {/* Left Column (Attendee Details + Ticket/Pricing) */}
            <div className="space-y-md lg:col-span-7">
              {/* Attendee Details Card */}
              <div className="rounded-xl border border-outline-variant bg-surface p-md">
                <div className="flex items-center justify-between border-b border-outline-variant pb-sm mb-md">
                  <div className="flex items-center gap-xs">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-on-surface">
                        Attendee Information
                      </h4>
                      <p className="text-xs text-on-surface-variant">
                        Core participant profile &amp; contact
                      </p>
                    </div>
                  </div>

                  {!isEditingAttendee && canUpdate && (
                    <Button
                      variant="outlined"
                      size="sm"
                      onClick={() => setIsEditingAttendee(true)}
                      icon={<PencilSquareIcon className="h-3.5 w-3.5" />}
                      className="min-h-[36px]"
                    >
                      Edit Details
                    </Button>
                  )}
                </div>

                {isEditingAttendee ? (
                  <form onSubmit={handleSaveAttendeeDetails} className="space-y-sm">
                    <Input
                      label="Full Name"
                      value={attendeeName}
                      onChange={(e) => setAttendeeName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                      required
                    />
                    <Input
                      label="Email Address"
                      type="email"
                      value={attendeeEmail}
                      onChange={(e) => setAttendeeEmail(e.target.value)}
                      placeholder="e.g. jane@example.com"
                      required
                    />
                    <Input
                      label="Phone Number"
                      type="tel"
                      value={attendeePhone}
                      onChange={(e) => setAttendeePhone(e.target.value)}
                      placeholder="e.g. +63 912 345 6789"
                    />
                    <Input
                      label="Organization / School"
                      value={attendeeOrg}
                      onChange={(e) => setAttendeeOrg(e.target.value)}
                      placeholder="e.g. University of Mindanao / Tech Co."
                    />

                    <div className="flex items-center justify-end gap-xs pt-xs border-t border-outline-variant">
                      <Button
                        type="button"
                        variant="outlined"
                        size="sm"
                        onClick={() => {
                          setAttendeeName(registration.attendee.name || '');
                          setAttendeeEmail(registration.attendee.email || '');
                          setAttendeePhone(registration.attendee.phone || '');
                          setAttendeeOrg(registration.attendee.organization || '');
                          setIsEditingAttendee(false);
                        }}
                        disabled={isSavingAttendee}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="filled"
                        size="sm"
                        loading={isSavingAttendee}
                        icon={<CheckIcon className="h-4 w-4" />}
                      >
                        Save Changes
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                    <div className="rounded-lg bg-surface-container-low p-sm">
                      <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
                        <UserIcon className="h-3.5 w-3.5" /> Full Name
                      </span>
                      <p className="mt-1 text-sm font-semibold text-on-surface">
                        {registration.attendee.name}
                      </p>
                    </div>

                    <div className="rounded-lg bg-surface-container-low p-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
                          <EnvelopeIcon className="h-3.5 w-3.5" /> Email Address
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(registration.attendee.email, 'Email')}
                          className="text-on-surface-variant hover:text-primary transition-colors"
                          title="Copy email"
                          aria-label="Copy email"
                        >
                          <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1 text-sm text-on-surface truncate">
                        {registration.attendee.email}
                      </p>
                    </div>

                    <div className="rounded-lg bg-surface-container-low p-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
                          <PhoneIcon className="h-3.5 w-3.5" /> Phone Number
                        </span>
                        {registration.attendee.phone && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(registration.attendee.phone!, 'Phone')}
                            className="text-on-surface-variant hover:text-primary transition-colors"
                            title="Copy phone"
                            aria-label="Copy phone"
                          >
                            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-on-surface">
                        {registration.attendee.phone || (
                          <span className="italic text-on-surface-variant">Not provided</span>
                        )}
                      </p>
                    </div>

                    <div className="rounded-lg bg-surface-container-low p-sm">
                      <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1">
                        <BuildingOfficeIcon className="h-3.5 w-3.5" /> Organization / School
                      </span>
                      <p className="mt-1 text-sm text-on-surface">
                        {registration.attendee.organization || (
                          <span className="italic text-on-surface-variant">Not provided</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Email History. A disclosure rather than a nested dialog:
                  RegistrationDetailsModal already stacks one <dialog> (the
                  receipt lightbox) and native top-layer nesting is janky on
                  Safari, so the resend reveals its input in place. */}
              <div className="rounded-lg border border-outline-variant bg-white p-md">
                <button
                  type="button"
                  onClick={handleToggleEmailHistory}
                  aria-expanded={showEmailHistory}
                  aria-controls="attendee-email-history"
                  className="flex min-h-[48px] w-full items-center justify-between gap-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span>
                    <span className="flex items-center gap-sm">
                      <EnvelopeIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                      <span className="text-base font-semibold text-on-surface">
                        Email History
                      </span>
                      {emailHistory !== null && (
                        <Badge tone="neutral">{emailHistory.length}</Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-on-surface-variant">
                      Everything sent to this attendee, and where it landed
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={`h-5 w-5 shrink-0 text-on-surface-variant transition-transform duration-fast ease-quart motion-reduce:transition-none ${
                      showEmailHistory ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {showEmailHistory && (
                  <div id="attendee-email-history" className="mt-md">
                    {isLoadingEmailHistory ? (
                      <p className="py-md text-center text-sm text-on-surface-variant">
                        Loading email history...
                      </p>
                    ) : !emailHistory || emailHistory.length === 0 ? (
                      <p className="py-md text-center text-sm text-on-surface-variant">
                        No emails have been sent to {registration.attendee.email} yet.
                      </p>
                    ) : (
                      <ul className="space-y-xs">
                        {emailHistory.map((log) => {
                          const isResending = resendingEmailId === log.id;
                          const isOverriding = overrideEmailFor === log.id;
                          return (
                            <li
                              key={log.id}
                              className="rounded-md bg-surface-container-low p-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-sm">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-xs">
                                    <span className="text-sm font-medium text-on-surface">
                                      {EMAIL_TYPE_LABELS[log.type] ?? log.type}
                                    </span>
                                    <Badge tone={log.success ? 'success' : 'danger'}>
                                      {log.success ? 'Sent' : 'Failed'}
                                    </Badge>
                                  </div>
                                  <p className="mt-0.5 text-xs text-on-surface-variant">
                                    {formatDate(log.timestamp)}{' '}
                                    &middot; {log.userEmail}
                                  </p>
                                  {isOverriding && (
                                    <div className="mt-xs flex flex-wrap items-center gap-xs">
                                      <div className="min-w-[200px] flex-1">
                                        <Input
                                          type="email"
                                          value={overrideEmail}
                                          onChange={(e) =>
                                            setOverrideEmail(e.target.value)
                                          }
                                          placeholder="New email address"
                                          aria-label={`Send to a corrected address instead of ${log.userEmail}`}
                                        />
                                      </div>
                                      <Button
                                        variant="filled"
                                        size="sm"
                                        onClick={() => handleResendEmail(log)}
                                        loading={isResending}
                                      >
                                        Send
                                      </Button>
                                      <Button
                                        variant="text"
                                        size="sm"
                                        onClick={() => {
                                          setOverrideEmailFor(null);
                                          setOverrideEmail('');
                                        }}
                                        disabled={isResending}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                <Button
                                  variant="tonal"
                                  size="sm"
                                  onClick={() => {
                                    if (isOverriding) {
                                      handleResendEmail(log);
                                    } else {
                                      setOverrideEmailFor(log.id);
                                      setOverrideEmail('');
                                    }
                                  }}
                                  loading={isResending}
                                  icon={<ArrowPathIcon className="h-4 w-4" />}
                                >
                                  {isOverriding ? 'Resend' : 'Resend / Fix address'}
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Ticket & Pricing Card */}
              <div className="rounded-xl border border-outline-variant bg-surface p-md">
                <div className="flex items-center gap-xs border-b border-outline-variant pb-sm mb-md">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                    <TicketIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-on-surface">
                      Ticket &amp; Pricing
                    </h4>
                    <p className="text-xs text-on-surface-variant">
                      Tier benefits, quantity, and breakdown
                    </p>
                  </div>
                </div>

                <div className="space-y-sm">
                  <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-sm">
                    <div>
                      <span className="text-xs font-medium text-on-surface-variant">Tier</span>
                      <p className="text-sm font-semibold text-on-surface">
                        {ticketType?.name ||
                          registration.pricing?.ticketTypeName ||
                          'General Admission'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-on-surface-variant">Quantity</span>
                      <p className="text-sm font-semibold text-on-surface">
                        {registration.quantity || 1} ticket(s)
                      </p>
                    </div>
                  </div>

                  {ticketType?.description && (
                    <p className="text-xs text-on-surface-variant px-1">
                      {ticketType.description}
                    </p>
                  )}

                  {ticketType?.benefits && ticketType.benefits.length > 0 && (
                    <div className="rounded-lg bg-surface-container-low p-sm space-y-1">
                      <span className="text-xs font-semibold text-on-surface-variant">
                        Included Benefits:
                      </span>
                      <ul className="space-y-1 text-xs text-on-surface">
                        {ticketType.benefits.map((benefit, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <CheckIcon className="h-3.5 w-3.5 text-success shrink-0" />
                            <span>{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Financial Breakdown */}
                  <div className="rounded-lg border border-outline-variant bg-surface p-sm space-y-xs text-xs">
                    {registration.promoCode && (
                      <div className="flex items-center justify-between text-success">
                        <span>Promo Code Applied:</span>
                        <span className="font-mono font-semibold">
                          {registration.promoCode}
                        </span>
                      </div>
                    )}
                    {typeof registration.originalAmount === 'number' && (
                      <div className="flex items-center justify-between text-on-surface-variant">
                        <span>Base Price:</span>
                        <span>{formatCurrency(registration.originalAmount)}</span>
                      </div>
                    )}
                    {typeof registration.discountAmount === 'number' &&
                      registration.discountAmount > 0 && (
                        <div className="flex items-center justify-between text-success">
                          <span>Discount:</span>
                          <span>-{formatCurrency(registration.discountAmount)}</span>
                        </div>
                      )}
                    <div className="flex items-center justify-between border-t border-outline-variant pt-xs text-sm font-semibold text-on-surface">
                      <span>Total Amount:</span>
                      <span className="text-base text-primary">
                        {formatCurrency(
                          registration.totalAmount ?? registration.event.ticketPrice
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (Payment Verification + Custom Responses + Audit) */}
            <div className="space-y-md lg:col-span-5">
              {/* Payment Proof Card */}
              <div className="rounded-xl border border-outline-variant bg-surface p-md">
                <div className="flex items-center gap-xs border-b border-outline-variant pb-sm mb-md">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-container text-on-success-container">
                    <CurrencyDollarIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-on-surface">
                      Payment Verification
                    </h4>
                    <p className="text-xs text-on-surface-variant">
                      Receipt proof &amp; transaction status
                    </p>
                  </div>
                </div>

                <div className="space-y-sm">
                  {/* Status & Reference */}
                  <div className="flex flex-wrap items-center justify-between gap-xs rounded-lg bg-surface-container-low p-sm">
                    <div>
                      <span className="text-xs font-medium text-on-surface-variant">Status</span>
                      <div className="mt-0.5">
                        {paymentView.kind === 'not_required' ? (
                          <Badge tone="neutral">NOT REQUIRED</Badge>
                        ) : (
                          <Badge tone={paymentView.tone}>{paymentView.label}</Badge>
                        )}
                      </div>
                    </div>

                    {registration.paymentProof?.transactionId && (
                      <div className="text-right">
                        <span className="text-xs font-medium text-on-surface-variant">
                          Ref / Trans ID
                        </span>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="font-mono text-xs font-semibold text-on-surface">
                            {registration.paymentProof.transactionId}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                registration.paymentProof!.transactionId!,
                                'Transaction ID'
                              )
                            }
                            className="text-on-surface-variant hover:text-primary transition-colors"
                            title="Copy Transaction ID"
                            aria-label="Copy Transaction ID"
                          >
                            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {registration.paymentProof?.submittedAt && (
                    <p className="text-xs text-on-surface-variant px-1">
                      Submitted on: {formatDate(registration.paymentProof.submittedAt)}
                    </p>
                  )}

                  {/* Payment Receipt Image */}
                  <div className="rounded-lg border border-outline-variant bg-surface-container-lowest p-2">
                    {paymentView.kind === 'not_required' ? (
                      <div className="flex flex-col items-center justify-center p-md text-center text-xs text-on-surface-variant">
                        <CheckCircleIcon className="h-6 w-6 text-success mb-1" />
                        <p>No payment required</p>
                        <p className="text-[11px] mt-0.5">
                          This is a free registration, so there is nothing to verify.
                        </p>
                      </div>
                    ) : isLoadingProofImage ? (
                      <div className="flex flex-col items-center justify-center p-md text-on-surface-variant">
                        <div className="motion-essential animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                        <p className="text-xs">Loading receipt image...</p>
                      </div>
                    ) : resolvedProofUrl && !proofImageError ? (
                      <button
                        type="button"
                        onClick={() => setShowProofLightbox(true)}
                        aria-label="View full payment receipt"
                        className="relative group block w-full overflow-hidden rounded-md border border-outline-variant bg-surface text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                      >
                        <img
                          src={resolvedProofUrl}
                          alt="Payment proof receipt"
                          className="w-full max-h-56 object-contain transition-transform duration-200 group-hover:scale-102"
                          onError={() => setProofImageError(true)}
                        />
                        <div
                          className="absolute inset-0 bg-on-surface/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          aria-hidden="true"
                        >
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-sm py-1 text-xs font-semibold text-on-surface shadow-md">
                            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                            View Full Receipt
                          </span>
                        </div>
                      </button>
                    ) : proofImageError ? (
                      <div className="flex flex-col items-center justify-center p-md text-center text-xs text-on-surface-variant">
                        <span className="text-error font-medium mb-1">Receipt unavailable</span>
                        <p className="text-[11px] text-on-surface-variant truncate max-w-full">
                          Path: {registration.paymentProof?.proofImageUrl || 'N/A'}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-md text-center text-xs text-on-surface-variant">
                        <DocumentTextIcon className="h-6 w-6 text-outline mb-1" />
                        <p>No payment proof attached</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          {registration.registrationType === 'walk-in'
                            ? 'Collected at the door'
                            : registration.paymentStatus === 'paid'
                              ? 'Payment marked as paid'
                              : 'No proof on file'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Custom Form Responses Card */}
              {registration.formSubmission &&
                Object.keys(registration.formSubmission).length > 0 && (
                  <div className="rounded-xl border border-outline-variant bg-surface p-md">
                    <div className="flex items-center gap-xs border-b border-outline-variant pb-sm mb-md">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-high text-on-surface">
                        <DocumentTextIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-on-surface">
                          Custom Form Responses
                        </h4>
                        <p className="text-xs text-on-surface-variant">
                          Attendee answers to registration questions
                        </p>
                      </div>
                    </div>

                    <div className="space-y-xs max-h-60 overflow-y-auto pr-1">
                      {Object.entries(registration.formSubmission).map(([key, val]) => (
                        <div
                          key={key}
                          className="rounded-lg bg-surface-container-low p-sm text-xs"
                        >
                          <span className="font-medium text-on-surface-variant block capitalize">
                            {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                          </span>
                          <span className="text-on-surface font-medium mt-0.5 block break-words">
                            {formatFormResponseValue(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Audit & ID Metadata Card */}
              <div className="rounded-xl border border-outline-variant bg-surface p-md space-y-xs text-xs text-on-surface-variant">
                <div className="flex items-center justify-between">
                  <span>Registration ID:</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-on-surface">{registration.id}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(registration.id, 'Registration ID')}
                      className="hover:text-primary transition-colors"
                      title="Copy ID"
                      aria-label="Copy registration ID"
                    >
                      <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Registered:</span>
                  <span className="text-on-surface">
                    {formatDate(registration.registrationDate)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Venue Check-In:</span>
                  <span className="text-on-surface">
                    {registration.status === 'attended' ? 'Checked in' : 'Not checked in'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Lightbox Modal for Receipt Image */}
      {resolvedProofUrl && (
        <Modal
          open={showProofLightbox}
          onClose={() => setShowProofLightbox(false)}
          title="Payment Receipt"
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <a
                href={resolvedProofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
              >
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                Open Original in New Tab
              </a>
              <Button variant="outlined" size="sm" onClick={() => setShowProofLightbox(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div className="flex justify-center p-2 bg-surface-container-lowest rounded-lg">
            <img
              src={resolvedProofUrl}
              alt="Full receipt"
              className="max-h-[70vh] max-w-full object-contain rounded"
            />
          </div>
        </Modal>
      )}

      {/* Confirmation Modal for Permanent Deletion */}
      <ConfirmationModal
        isOpen={showDeleteConfirm && !isConfirmed}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Registration"
        message={`Are you sure you want to permanently delete registration for "${registration.attendee.name}"? This will delete the record, return ticket capacity to the event, and remove associated payment proofs. This action cannot be undone.`}
        type="danger"
        confirmText="Permanently Delete"
        cancelText="Cancel"
        isLoading={isDeleting}
        onConfirm={handleDeleteRegistration}
      />
    </>
  );
};

export default RegistrationDetailsModal;
