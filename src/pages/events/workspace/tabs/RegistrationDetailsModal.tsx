import React, { useState, useEffect, useMemo } from 'react';
import { useAbility } from '@casl/react';
import { stripFormattedLabelSyntax } from '../../../../components/FormattedLabelText';
import {
  UserIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  TicketIcon,
  CheckIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  ShieldCheckIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EnvelopeIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import {
  Button,
  Modal,
  ConfirmationModal,
  Badge,
  Input,
  Select,
  Textarea,
  type BadgeTone,
} from '../../../../components/UI';
import { RegistrationService } from '../../../../services/registrationService';
import { EmailService, type EmailLog } from '../../../../services/emailService';
import { asRegistration } from '../../../../auth/ability';
import { Event } from '../../../../types';
import { getDownloadUrlFromPath } from '../../../../utils/storageUtils';
import { getRegistrationTotalAmount } from '../../../../utils/pricing';
import { logger } from '../../../../utils/logger';
import { formatDateTime as formatDate } from '../../../../utils/dateUtils';
import {
  extractContactDetailsFromResponses,
  resolveResendTargetEmail,
  validateFormResponses,
  type ResponseValidationErrors,
  type ResponseValue,
} from '../../../../utils/formResponses';
import { APP_URL } from '../../../../config/app';

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
  registrationStatus?: string;
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
  walletPassToken?: string;
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

export interface ResolvedResponseField {
  key: string;
  label: string;
  value: unknown;
  type?: string;
  isCustom?: boolean;
  gridSize?: 'full' | 'half';
}

const isFieldAnswered = (field: ResolvedResponseField): boolean => {
  if (field.value === null || field.value === undefined || field.value === '') return false;
  if (Array.isArray(field.value) && field.value.length === 0) return false;
  return true;
};

const formatFieldValueForCopy = (field: ResolvedResponseField): string => {
  if (!isFieldAnswered(field)) return 'Not provided';
  if (Array.isArray(field.value)) return field.value.join(', ');
  if (typeof field.value === 'boolean') return field.value ? 'Yes' : 'No';
  if (typeof field.value === 'object') {
    const obj = field.value as Record<string, any>;
    if (obj.name && obj.phone) return `${obj.name} (${obj.phone})`;
    return JSON.stringify(field.value);
  }
  return String(field.value);
};

const isCopyableField = (field: ResolvedResponseField): boolean => {
  const normKey = field.key.toLowerCase();
  const normLabel = field.label.toLowerCase();
  const type = field.type;
  return (
    type === 'email' ||
    type === 'phone' ||
    normKey === '3' ||
    normKey.includes('email') ||
    normKey.includes('phone') ||
    normLabel.includes('email') ||
    normLabel.includes('phone')
  );
};

const getFieldIcon = (field: ResolvedResponseField) => {
  const normKey = field.key.toLowerCase();
  const normLabel = field.label.toLowerCase();
  const type = field.type;

  if (type === 'email' || normKey.includes('email') || normLabel.includes('email')) {
    return <EnvelopeIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />;
  }
  if (
    type === 'phone' ||
    normKey === '3' ||
    normKey.includes('phone') ||
    normKey.includes('mobile') ||
    normKey.includes('contact') ||
    normLabel.includes('phone') ||
    normLabel.includes('mobile') ||
    normLabel.includes('contact')
  ) {
    return <PhoneIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />;
  }
  if (normKey.includes('name') || normKey === '1' || normLabel.includes('name')) {
    return <UserIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />;
  }
  if (
    normKey.includes('organization') ||
    normKey.includes('company') ||
    normKey.includes('school') ||
    normLabel.includes('organization') ||
    normLabel.includes('company') ||
    normLabel.includes('school') ||
    normLabel.includes('university')
  ) {
    return <BuildingOfficeIcon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />;
  }
  return <DocumentTextIcon className="h-3.5 w-3.5 shrink-0 text-on-surface-variant/70" aria-hidden="true" />;
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

  // Admin-only editing of the attendee's form responses. The draft holds raw
  // customResponses values keyed by form field id; errors mirror that shape.
  const [isEditingResponses, setIsEditingResponses] = useState(false);
  const [responsesDraft, setResponsesDraft] = useState<Record<string, ResponseValue>>({});
  const [responseFieldErrors, setResponseFieldErrors] = useState<ResponseValidationErrors>({});
  const [isSavingResponses, setIsSavingResponses] = useState(false);

  // Registration responses search, filter, and progressive disclosure
  const [responseSearchQuery, setResponseSearchQuery] = useState('');
  const [responseFilter, setResponseFilter] = useState<'all' | 'answered' | 'unanswered'>('all');
  const [isResponsesExpanded, setIsResponsesExpanded] = useState(false);

  // Ticket tier transfer state
  const [targetTicketTypeId, setTargetTicketTypeId] = useState('');
  const [isTransferringTicket, setIsTransferringTicket] = useState(false);

  // Reset filter & expand state when registration changes. Email history is
  // included: the modal stays mounted while the attendees list swaps the
  // registration prop, and a cached history from the previous attendee must
  // never be shown under the new one (fetch-once guard would skip the refetch).
  useEffect(() => {
    setResponseSearchQuery('');
    setResponseFilter('all');
    setIsResponsesExpanded(false);
    setTargetTicketTypeId(registration?.ticketTypeId || '');
    setIsEditingResponses(false);
    setResponsesDraft({});
    setResponseFieldErrors({});
    setShowEmailHistory(false);
    setEmailHistory(null);
    setIsLoadingEmailHistory(false);
    setResendingEmailId(null);
  }, [registration?.id, registration?.ticketTypeId]);

  const [isCopyingPassLink, setIsCopyingPassLink] = useState(false);

  const currentEvent = events.find((e) => e.id === registration?.event.id);

  const effectivePhone = useMemo(() => {
    if (registration?.attendee.phone) return registration.attendee.phone;
    if (!registration?.formSubmission) return undefined;
    const found = Object.entries(registration.formSubmission).find(([k, v]) => {
      if (!v || typeof v !== 'string') return false;
      const fieldDef = currentEvent?.registrationForm?.find((f) => f.id === k);
      const label = fieldDef ? fieldDef.label.toLowerCase() : k.toLowerCase();
      return (
        fieldDef?.type === 'phone' ||
        k === '3' ||
        k.toLowerCase().includes('phone') ||
        k.toLowerCase().includes('mobile') ||
        (k.toLowerCase().includes('contact') && !k.toLowerCase().includes('emergency')) ||
        label.includes('phone') ||
        label.includes('mobile') ||
        (label.includes('contact') && !label.includes('emergency'))
      );
    });
    return found ? String(found[1]) : undefined;
  }, [registration?.attendee.phone, registration?.formSubmission, currentEvent?.registrationForm]);

  const effectiveOrg = useMemo(() => {
    if (registration?.attendee.organization) return registration.attendee.organization;
    if (!registration?.formSubmission) return undefined;
    const found = Object.entries(registration.formSubmission).find(([k, v]) => {
      if (!v || typeof v !== 'string') return false;
      const fieldDef = currentEvent?.registrationForm?.find((f) => f.id === k);
      const label = fieldDef ? fieldDef.label.toLowerCase() : k.toLowerCase();
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
    });
    return found ? String(found[1]) : undefined;
  }, [registration?.attendee.organization, registration?.formSubmission, currentEvent?.registrationForm]);

  // Resolve unified registration responses in the exact sequence configured in the Event Form Builder
  const unifiedResponses = useMemo<ResolvedResponseField[]>(() => {
    if (!registration) return [];

    const responses = (registration.formSubmission || {}) as Record<string, any>;
    const formFields = currentEvent?.registrationForm || [];
    const result: ResolvedResponseField[] = [];
    const handledKeys = new Set<string>();

    if (formFields.length > 0) {
      // 1. Process all fields from the Event's Form Builder in their configured order
      for (const field of formFields) {
        if (field.type === 'spacer') continue;

        handledKeys.add(field.id);
        handledKeys.add(field.id.toLowerCase());

        let val = responses[field.id] ?? responses[field.id.toLowerCase()];

        // If not in responses, check if it maps to a standard attendee property
        if (val === undefined || val === null || val === '') {
          const rawLabel = stripFormattedLabelSyntax(field.label).toLowerCase();
          const rawId = field.id.toLowerCase();
          if (
            field.type === 'email' ||
            rawId.includes('email') ||
            rawLabel.includes('email')
          ) {
            val = registration.attendee.email;
          } else if (
            rawId.includes('name') ||
            rawId === '1' ||
            rawLabel.includes('name')
          ) {
            val = registration.attendee.name;
          } else if (
            field.type === 'phone' ||
            rawId === '3' ||
            rawId.includes('phone') ||
            rawLabel.includes('phone') ||
            rawLabel.includes('mobile') ||
            ((rawId.includes('contact') || rawLabel.includes('contact')) &&
             !rawId.includes('emergency') &&
             !rawLabel.includes('emergency'))
          ) {
            val = registration.attendee.phone || effectivePhone;
          } else if (
            rawId.includes('organization') ||
            rawId.includes('company') ||
            rawId.includes('school') ||
            rawLabel.includes('organization') ||
            rawLabel.includes('company') ||
            rawLabel.includes('school') ||
            rawLabel.includes('university')
          ) {
            val = registration.attendee.organization || effectiveOrg;
          }
        }

        result.push({
          key: field.id,
          label: stripFormattedLabelSyntax(field.label),
          value: val,
          type: field.type,
          gridSize: field.gridSize || (field.type === 'textarea' ? 'full' : 'half'),
        });
      }

      // Check if primary contact fields (Name & Email) were omitted from the custom form definition
      const hasEmailField = formFields.some(
        (f) => f.type === 'email' || f.id.toLowerCase().includes('email') || f.label.toLowerCase().includes('email')
      );
      if (!hasEmailField && registration.attendee.email) {
        result.unshift({
          key: 'email',
          label: 'Email Address',
          value: registration.attendee.email,
          type: 'email',
          gridSize: 'half',
        });
      }

      const hasNameField = formFields.some(
        (f) => f.id.toLowerCase().includes('name') || f.label.toLowerCase().includes('name')
      );
      if (!hasNameField && registration.attendee.name) {
        result.unshift({
          key: 'name',
          label: 'Full Name',
          value: registration.attendee.name,
          type: 'text',
          gridSize: 'half',
        });
      }
    } else {
      // 2. Fallback when event does not have a custom form configured
      result.push(
        {
          key: 'name',
          label: 'Full Name',
          value: registration.attendee.name,
          type: 'text',
          gridSize: 'half',
        },
        {
          key: 'email',
          label: 'Email Address',
          value: registration.attendee.email,
          type: 'email',
          gridSize: 'half',
        },
        {
          key: 'phone',
          label: 'Phone Number',
          value: registration.attendee.phone || effectivePhone,
          type: 'phone',
          gridSize: 'half',
        },
        {
          key: 'organization',
          label: 'Organization / School',
          value: registration.attendee.organization || effectiveOrg,
          type: 'text',
          gridSize: 'half',
        }
      );
    }

    // 3. Append any legacy/unmapped responses from formSubmission that weren't in form definition
    for (const [key, val] of Object.entries(responses)) {
      if (
        !handledKeys.has(key) &&
        !handledKeys.has(key.toLowerCase()) &&
        val !== null &&
        val !== undefined &&
        val !== ''
      ) {
        if (
          (key === '1' && registration.attendee.name) ||
          (key === '2' && registration.attendee.email) ||
          (key === '3' && (registration.attendee.phone || effectivePhone))
        ) {
          continue;
        }

        const humanLabel = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ');
        result.push({
          key,
          label: humanLabel.charAt(0).toUpperCase() + humanLabel.slice(1),
          value: val,
          isCustom: true,
          gridSize: typeof val === 'string' && val.length > 50 ? 'full' : 'half',
        });
      }
    }

    return result;
  }, [registration, currentEvent?.registrationForm, effectivePhone, effectiveOrg]);

  // The attendee's current effective email: the form response when one exists
  // (an admin may have corrected it there), otherwise the registration's
  // resolved attendee email. Feeds resend targeting — no manual override prompt.
  const currentResponseEmail = useMemo(() => {
    const emailField = unifiedResponses.find(
      (f) =>
        f.type === 'email' ||
        f.key.toLowerCase().includes('email') ||
        f.label.toLowerCase().includes('email')
    );
    const fromResponse = typeof emailField?.value === 'string' ? emailField.value.trim() : '';
    return fromResponse || registration?.attendee.email || '';
  }, [unifiedResponses, registration?.attendee.email]);

  const answeredCount = useMemo(() => {
    return unifiedResponses.filter(isFieldAnswered).length;
  }, [unifiedResponses]);

  const unansweredCount = unifiedResponses.length - answeredCount;

  const filteredResponses = useMemo(() => {
    const query = responseSearchQuery.trim().toLowerCase();

    return unifiedResponses.filter((field) => {
      const answered = isFieldAnswered(field);
      if (responseFilter === 'answered' && !answered) return false;
      if (responseFilter === 'unanswered' && answered) return false;

      if (!query) return true;

      const labelMatch = field.label.toLowerCase().includes(query);
      const valueStr = formatFieldValueForCopy(field).toLowerCase();
      const valueMatch = valueStr.includes(query);

      return labelMatch || valueMatch;
    });
  }, [unifiedResponses, responseSearchQuery, responseFilter]);

  const isFilteringOrSearching = !!responseSearchQuery.trim() || responseFilter !== 'all';

  const handleCopyAllResponses = () => {
    if (unifiedResponses.length === 0 || !registration) return;
    const lines = [
      `Registration Responses — ${registration.attendee.name} (${registration.event.title})`,
      `Submitted: ${formatDate(registration.registrationDate)}`,
      '',
      ...unifiedResponses.map((f) => `• ${f.label}: ${formatFieldValueForCopy(f)}`),
    ];
    navigator.clipboard
      .writeText(lines.join('\n'))
      .then(() => toast.success('All responses copied to clipboard'))
      .catch(() => toast.error('Failed to copy to clipboard. Please try again.'));
  };

  const renderResponseValue = (field: ResolvedResponseField) => {
    const { value } = field;

    if (value === null || value === undefined || value === '') {
      return <span className="italic text-on-surface-variant/70">Not provided</span>;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="italic text-on-surface-variant/70">None selected</span>;
      }
      return (
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-md bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface"
            >
              {String(item)}
            </span>
          ))}
        </div>
      );
    }

    if (typeof value === 'boolean') {
      return (
        <div className="mt-1">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
              value
                ? 'bg-success-container text-on-success-container'
                : 'bg-surface-container-high text-on-surface-variant'
            }`}
          >
            {value ? 'Yes' : 'No'}
          </span>
        </div>
      );
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, any>;
      if (obj.name && obj.phone) {
        return (
          <p className="mt-1 text-sm font-semibold text-on-surface">
            {obj.name} <span className="text-xs font-normal text-on-surface-variant">({obj.phone})</span>
          </p>
        );
      }
      return (
        <p className="mt-1 text-xs font-mono text-on-surface bg-surface-container-high rounded p-1.5 break-all">
          {JSON.stringify(value)}
        </p>
      );
    }

    const strVal = String(value);

    if (strVal.startsWith('http://') || strVal.startsWith('https://')) {
      return (
        <a
          href={strVal}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline break-all"
        >
          <span>{strVal}</span>
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>
      );
    }

    return (
      <p className="mt-1 text-sm font-semibold text-on-surface break-words whitespace-pre-wrap">
        {strVal}
      </p>
    );
  };

  // Sync state whenever registration changes
  useEffect(() => {
    if (registration) {
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

  const registrationEntity = asRegistration(registration as any);
  const isAdmin = ability.can('manage', 'all');
  const canDelete = isAdmin || ability.can('delete', registrationEntity) || ability.can('delete', 'Registration');
  const canUpdate = ability.can('update', registrationEntity);
  const canTransferTicket = ability.can('transfer', registrationEntity);
  const canVerifyPayment = ability.can('update', 'PaymentProof');
  // Admin-only correction of attendee form responses. Mirrors the
  // firestore.rules clause that rejects customResponses changes for
  // non-admins (docs/Rules.md §2.0).
  const canEditResponses = ability.can('editResponses', registrationEntity);
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

  const renderFieldTile = (field: ResolvedResponseField) => {
    const answered = isFieldAnswered(field);
    return (
      <div
        key={field.key}
        className={`rounded-lg bg-surface-container-low p-sm transition-colors duration-fast ${
          field.gridSize === 'full' ? 'sm:col-span-2' : 'sm:col-span-1'
        } ${!answered ? 'opacity-85' : ''}`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-medium text-on-surface-variant flex items-center gap-1 min-w-0">
            {getFieldIcon(field)}
            <span className="truncate" title={field.label}>{field.label}</span>
            {field.isCustom && (
              <span className="shrink-0 rounded bg-surface-container-highest px-1 py-0.2 text-[10px] text-on-surface-variant">
                Additional
              </span>
            )}
          </span>
          {field.value && isCopyableField(field) && (
            <button
              type="button"
              onClick={() => copyToClipboard(String(field.value), field.label)}
              className="text-on-surface-variant hover:text-primary transition-colors p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary shrink-0"
              title={`Copy ${field.label}`}
              aria-label={`Copy ${field.label}`}
            >
              <ClipboardDocumentIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {renderResponseValue(field)}
      </div>
    );
  };

  // --- Admin-only form response editing -------------------------------------
  // Gate: CASL 'editResponses' (admins only). The firestore.rules organizer
  // update clause rejects customResponses changes, so this UI is the UX half
  // of that contract, never the enforcement.

  const startEditingResponses = () => {
    if (!registration) return;
    const raw = { ...(registration.formSubmission || {}) } as Record<string, ResponseValue>;
    const formFields = currentEvent?.registrationForm || [];

    // Prefill answers that were resolved from attendee fallbacks (legacy
    // registrations store contact details only in userDetails) so the draft
    // shows the attendee's effective answers, and saving makes the responses
    // self-contained.
    for (const field of formFields) {
      if (field.type === 'spacer' || field.type === 'file') continue;
      const existing = raw[field.id] ?? raw[field.id.toLowerCase()];
      if (existing === undefined || existing === null || existing === '') {
        const resolved = unifiedResponses.find((f) => f.key === field.id)?.value;
        if (typeof resolved === 'string' && resolved.trim()) {
          raw[field.id] = resolved;
        } else if (typeof resolved === 'number') {
          raw[field.id] = resolved;
        }
      }
    }

    setResponsesDraft(raw);
    setResponseFieldErrors({});
    setIsEditingResponses(true);
  };

  const cancelEditingResponses = () => {
    setIsEditingResponses(false);
    setResponsesDraft({});
    setResponseFieldErrors({});
  };

  const setDraftValue = (key: string, value: ResponseValue) => {
    setResponsesDraft((prev) => ({ ...prev, [key]: value }));
    setResponseFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const toggleDraftArrayValue = (key: string, option: string) => {
    setResponsesDraft((prev) => {
      const current = Array.isArray(prev[key]) ? (prev[key] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((v) => v !== option)
        : [...current, option];
      return { ...prev, [key]: next };
    });
    setResponseFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSaveResponses = async () => {
    if (!registration) return;
    const formFields = currentEvent?.registrationForm || [];

    // Enforce the form's own rules on save (required fields, email/phone
    // formats, lengths) — the service re-validates as defence in depth.
    const errors = validateFormResponses(responsesDraft, formFields);
    if (Object.keys(errors).length > 0) {
      setResponseFieldErrors(errors);
      toast.error('Please fix the highlighted responses before saving.');
      return;
    }

    try {
      setIsSavingResponses(true);
      await RegistrationService.updateRegistrationFormResponses(
        registration.id,
        registration.event.id,
        responsesDraft,
        formFields
      );

      // Optimistic local update so the parent list and this modal reflect the
      // corrected answers (and synced contact details) immediately.
      const details = extractContactDetailsFromResponses(responsesDraft, formFields);
      onUpdateRegistration({
        ...registration,
        attendee: {
          ...registration.attendee,
          name: details.name?.trim() || registration.attendee.name,
          email: details.email?.trim() || registration.attendee.email,
          phone:
            'phone' in details
              ? details.phone?.trim() || undefined
              : registration.attendee.phone,
        },
        formSubmission: { ...responsesDraft },
      });

      toast.success('Form responses updated');
      cancelEditingResponses();
    } catch (error: any) {
      logger.error('Error updating form responses:', error);
      toast.error(error?.message || 'Failed to update form responses. Please try again.');
    } finally {
      setIsSavingResponses(false);
    }
  };

  const renderResponseEditor = (field: ResolvedResponseField) => {
    const fieldDef = currentEvent?.registrationForm?.find((f) => f.id === field.key);
    const error = responseFieldErrors[field.key];
    const value = responsesDraft[field.key];
    const inputId = `response-edit-${field.key}`;

    // The Input/Textarea/Select primitives own error styling and the
    // aria-invalid/aria-describedby wiring via their `error` prop — pass the
    // message through, don't hand-roll ARIA. This paragraph covers the bare
    // checkbox group, which has no primitive to carry it.
    const renderError = () =>
      error ? (
        <p className="mt-0.5 text-xs text-error" role="alert">
          {error}
        </p>
      ) : null;

    let editor: React.ReactNode;
    if (!fieldDef) {
      // Legacy / unmapped response: free-form text edit.
      editor = (
        <Input
          id={inputId}
          error={error}
          type="text"
          value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
          onChange={(e) => setDraftValue(field.key, e.target.value)}
        />
      );
    } else {
      switch (fieldDef.type) {
        case 'textarea':
          editor = (
            <Textarea
              id={inputId}
              error={error}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => setDraftValue(field.key, e.target.value)}
            />
          );
          break;
        case 'email':
          editor = (
            <Input
              id={inputId}
              error={error}
              type="email"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => setDraftValue(field.key, e.target.value)}
            />
          );
          break;
        case 'phone':
          editor = (
            <Input
              id={inputId}
              error={error}
              type="tel"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => setDraftValue(field.key, e.target.value)}
            />
          );
          break;
        case 'number':
        case 'rating':
          editor = (
            <Input
              id={inputId}
              error={error}
              type="number"
              min={fieldDef.validation?.min}
              max={fieldDef.validation?.max}
              value={typeof value === 'number' ? value : typeof value === 'string' && value ? value : ''}
              onChange={(e) =>
                setDraftValue(field.key, e.target.value === '' ? '' : Number(e.target.value))
              }
            />
          );
          break;
        case 'date':
          editor = (
            <Input
              id={inputId}
              error={error}
              type="date"
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => setDraftValue(field.key, e.target.value)}
            />
          );
          break;
        case 'select':
        case 'radio':
          editor = (
            <Select
              id={inputId}
              error={error}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => setDraftValue(field.key, e.target.value)}
              options={[
                { value: '', label: '—' },
                ...(fieldDef.options || []).map((opt) => ({ value: opt, label: opt })),
              ]}
            />
          );
          break;
        case 'multiselect':
        case 'checkbox': {
          const options = fieldDef.options || [];
          if (options.length === 0) {
            // Bare checkbox: boolean value.
            editor = (
              <label htmlFor={inputId} className="flex min-h-[36px] items-center gap-2 text-xs text-on-surface">
                <input
                  id={inputId}
                  type="checkbox"
                  checked={value === true}
                  onChange={(e) => setDraftValue(field.key, e.target.checked)}
                  className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                />
                Checked
              </label>
            );
          } else {
            editor = (
              <div className="space-y-1" role="group" aria-label={field.label}>
                {options.map((opt, optIndex) => (
                  <label
                    key={opt}
                    htmlFor={`${inputId}-${optIndex}`}
                    className="flex min-h-[32px] items-center gap-2 text-xs text-on-surface"
                  >
                    <input
                      id={`${inputId}-${optIndex}`}
                      type="checkbox"
                      checked={Array.isArray(value) && value.includes(opt)}
                      onChange={() => toggleDraftArrayValue(field.key, opt)}
                      className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            );
          }
          break;
        }
        case 'file':
          editor = (
            <p className="text-xs text-on-surface-variant">
              File uploads cannot be edited here.
            </p>
          );
          break;
        default:
          editor = (
            <Input
              id={inputId}
              error={error}
              type="text"
              value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
              onChange={(e) => setDraftValue(field.key, e.target.value)}
            />
          );
      }
    }

    return (
      <div
        key={field.key}
        className={`rounded-lg bg-surface-container-low p-sm ${
          field.gridSize === 'full' ? 'sm:col-span-2' : 'sm:col-span-1'
        }`}
      >
        <label
          htmlFor={inputId}
          className="flex items-center gap-1 text-xs font-medium text-on-surface-variant"
        >
          {getFieldIcon(field)}
          <span className="truncate" title={field.label}>{field.label}</span>
          {fieldDef?.required && <span className="text-error">*</span>}
        </label>
        <div className="mt-1">{editor}</div>
        {renderError()}
      </div>
    );
  };

  // While editing, every tile grid renders the editors instead of the tiles.
  const renderResponseTile = (field: ResolvedResponseField) =>
    isEditingResponses ? renderResponseEditor(field) : renderFieldTile(field);

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

  const handleCopyPassLink = async () => {
    if (!registration?.id || isCopyingPassLink) return;
    setIsCopyingPassLink(true);
    try {
      const resolvedToken = await RegistrationService.ensureWalletPassToken(
        registration.id,
        registration.walletPassToken
      );
      registration.walletPassToken = resolvedToken;
      const passUrl = `${APP_URL}/ticket?reg=${encodeURIComponent(registration.id)}&token=${encodeURIComponent(resolvedToken)}`;

      let copied = false;
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(passUrl);
          copied = true;
        } catch {
          copied = false;
        }
      }

      if (!copied && typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = passUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      if (copied) {
        toast.success('Ticket pass link copied to clipboard');
      } else {
        toast.error('Failed to copy pass link. Please try again.');
      }
    } catch {
      toast.error('Failed to generate or copy pass link. Please try again.');
    } finally {
      setIsCopyingPassLink(false);
    }
  };

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
      onUpdateRegistration({
        ...registration,
        status: 'approved',
        registrationStatus: 'approved',
        ...(isFree ? { paymentStatus: 'paid' as const } : {})
      });
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
      onUpdateRegistration({
        ...registration,
        status: 'rejected',
        registrationStatus: 'rejected'
      });
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
      // Keyed by registrationId, not the email address: history follows the
      // registration even after an admin corrects the attendee's email.
      const logs = await EmailService.getAttendeeEmails(
        registration.event.id,
        registration.id
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
    // Target = the attendee's current form-response email (falling back to the
    // registration's resolved email, then the original log recipient). No
    // manual override prompt: if the address was wrong, fix it in the form
    // responses (admin edit) and resend — the correction lives in one place.
    const target = resolveResendTargetEmail(log.userEmail, currentResponseEmail);
    const corrected = target !== log.userEmail;

    try {
      setResendingEmailId(log.id);
      const result = await EmailService.resendEmail(
        log,
        corrected ? target : undefined
      );
      if (result.success) {
        toast.success(
          corrected ? `Email resent to ${target}` : 'Email resent'
        );
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
    if (!isAdmin && isConfirmed) {
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

  const handleTransferTicketTier = async () => {
    if (!canTransferTicket) {
      toast.error('Only platform administrators can transfer ticket tiers.');
      return;
    }
    if (!targetTicketTypeId || targetTicketTypeId === registration.ticketTypeId) {
      return;
    }
    try {
      setIsTransferringTicket(true);
      const result = await RegistrationService.transferTicketType({
        registrationId: registration.id,
        targetTicketTypeId,
        forceCapacity: isAdmin,
      });

      if (result.alreadyOnTarget) {
        toast('Attendee is already on that ticket tier.');
        return;
      }

      onUpdateRegistration({
        ...registration,
        ticketTypeId: result.targetTicketTypeId,
        originalAmount: result.originalAmount,
        discountAmount: result.discountAmount,
        totalAmount: result.totalAmount,
        pricing: {
          ...registration.pricing,
          ...result.pricing,
          ticketTypeName: result.targetTicketTypeName,
        },
      });
      toast.success(`Transferred to ${result.targetTicketTypeName}`);
    } catch (error: any) {
      logger.error('Error transferring ticket tier:', error);
      toast.error(error?.message || 'Failed to transfer ticket tier. Please try again.');
    } finally {
      setIsTransferringTicket(false);
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
              disabled={isProcessingAction || (!isAdmin && isConfirmed) || !canDelete}
              title={
                !canDelete
                  ? 'Delete permission required'
                  : !isAdmin && isConfirmed
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
                disabled={isAlreadyAccepted || !canUpdate}
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
                disabled={isAlreadyAccepted || !canUpdate || (!isFree && hasPendingProof && !canVerifyPayment)}
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

              {isConfirmed && canUpdate && (
                <Button
                  variant="outlined"
                  size="sm"
                  loading={isCopyingPassLink}
                  onClick={handleCopyPassLink}
                  title="Copy digital ticket pass link for attendee"
                  icon={<TicketIcon className="h-4 w-4 text-primary" />}
                >
                  Copy Pass Link
                </Button>
              )}

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
                  <p className="text-xs text-on-surface-variant flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="font-medium text-on-surface">{registration.attendee.email}</span>
                    <span>•</span>
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
            {/* Left Column (Registration Responses + Email History) */}
            <div className="space-y-md lg:col-span-7">
              {/* Registration Responses Card */}
              <div className="rounded-xl border border-outline-variant bg-surface p-md">
                {/* Header with Title, Answered Counter, and Copy All */}
                <div className="flex flex-wrap items-center justify-between gap-xs border-b border-outline-variant pb-sm mb-md">
                  <div className="flex items-center gap-xs">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary-container shrink-0">
                      <DocumentTextIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-on-surface">
                          Registration Responses
                        </h4>
                        {unifiedResponses.length > 0 && (
                          <span className="text-xs text-on-surface-variant font-medium">
                            ({answeredCount}/{unifiedResponses.length} answered)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant">
                        Answers submitted via the registration form
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEditResponses && unifiedResponses.length > 0 && (
                      isEditingResponses ? (
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="tonal"
                            size="sm"
                            onClick={handleSaveResponses}
                            loading={isSavingResponses}
                            icon={<CheckIcon className="h-4 w-4" />}
                          >
                            Save
                          </Button>
                          <Button
                            variant="text"
                            size="sm"
                            onClick={cancelEditingResponses}
                            disabled={isSavingResponses}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={startEditingResponses}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
                          title="Edit form responses (admin)"
                          aria-label="Edit form responses"
                        >
                          <PencilSquareIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                      )
                    )}
                    {unifiedResponses.length > 0 && !isEditingResponses && (
                      <button
                        type="button"
                        onClick={handleCopyAllResponses}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
                        title="Copy all responses to clipboard"
                        aria-label="Copy all responses to clipboard"
                      >
                        <ClipboardDocumentListIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span>Copy All</span>
                      </button>
                    )}
                    <Badge tone="neutral">
                      {unifiedResponses.length} {unifiedResponses.length === 1 ? 'Field' : 'Fields'}
                    </Badge>
                  </div>
                </div>

                {/* Search & Filter Controls (Rendered when form has more than 4 fields) */}
                {unifiedResponses.length > 4 && (
                  <div className="mb-md space-y-2">
                    <div className="relative">
                      <MagnifyingGlassIcon
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant h-4 w-4"
                        aria-hidden="true"
                      />
                      <input
                        type="text"
                        placeholder="Search questions or answers..."
                        value={responseSearchQuery}
                        onChange={(e) => setResponseSearchQuery(e.target.value)}
                        className="w-full min-h-[40px] h-10 pl-9 pr-8 text-xs bg-surface-container-low text-on-surface border border-outline-variant rounded-lg placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                        aria-label="Search registration questions or answers"
                      />
                      {responseSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setResponseSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-on-surface-variant hover:text-on-surface focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                          aria-label="Clear search"
                        >
                          <XMarkIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter responses">
                      <button
                        type="button"
                        role="tab"
                        aria-selected={responseFilter === 'all'}
                        onClick={() => setResponseFilter('all')}
                        className={`inline-flex min-h-[32px] items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          responseFilter === 'all'
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/60'
                        }`}
                      >
                        <span>All</span>
                        <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                          responseFilter === 'all' ? 'bg-primary-hover text-white' : 'bg-surface-container-highest text-on-surface'
                        }`}>
                          {unifiedResponses.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        role="tab"
                        aria-selected={responseFilter === 'answered'}
                        onClick={() => setResponseFilter('answered')}
                        className={`inline-flex min-h-[32px] items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          responseFilter === 'answered'
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/60'
                        }`}
                      >
                        <span>Answered</span>
                        <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                          responseFilter === 'answered' ? 'bg-primary-hover text-white' : 'bg-surface-container-highest text-on-surface'
                        }`}>
                          {answeredCount}
                        </span>
                      </button>

                      {unansweredCount > 0 && (
                        <button
                          type="button"
                          role="tab"
                          aria-selected={responseFilter === 'unanswered'}
                          onClick={() => setResponseFilter('unanswered')}
                          className={`inline-flex min-h-[32px] items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            responseFilter === 'unanswered'
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/60'
                          }`}
                        >
                          <span>Unanswered</span>
                          <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-semibold ${
                            responseFilter === 'unanswered' ? 'bg-primary-hover text-white' : 'bg-surface-container-highest text-on-surface'
                          }`}>
                            {unansweredCount}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Content: Empty state / Filtered results / Progressive disclosure */}
                {unifiedResponses.length === 0 ? (
                  <div className="py-md text-center text-xs text-on-surface-variant">
                    No form responses on file.
                  </div>
                ) : isFilteringOrSearching ? (
                  filteredResponses.length === 0 ? (
                    <div className="py-lg text-center rounded-lg border border-dashed border-outline-variant/80 bg-surface-container-low/50 p-md">
                      <p className="text-xs text-on-surface-variant">
                        No responses match {responseSearchQuery ? `"${responseSearchQuery}"` : 'the selected filter'}.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setResponseSearchQuery('');
                          setResponseFilter('all');
                        }}
                        className="mt-2 text-xs font-semibold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
                      >
                        Reset search & filters
                      </button>
                    </div>
                  ) : (
                    <div className="max-h-[460px] overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                        {filteredResponses.map(renderResponseTile)}
                      </div>
                    </div>
                  )
                ) : unifiedResponses.length <= 6 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                    {unifiedResponses.map(renderResponseTile)}
                  </div>
                ) : !isResponsesExpanded ? (
                  <div className="relative">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                      {unifiedResponses.slice(0, 6).map(renderResponseTile)}
                    </div>
                    {/* Gradient Fade Mask */}
                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface via-surface/90 to-transparent pointer-events-none rounded-b-xl" />
                    <div className="relative -mt-6 text-center z-10">
                      <button
                        type="button"
                        onClick={() => setIsResponsesExpanded(true)}
                        className="inline-flex min-h-[44px] items-center gap-2 px-4 py-2 rounded-full bg-surface border border-outline-variant text-xs font-semibold text-primary shadow-sm hover:bg-primary-container/20 hover:border-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-[color,background-color,border-color,transform] duration-short2 ease-emphasized-standard active:scale-[0.98]"
                        aria-label={`View all ${unifiedResponses.length} responses, ${unifiedResponses.length - 6} more`}
                      >
                        <span>View All {unifiedResponses.length} Responses</span>
                        <span className="text-[11px] font-normal text-on-surface-variant">
                          (+{unifiedResponses.length - 6} more)
                        </span>
                        <ChevronDownIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-sm">
                    <div className="max-h-[460px] overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                        {unifiedResponses.map(renderResponseTile)}
                      </div>
                    </div>
                    <div className="pt-xs text-center border-t border-outline-variant/40">
                      <button
                        type="button"
                        onClick={() => setIsResponsesExpanded(false)}
                        className="inline-flex min-h-[44px] items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
                      >
                        <span>Show Less</span>
                        <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Email History. A disclosure rather than a nested dialog:
                  RegistrationDetailsModal already stacks one <dialog> (the
                  receipt lightbox) and native top-layer nesting is janky on
                  Safari, so the resend happens in place. Resend targets the
                  attendee's current form-response email — correct the address
                  via the admin response editor above, not here. */}
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
                                </div>
                                <Button
                                  variant="tonal"
                                  size="sm"
                                  onClick={() => handleResendEmail(log)}
                                  loading={isResending}
                                  icon={<ArrowPathIcon className="h-4 w-4" />}
                                >
                                  Resend
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

                  {canTransferTicket && (currentEvent?.ticketTypes?.length ?? 0) > 1 && (
                    <div className="rounded-lg border border-outline-variant/80 bg-surface-container-lowest p-sm space-y-2">
                      <label
                        htmlFor="transfer-ticket-tier-select"
                        className="block text-xs font-medium text-on-surface-variant"
                      >
                        Transfer Ticket Tier
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <Select
                            id="transfer-ticket-tier-select"
                            size="sm"
                            value={targetTicketTypeId || registration.ticketTypeId || ''}
                            onChange={(e) => setTargetTicketTypeId(e.target.value)}
                            disabled={isTransferringTicket}
                            aria-label="Select target ticket tier"
                          >
                            {currentEvent?.ticketTypes?.map((tt) => (
                              <option key={tt.id} value={tt.id}>
                                {tt.name} (₱{(tt.price || 0).toLocaleString()})
                              </option>
                            ))}
                          </Select>
                        </div>
                        <Button
                          variant="tonal"
                          size="sm"
                          onClick={handleTransferTicketTier}
                          loading={isTransferringTicket}
                          disabled={
                            !targetTicketTypeId ||
                            targetTicketTypeId === registration.ticketTypeId
                          }
                          icon={<ArrowPathIcon className="h-4 w-4" />}
                        >
                          Transfer
                        </Button>
                      </div>
                    </div>
                  )}

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
        isOpen={showDeleteConfirm && (isAdmin || !isConfirmed)}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Registration"
        message={
          isConfirmed && isAdmin
            ? `⚠️ Admin Override: Registration for "${registration.attendee.name}" is confirmed or attended. Are you sure you want to permanently delete this registration? This will delete the record, return ticket capacity to the event, and remove associated payment proofs. This action cannot be undone.`
            : `Are you sure you want to permanently delete registration for "${registration.attendee.name}"? This will delete the record, return ticket capacity to the event, and remove associated payment proofs. This action cannot be undone.`
        }
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
