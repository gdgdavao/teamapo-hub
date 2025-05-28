import { Timestamp } from 'firebase/firestore';

// User Types
export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'attendee' | 'organizer' | 'admin';
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
  tags: string[];
  category: EventCategory;
  status: EventStatus;
  maxAttendees?: number;
  currentAttendees: number;
  isPublished: boolean;
  registrationDeadline?: Timestamp;
  requirements?: string[];
  agenda?: AgendaItem[];
  sponsors?: Sponsor[];
  socialLinks?: {
    website?: string;
    discord?: string;
    telegram?: string;
  };
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
  earlyBirdPrice?: number;
  earlyBirdDeadline?: Timestamp;
  benefits?: string[];
}

export interface AgendaItem {
  id: string;
  title: string;
  description?: string;
  startTime: string; // HH:mm format
  endTime: string;
  speaker?: string;
  type: 'presentation' | 'workshop' | 'break' | 'networking' | 'panel';
}

export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  website?: string;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze' | 'community';
  description?: string;
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
  totalAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentDetails?: PaymentDetails;
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
  isVerified: boolean;
  template: 'standard' | 'premium' | 'workshop' | 'speaker';
  metadata: {
    eventDuration?: string;
    skills?: string[];
    topics?: string[];
  };
  issuedAt: Timestamp;
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
  | 'refund_processed';

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

// Form Types
export interface EventFormData {
  title: string;
  description: string;
  shortDescription: string;
  startDate: Date;
  endDate: Date;
  timezone: string;
  venue: Venue;
  ticketTypes: Omit<TicketType, 'id' | 'currentSold'>[];
  speakers: Omit<Speaker, 'id'>[];
  tags: string[];
  category: EventCategory;
  maxAttendees?: number;
  registrationDeadline?: Date;
  requirements?: string[];
  agenda?: Omit<AgendaItem, 'id'>[];
  sponsors?: Omit<Sponsor, 'id'>[];
}

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