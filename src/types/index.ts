import { Timestamp } from 'firebase/firestore';

// User Types
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'organizer' | 'admin'; // Removed 'attendee' since attendees are anonymous
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
  title: string;
  description: string;
  shortDescription: string;
  imageUrl?: string;
  bannerUrl?: string;
  organizer: {
    uid: string;
    name: string;
    email: string;
  };
  speakers: Speaker[];
  startDate: Timestamp;
  endDate: Timestamp;
  timezone: string;
  venue: Venue;
  ticketTypes: TicketType[];
  promoCodes?: PromoCode[];
  paymentConfigs?: PaymentConfig[];
  tags: string[];
  category: EventCategory;
  status: EventStatus;
  maxAttendees?: number;
  currentAttendees: number;
  isPublished: boolean;
  registrationDeadline?: Timestamp;
  requirements?: string[];
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
  timeRemaining?: number; // in milliseconds for time-limited discounts
}

// Registration Types
export interface Registration {
  id: string;
  eventId: string;
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
  feedbackSubmitted: boolean;
  certificateIssued: boolean;
  certificateId?: string;
  qrCode: string;
  registrationDate: Timestamp;
  updatedAt: Timestamp;
}

export interface PaymentDetails {
  paymentId: string;
  paymentMethod: 'qrph' | 'gcash' | 'grabpay' | 'card';
  paymentProvider: 'paymongo';
  transactionId: string;
  paidAt: Timestamp;
  refundId?: string;
  refundedAt?: Timestamp;
  fees: {
    processingFee: number;
    platformFee: number;
  };
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

export interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  eventId?: string; // If linked to specific event
  templateImageUrl: string; // PNG template file URL
  textPositions: {
    recipientName: {
      x: number; // Percentage from left
      y: number; // Percentage from top
      fontSize: number;
      fontFamily: string;
      color: string;
      align: 'left' | 'center' | 'right';
    };
    verificationCode: {
      x: number;
      y: number;
      fontSize: number;
      fontFamily: string;
      color: string;
      align: 'left' | 'center' | 'right';
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
    };
    eventDate?: {
      x: number;
      y: number;
      fontSize: number;
      fontFamily: string;
      color: string;
      align: 'left' | 'center' | 'right';
    };
  };
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

export type PaymentStatus = 
  | 'pending' 
  | 'processing' 
  | 'paid' 
  | 'failed' 
  | 'refunded' 
  | 'cancelled';

export type AttendanceStatus = 
  | 'registered' 
  | 'confirmed' 
  | 'checked-in' 
  | 'no-show' 
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
  type: 'text' | 'email' | 'phone' | 'select' | 'multiselect' | 'textarea' | 'checkbox' | 'radio' | 'rating' | 'file' | 'date' | 'number';
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