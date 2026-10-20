import { Timestamp } from 'firebase/firestore';

/**
 * The role vocabulary, in one place.
 *
 * This union used to be re-declared inline in six places, which is why role
 * checks had drifted into `role === 'admin'` comparisons scattered across
 * eleven pages. `isRole` exists for the one place the value is genuinely
 * untrusted: AuthContext reads a Firestore document and has to decide
 * whether the stored string is a role at all before trusting it.
 */
export const ROLES = ['organizer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

// User Permissions (Hybrid RBAC + ABPAC)
export interface OrganizerPermissions {
  events?: {
    canCreate?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
  };
  attendees?: {
    canRead?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
    canExport?: boolean;
  };
  checkin?: {
    canCheckIn?: boolean;
  };
  payments?: {
    canVerify?: boolean;
  };
  certificates?: {
    canManage?: boolean;
  };
  feedback?: {
    canRead?: boolean;
  };
}

export const DEFAULT_ORGANIZER_PERMISSIONS: OrganizerPermissions = {
  events: { canCreate: true, canUpdate: true, canDelete: true },
  attendees: { canRead: true, canUpdate: true, canDelete: true, canExport: true },
  checkin: { canCheckIn: true },
  payments: { canVerify: true },
  certificates: { canManage: true },
  feedback: { canRead: true },
};

export type OrganizerPresetKey = 'full' | 'staff' | 'certificates' | 'readonly' | 'custom';

export interface OrganizerPreset {
  id: OrganizerPresetKey;
  label: string;
  description: string;
  permissions: OrganizerPermissions;
}

export const ORGANIZER_PERMISSION_PRESETS: Record<Exclude<OrganizerPresetKey, 'custom'>, OrganizerPreset> = {
  full: {
    id: 'full',
    label: 'Full Organizer',
    description: 'Full management of own events, attendees, check-in, certificates, and payments.',
    permissions: {
      events: { canCreate: true, canUpdate: true, canDelete: false },
      attendees: { canRead: true, canUpdate: true, canDelete: true, canExport: true },
      checkin: { canCheckIn: true },
      payments: { canVerify: true },
      certificates: { canManage: true },
      feedback: { canRead: true },
    },
  },
  staff: {
    id: 'staff',
    label: 'Event Staff / Check-In',
    description: 'Onsite event staff: check-in attendees, view attendee list, view feedback.',
    permissions: {
      events: { canCreate: false, canUpdate: false, canDelete: false },
      attendees: { canRead: true, canUpdate: false, canDelete: false, canExport: false },
      checkin: { canCheckIn: true },
      payments: { canVerify: false },
      certificates: { canManage: false },
      feedback: { canRead: true },
    },
  },
  certificates: {
    id: 'certificates',
    label: 'Certificate Specialist',
    description: 'Design templates, issue certificates, and review attendee lists.',
    permissions: {
      events: { canCreate: false, canUpdate: false, canDelete: false },
      attendees: { canRead: true, canUpdate: false, canDelete: false, canExport: false },
      checkin: { canCheckIn: false },
      payments: { canVerify: false },
      certificates: { canManage: true },
      feedback: { canRead: false },
    },
  },
  readonly: {
    id: 'readonly',
    label: 'Read-Only Viewer',
    description: 'View own events, attendees, and feedback without edit or deletion rights.',
    permissions: {
      events: { canCreate: false, canUpdate: false, canDelete: false },
      attendees: { canRead: true, canUpdate: false, canDelete: false, canExport: false },
      checkin: { canCheckIn: false },
      payments: { canVerify: false },
      certificates: { canManage: false },
      feedback: { canRead: true },
    },
  },
};

// User Types
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  /** Removed 'attendee' since attendees are anonymous */
  role: Role;
  /** Required by firestore.rules isOrganizer()/isAdmin() — a user doc without it
   *  fails every rules evaluation with "Property isActive is undefined". */
  isActive: boolean;
  /** Fine-grained functional permissions for organizers (Hybrid RBAC + ABPAC) */
  permissions?: OrganizerPermissions;
  phoneNumber?: string;
  organization?: string;
  bio?: string;
  skills?: string[];
  socialLinks?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Event Types
export interface Event {
  id: string;
  slug: string;
  title: string;
  description: string;
  shortDescription: string;
  imageUrl?: string;
  bannerUrl?: string;
  /**
   * @deprecated Events are communal and have no owner.
   * Kept optional for backward compatibility during migration.
   */
  organizer?: {
    uid?: string;
    name?: string;
    email?: string;
  };
  speakers: Speaker[];
  startDate: Timestamp;
  endDate: Timestamp;
  timezone: string;
  venue: Venue;
  locationTba?: boolean;
  speakersTba?: boolean;
  ticketTypes: TicketType[];
  promoCodes?: PromoCode[];
  paymentConfigs?: PaymentConfig[];
  registrationForm?: FormField[];
  feedbackForm?: FormField[];
  tags: string[];
  category: EventCategory;
  status: EventStatus;
  registrationStatus: RegistrationStatus;
  maxAttendees?: number;
  currentAttendees: number;
  isPublished: boolean;
  registrationDeadline?: Timestamp;
  requirements?: string[];
  feedbackRequestsSentAt?: Timestamp;
  feedbackRequestsSentCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Speaker {
  id: string;
  name: string;
  title: string;
  company?: string;
  bio: string;
  photoUrl?: string;
  socialLinks?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
  };
  topics?: string[];
}

export interface Venue {
  type: 'online' | 'offline' | 'hybrid';
  name?: string;
  address?: string;
  city: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  placeId?: string;
  mapsUrl?: string;
  onlineDetails?: {
    platform: string;
    meetingUrl?: string;
    meetingId?: string;
    instructions?: string;
  };
  capacity?: number;
  amenities?: string[];
}

export interface TicketType {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  maxQuantity?: number;
  currentSold: number;
  isActive: boolean;
  benefits?: string[];
  sortOrder: number;
  discountPercentage?: number;
  validFrom?: Timestamp;
  validUntil?: Timestamp;
}

export interface PromoCode {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  currency?: string;
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
  validFrom: Timestamp;
  validUntil: Timestamp;
  applicableTicketTypes?: string[]; // If empty, applies to all
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TicketPricing {
  ticketTypeId: string;
  originalPrice: number;
  currentPrice: number;
  discountAmount: number;
  discountType?: 'promo_code' | 'bulk';
  promoCode?: string;
  promoCodeId?: string;
  timeRemaining?: number; // in milliseconds for time-limited discounts
}

// Registration Types
export interface Registration {
  id: string;
  eventId: string;
  organizerUid?: string;
  userId: string;
  userDetails: {
    name: string;
    email: string;
    phoneNumber?: string;
    organization?: string;
    dietaryRestrictions?: string;
    tshirtSize?: string;
    emergencyContact?: {
      name: string;
      phone: string;
    };
  };
  ticketTypeId: string;
  quantity: number;
  originalAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  promoCode?: string;
  promoCodeId?: string;
  pricing: TicketPricing;
  paymentStatus: PaymentStatus;
  paymentDetails?: PaymentDetails;
  paymentProof?: PaymentProof;
  // One-time payment link metadata (optional)
  paymentLinkToken?: string;
  paymentLinkExpiresAt?: Timestamp; // Expiry timestamp
  paymentLinkStatus?: 'active' | 'consumed' | 'expired';
  attendanceStatus: AttendanceStatus;
  checkInTime?: Timestamp;
  // NOTE: two field names are written for the same concept across the codebase
  // (checkInTime in registrationService, checkedInAt in main.py + AdminCheckInPage).
  // Both are declared so nothing silently reads undefined; unify before P5.
  checkedInAt?: Timestamp;
  feedbackSubmitted: boolean;
  feedbackRequestSent?: boolean;
  feedbackRequestSentAt?: Timestamp;
  feedbackRequestError?: string;
  feedbackRequestLastAttemptAt?: Timestamp;
  certificateIssued: boolean;
  certificateId?: string;
  certificateVerificationCode?: string; // Consistent verification code tied to attendee identity
  certificateEmailSent?: boolean;
  certificateEmailSentAt?: Timestamp;
  qrCode: string;
  registrationDate: Timestamp;
  updatedAt: Timestamp;
  registrationType?: 'online' | 'walk-in'; // Type of registration
  registeredBy?: string; // UID of admin/organizer who registered walk-in attendee
  // Custom form responses - keyed by field ID
  customResponses?: Record<string, string | boolean | number>;
}

export interface PaymentDetails {
  paymentId: string;
  paymentMethod: string;
  transactionId: string;
  paidAt: Timestamp;
}

// Feedback Types
export interface Feedback {
  id: string;
  eventId: string;
  userId: string;
  registrationId: string;
  overallRating: number; // 1-5
  contentRating: number;
  organizationRating: number;
  venueRating: number;
  speakerRatings: {
    speakerId: string;
    rating: number;
    comments?: string;
  }[];
  comments: string;
  suggestions: string;
  wouldRecommend: boolean;
  futureTopics?: string[];
  submittedAt: Timestamp;
}

// Certificate Types
export interface Certificate {
  id: string;
  credentialId: string; // Unique verification ID
  eventId: string;
  userId: string;
  registrationId: string;
  recipientName: string;
  eventTitle: string;
  eventDate: string;
  completionDate: Timestamp;
  certificateUrl: string; // Cloud Storage URL
  verificationUrl: string; // URL for QR code verification
  isVerified: boolean;
  templateId: string;
  metadata: {
    eventDuration?: string;
    skills?: string[];
    topics?: string[];
  };
  issuedAt: Timestamp;
  downloadCount: number;
  verificationCount: number;
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'qrcode';
  position: {
    x: number; // Percentage from left
    y: number; // Percentage from top
    width?: number; // For QR codes
    height?: number; // For QR codes
  };
  content: string; // Template string or static content
  style: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    align?: 'left' | 'center' | 'right';
    fontWeight?: 'normal' | 'bold';
    fontStyle?: 'normal' | 'italic';
  };
}

export interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  eventId?: string; // If linked to specific event
  templateImageUrl: string; // PNG template file URL
  dimensions: {
    width: number;
    height: number;
  };
  // Legacy text positions (for backward compatibility)
  textPositions?: {
    recipientName: {
      x: number; // Percentage from left
      y: number; // Percentage from top
      fontSize: number;
      fontFamily: string;
      color: string;
      align: 'left' | 'center' | 'right';
      fontWeight?: 'normal' | 'bold';
      fontStyle?: 'normal' | 'italic';
    };
    verificationCode: {
      x: number;
      y: number;
      fontSize: number;
      fontFamily: string;
      color: string;
      align: 'left' | 'center' | 'right';
      fontWeight?: 'normal' | 'bold';
      fontStyle?: 'normal' | 'italic';
    };
    qrCode: {
      x: number;
      y: number;
      size: number; // Size in pixels
    };
    eventTitle?: {
      x: number;
      y: number;
      fontSize: number;
      fontFamily: string;
      color: string;
      align: 'left' | 'center' | 'right';
      fontWeight?: 'normal' | 'bold';
      fontStyle?: 'normal' | 'italic';
    };
    eventDate?: {
      x: number;
      y: number;
      fontSize: number;
      fontFamily: string;
      color: string;
      align: 'left' | 'center' | 'right';
      fontWeight?: 'normal' | 'bold';
      fontStyle?: 'normal' | 'italic';
    };
  };
  // Enhanced elements (new approach)
  elements?: TemplateElement[];
  // Template mode to distinguish creation method
  templateMode?: 'legacy' | 'enhanced';
  isActive: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  usageCount: number;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  isEmailSent: boolean;
  createdAt: Timestamp;
}

// Analytics Types
export interface EventAnalytics {
  eventId: string;
  registrationStats: {
    totalRegistrations: number;
    paidRegistrations: number;
    freeRegistrations: number;
    revenue: number;
    refunds: number;
  };
  attendanceStats: {
    checkedIn: number;
    noShows: number;
    attendanceRate: number;
  };
  feedbackStats: {
    totalResponses: number;
    averageRating: number;
    responseRate: number;
  };
  certificateStats: {
    issued: number;
    verified: number;
  };
  demographics: {
    organizations: Record<string, number>;
    skills: Record<string, number>;
    locations: Record<string, number>;
  };
  timeline: {
    registrationsByDate: Record<string, number>;
    checkInsByHour: Record<string, number>;
  };
  lastUpdated: Timestamp;
}

// Enums
export type EventCategory = 
  | 'workshop' 
  | 'meetup' 
  | 'conference' 
  | 'hackathon' 
  | 'networking' 
  | 'webinar'
  | 'study-jam'
  | 'code-lab';

export type EventStatus = 
  | 'draft' 
  | 'published' 
  | 'ongoing' 
  | 'completed' 
  | 'cancelled' 
  | 'postponed';

export type RegistrationStatus = 
  | 'open'
  | 'closed'
  | 'walk-in-only';

export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'paid' 
  | 'failed' 
  | 'refunded' 
  | 'cancelled';

// Values actually persisted by functions/main.py and the admin pages.
// Note: 'attended' is a UI-only local-state value (AdminCheckInPage maps
// checked-in -> attended for display) and is never written to Firestore.
export type AttendanceStatus =
  | 'registered'
  | 'confirmed'
  | 'checked-in'
  | 'no-show'
  | 'pending'
  | 'not_attended'
  | 'cancelled';

export type NotificationType = 
  | 'registration_confirmation'
  | 'payment_success'
  | 'event_reminder'
  | 'event_update'
  | 'feedback_request'
  | 'certificate_ready'
  | 'event_cancelled'
  | 'refund_processed'
  | 'admin_pending_attendee'
  | 'admin_high_pending_count'
  | 'admin_event_created'
  | 'admin_check_in'
  | 'admin_payment_verified';

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

// Form Types (legacy - use EventFormData below for new code)

export interface RegistrationFormData {
  userDetails: {
    name: string;
    email: string;
    phoneNumber?: string;
    organization?: string;
    dietaryRestrictions?: string;
    tshirtSize?: string;
    emergencyContact?: {
      name: string;
      phone: string;
    };
  };
  ticketTypeId: string;
  quantity: number;
  agreeToTerms: boolean;
  subscribeToUpdates: boolean;
}

// Form Builder Types
export interface FormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'multiselect' | 'textarea' | 'checkbox' | 'radio' | 'rating' | 'file' | 'date' | 'number' | 'spacer';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    min?: number;
    max?: number;
  };
  description?: string;
  gridSize?: 'full' | 'half';
}

export interface CustomForm {
  id: string;
  name: string;
  type: 'registration' | 'feedback';
  description: string;
  fields: FormField[];
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  usageCount: number;
  eventId?: string;
  eventTitle?: string;
}

export interface PaymentConfig {
  id: string;
  name: string;
  qrCodeImage?: File;
  qrCodeUrl?: string;
  bankDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    swiftCode?: string;
  };
  instructions: string;
  requiresProof: boolean;
  requiresTransactionId: boolean;
  paymentFields?: FormField[];
  isActive: boolean;
}

// Enhanced Event Form Data interface
export interface EventFormData {
  // Basic Info
  title: string;
  description: string;
  shortDescription: string;
  imageUrl?: string;
  
  // Date & Time
  startDateString: string;
  startTime: string;
  endDateString: string;
  endTime: string;
  timezone: string;
  
  // Venue
  venueType: 'online' | 'offline' | 'hybrid';
  venueName?: string;
  venueAddress?: string;
  city: string;
  venueCoordinates?: {
    lat: number;
    lng: number;
  };
  venuePlaceId?: string;
  venueMapsUrl?: string;
  
  // Pricing
  isPaid: boolean;
  ticketPrice: number;
  currency: string;
  maxAttendees?: number;
  
  // Forms
  registrationForm: FormField[];
  feedbackForm: FormField[];
  
  // Payment (for paid events)
  paymentConfigs?: PaymentConfig[];
  
  // Settings
  categoryString: EventCategory;
  tags: string[];
  eventRequirements: string[];
  registrationDeadlineString?: string;
}

// Payment Proof interface for registration
export interface PaymentProof {
  id: string;
  registrationId: string;
  proofImageUrl?: string;
  transactionId?: string;
  submittedAt: Timestamp;
  verificationStatus: 'pending' | 'approved' | 'rejected';
  verifiedAt?: Timestamp;
  verifiedBy?: string;
  notes?: string;
}

// Email Management Types
export interface EmailLog {
  id: string;
  type: 'email_confirmation_sent' | 'payment_notification_sent' | 'certificate_notification_sent' | 'event_reminder_sent' | 'feedback_request_sent' | 'checkin_notification_sent';
  registrationId?: string;
  eventId?: string;
  eventTitle?: string;
  userEmail: string;
  userName: string;
  emailId?: string;
  success: boolean;
  timestamp: Timestamp;
  status?: string;
  reminderType?: string;
  certificateUrl?: string;
  feedbackUrl?: string;
  isFreeRegistration?: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  type: 'registration_confirmation' | 'payment_notification' | 'certificate_notification' | 'event_reminder' | 'feedback_request';
  description: string;
}

export interface ResendEmailStatus {
  id: string;
  status: 'queued' | 'sent' | 'delivered' | 'delivery_delayed' | 'bounced' | 'complained';
  created_at: string;
  last_event: string;
  to: string[];
  from: string;
  subject: string;
}

// Audit Log Types
export type AuditLogCategory =
  | 'user_management'
  | 'event_operations'
  | 'financial'
  | 'system_security'
  | 'communications';

export type AuditLogAction =
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'role_changed'
  | 'event_created'
  | 'event_updated'
  | 'event_published'
  | 'event_deleted'
  | 'attendee_checked_in'
  | 'registration_approved'
  | 'registration_rejected'
  | 'registration_deleted'
  | 'payment_approved'
  | 'payment_rejected'
  | 'certificate_generated'
  | 'promo_codes_updated'
  | 'email_sent'
  | 'system_config_changed';

export interface AuditLogActor {
  uid: string;
  email: string;
  name?: string;
  role: Role;
}

export interface AuditLogTarget {
  type: 'user' | 'event' | 'registration' | 'payment_proof' | 'certificate' | 'system';
  id: string;
  label?: string;
}

export interface AuditLog {
  id: string;
  timestamp: Timestamp;
  category: AuditLogCategory;
  action: AuditLogAction;
  actor: AuditLogActor;
  target: AuditLogTarget;
  details?: Record<string, any>;
  status: 'success' | 'failure';
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilterParams {
  category?: AuditLogCategory | 'all';
  action?: AuditLogAction | 'all';
  actorEmail?: string;
  status?: 'all' | 'success' | 'failure';
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  startAfterTimestamp?: number;
  searchTerm?: string;
}