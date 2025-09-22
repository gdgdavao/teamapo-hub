import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  Timestamp,
  limit,
  increment
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { Registration, Event, TicketPricing } from '../types';
import { NotificationService } from './notificationService';

export interface RegistrationData {
  eventId: string;
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
  promoCode?: string;
  agreeToTerms: boolean;
  subscribeToUpdates: boolean;
  customResponses?: Record<string, any>;
}

export interface RegistrationStats {
  totalRegistrations: number;
  paidRegistrations: number;
  freeRegistrations: number;
  pendingPayments: number;
  checkedInCount: number;
  noShowCount: number;
  revenue: number;
}

export class RegistrationService {
  private static readonly REGISTRATIONS_COLLECTION = 'registrations';
  private static readonly EVENTS_COLLECTION = 'events';

  /**
   * Create a pending registration (before payment)
   */
  static async createPendingRegistration(registrationData: RegistrationData): Promise<{
    registrationId: string;
    pricing: TicketPricing;
    qrCode: string;
    requiresPayment: boolean;
    paymentLinkToken?: string;
  }> {
    try {
      // Validate event and get pricing locally (bypassing functions for now)
      const validation = await this.validateRegistrationLocally(registrationData);
      
      if (!validation.isValid) {
        throw new Error(validation.message || validation.errors?.join(', ') || 'Registration validation failed');
      }

      // Generate registration ID
      const registrationRef = doc(collection(db, this.REGISTRATIONS_COLLECTION));
      const registrationId = registrationRef.id;

      // Generate QR code
      const qrCode = this.generateQRCode(registrationId);

      // Determine payment status - force pending for manual approval flow
      const requiresPayment = validation.pricing.currentPrice > 0;
      const paymentStatus = 'pending';

      // Generate one-time payment link token and expiry (24h)
      const token = (() => {
        try {
          const arr = new Uint8Array(16);
          // @ts-ignore - crypto is available in browser
          (globalThis.crypto || (window as any).crypto).getRandomValues(arr);
          return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch {
          return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        }
      })();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Create pending registration document
      const registration: Omit<Registration, 'id'> = {
        eventId: registrationData.eventId,
        userId: '', // Anonymous registration
        userDetails: registrationData.userDetails,
        ticketTypeId: registrationData.ticketTypeId,
        quantity: registrationData.quantity,
        originalAmount: validation.pricing.originalPrice * registrationData.quantity,
        discountAmount: validation.pricing.discountAmount * registrationData.quantity,
        totalAmount: validation.pricing.currentPrice * registrationData.quantity,
        currency: 'PHP', // Default currency
        pricing: validation.pricing,
        paymentStatus: paymentStatus as any,
        attendanceStatus: 'pending' as any,
        feedbackSubmitted: false,
        certificateIssued: false,
        qrCode,
        registrationDate: serverTimestamp() as any,
  updatedAt: serverTimestamp() as any,
  // Payment link metadata
  paymentLinkToken: token as any,
  paymentLinkExpiresAt: expiresAt as any,
  paymentLinkStatus: 'active' as any
      };

      // Add custom form responses if provided
      if (registrationData.customResponses) {
        (registration as any).customResponses = registrationData.customResponses;
      }

      // Clean up undefined values before saving to Firestore
      const cleanRegistration = Object.fromEntries(
        Object.entries(registration).filter(([_, value]) => value !== undefined)
      );

      // Save pending registration
      console.log('Saving registration with data:', cleanRegistration);
      await setDoc(registrationRef, cleanRegistration);
      console.log('Registration saved successfully with ID:', registrationId);

      // Don't update event attendee count yet - wait for payment confirmation

      return {
        registrationId,
        pricing: validation.pricing,
        qrCode,
        requiresPayment,
        paymentLinkToken: token
      };
    } catch (error) {
      console.error('Error creating pending registration:', error);
      throw new Error('Failed to create registration');
    }
  }

  /**
   * Complete registration after payment verification
   */
  static async completeRegistration(registrationId: string): Promise<void> {
    try {
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      
      // Update registration status to confirmed
      await updateDoc(registrationRef, {
        attendanceStatus: 'registered',
        paymentStatus: 'paid',
        updatedAt: serverTimestamp()
      });

      // Get registration data to update event attendee count
      const registrationDoc = await getDoc(registrationRef);
      if (registrationDoc.exists()) {
        const registrationData = registrationDoc.data() as Registration;
        
        // Update event attendee count
        const eventRef = doc(db, this.EVENTS_COLLECTION, registrationData.eventId);
        await updateDoc(eventRef, {
          currentAttendees: increment(registrationData.quantity),
          updatedAt: serverTimestamp()
        });

        // Send confirmation email via Firebase Function
        try {
          const sendConfirmationEmail = httpsCallable(functions, 'sendConfirmationEmail');
          await sendConfirmationEmail({
            registrationId,
            eventId: registrationData.eventId,
            userEmail: registrationData.userDetails.email,
            userName: registrationData.userDetails.name
          });
        } catch (emailError) {
          console.error('Error sending confirmation email:', emailError);
          // Don't throw - email failure shouldn't break the flow
        }
      }
    } catch (error) {
      console.error('Error completing registration:', error);
      throw new Error('Failed to complete registration');
    }
  }

  /**
   * Register for an event (legacy method - now calls createPendingRegistration)
   */
  static async registerForEvent(registrationData: RegistrationData): Promise<{
    registrationId: string;
    pricing: TicketPricing;
    qrCode: string;
    requiresPayment: boolean;
  }> {
    try {
      // Validate event and get pricing locally (bypassing functions for now)
      const validation = await this.validateRegistrationLocally(registrationData);
      
      if (!validation.isValid) {
        throw new Error(validation.message || validation.errors?.join(', ') || 'Registration validation failed');
      }

      // Generate registration ID
      const registrationRef = doc(collection(db, this.REGISTRATIONS_COLLECTION));
      const registrationId = registrationRef.id;

      // Generate QR code
      const qrCode = this.generateQRCode(registrationId);

      // Determine payment status - force pending for manual approval flow
      const requiresPayment = validation.pricing.currentPrice > 0;
      const paymentStatus = 'pending';

      // Create registration document
      const registration: Omit<Registration, 'id'> = {
        eventId: registrationData.eventId,
        userId: '', // Anonymous registration
        userDetails: registrationData.userDetails,
        ticketTypeId: registrationData.ticketTypeId,
        quantity: registrationData.quantity,
        originalAmount: validation.pricing.originalPrice * registrationData.quantity,
        discountAmount: validation.pricing.discountAmount * registrationData.quantity,
        totalAmount: validation.pricing.currentPrice * registrationData.quantity,
        currency: 'PHP', // Default currency
        ...(registrationData.promoCode ? { promoCode: registrationData.promoCode } : {}),
        ...(validation.pricing.promoCode ? { promoCodeId: registrationData.promoCode } : {}),
        pricing: validation.pricing,
        paymentStatus: paymentStatus as any,
        attendanceStatus: 'registered',
        feedbackSubmitted: false,
        certificateIssued: false,
        qrCode,
        registrationDate: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any
      };

      // Add custom form responses if provided
      if (registrationData.customResponses) {
        (registration as any).customResponses = registrationData.customResponses;
      }

      // Save registration
      await setDoc(registrationRef, registration);

      // Update event attendee count
      const eventRef = doc(db, this.EVENTS_COLLECTION, registrationData.eventId);
      await updateDoc(eventRef, {
        currentAttendees: increment(registrationData.quantity),
        updatedAt: serverTimestamp()
      });

      // Send confirmation email via Firebase Function
      try {
        const sendRegistrationEmail = httpsCallable(functions, 'sendConfirmationEmail');
        await sendRegistrationEmail({
          registrationId,
          eventId: registrationData.eventId,
          userEmail: registrationData.userDetails.email,
          userName: registrationData.userDetails.name,
          requiresPayment
        });
      } catch (error) {
        console.warn('Failed to send registration confirmation email:', error);
      }

      // Send notification for successful registration (for admin/organizer)
      try {
        // Get event details for notification
        const eventRef = doc(db, this.EVENTS_COLLECTION, registrationData.eventId);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          const eventData = eventSnap.data() as Event;
          // Notify admin/organizer about new registration
          if (eventData.organizer?.uid) {
            await NotificationService.createNotification(
              eventData.organizer.uid,
              'registration_confirmation',
              'New Registration',
              `${registrationData.userDetails.name} has registered for "${eventData.title}"`,
              { registrationId, eventId: registrationData.eventId, userEmail: registrationData.userDetails.email }
            );
          }
        }
      } catch (error) {
        console.warn('Failed to create registration notification:', error);
      }

      return {
        registrationId,
        pricing: validation.pricing,
        qrCode,
        requiresPayment
      };
    } catch (error) {
      console.error('Error registering for event:', error);
      throw new Error('Failed to register for event');
    }
  }

  /**
   * Get registration by ID
   */
  static async getRegistrationById(registrationId: string): Promise<Registration | null> {
    try {
      console.log('Fetching registration with ID:', registrationId);
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      const registrationSnap = await getDoc(registrationRef);
      
      if (registrationSnap.exists()) {
        console.log('Registration found:', registrationSnap.data());
        return {
          id: registrationSnap.id,
          ...registrationSnap.data()
        } as Registration;
      }
      
      console.log('Registration not found');
      return null;
    } catch (error) {
      console.error('Error fetching registration:', error);
      throw new Error('Failed to fetch registration');
    }
  }

  /**
   * Get all registrations for an event
   */
  static async getEventRegistrations(eventId: string): Promise<Registration[]> {
    try {
      const registrationsQuery = query(
        collection(db, this.REGISTRATIONS_COLLECTION),
        where('eventId', '==', eventId),
        orderBy('registrationDate', 'desc')
      );
      const snapshot = await getDocs(registrationsQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Registration));
    } catch (error) {
      console.error('Error fetching event registrations:', error);
      throw new Error('Failed to fetch event registrations');
    }
  }

  /**
   * Get all registrations across all events (for admin dashboard)
   */
  static async getAllRegistrations(): Promise<Registration[]> {
    try {
      const registrationsQuery = query(
        collection(db, this.REGISTRATIONS_COLLECTION),
        orderBy('registrationDate', 'desc')
      );
      const snapshot = await getDocs(registrationsQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Registration));
    } catch (error) {
      console.error('Error fetching all registrations:', error);
      throw new Error('Failed to fetch all registrations');
    }
  }

  /**
   * Get registrations by user email
   */
  static async getUserRegistrations(userEmail: string): Promise<Registration[]> {
    try {
      const registrationsQuery = query(
        collection(db, this.REGISTRATIONS_COLLECTION),
        where('userDetails.email', '==', userEmail),
        orderBy('registrationDate', 'desc')
      );
      const snapshot = await getDocs(registrationsQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Registration));
    } catch (error) {
      console.error('Error fetching user registrations:', error);
      throw new Error('Failed to fetch user registrations');
    }
  }

  /**
   * Check in attendee
   */
  static async checkInAttendee(
    registrationId: string, 
    checkInMethod: 'qr' | 'manual' = 'manual',
    bypassPaymentCheck: boolean = false
  ): Promise<void> {
    try {
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      const registration = await getDoc(registrationRef);
      
      if (!registration.exists()) {
        throw new Error('Registration not found');
      }

      const data = registration.data();
      if (data.attendanceStatus === 'checked-in') {
        throw new Error('Attendee already checked in');
      }

      // More flexible payment check for organizers
      if (!bypassPaymentCheck && data.paymentStatus !== 'paid') {
        // For free events (totalAmount = 0), automatically mark as paid
        if (data.totalAmount === 0) {
          await updateDoc(registrationRef, {
            paymentStatus: 'paid',
            updatedAt: serverTimestamp()
          });
        } else {
          // For paid events, throw more descriptive error
          throw new Error(`Payment status is '${data.paymentStatus}'. Please ensure payment is completed before check-in.`);
        }
      }

      await updateDoc(registrationRef, {
        attendanceStatus: 'checked-in',
        checkInTime: serverTimestamp(),
        checkInMethod,
        updatedAt: serverTimestamp()
      });

      // Send check-in notification
      try {
        const sendCheckInNotification = httpsCallable(functions, 'sendCheckInNotification');
        await sendCheckInNotification({
          registrationId,
          eventId: data.eventId,
          userEmail: data.userDetails.email,
          userName: data.userDetails.name
        });
      } catch (error) {
        console.warn('Failed to send check-in notification:', error);
      }

      // Send notification to organizer about successful check-in
      try {
        const eventRef = doc(db, this.EVENTS_COLLECTION, data.eventId);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          const eventData = eventSnap.data() as Event;
          if (eventData.organizer?.uid) {
            await NotificationService.createNotification(
              eventData.organizer.uid,
              'event_update',
              'Attendee Checked In',
              `${data.userDetails.name} has been checked in to "${eventData.title}"`,
              { registrationId, eventId: data.eventId, checkInMethod }
            );
          }
        }
      } catch (error) {
        console.warn('Failed to create check-in notification:', error);
      }
    } catch (error) {
      console.error('Error checking in attendee:', error);
      throw error; // Re-throw the original error with its message
    }
  }

  /**
   * Check in attendee (organizer version with more flexibility)
   */
  static async organizerCheckInAttendee(registrationId: string): Promise<void> {
    try {
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      const registration = await getDoc(registrationRef);
      
      if (!registration.exists()) {
        throw new Error('Registration not found');
      }

      const data = registration.data();
      if (data.attendanceStatus === 'checked-in') {
        throw new Error('Attendee already checked in');
      }

      // Organizers can check in attendees regardless of payment status
      // But we'll automatically update payment status for free events
      const updateData: any = {
        attendanceStatus: 'checked-in',
        checkInTime: serverTimestamp(),
        checkInMethod: 'manual',
        updatedAt: serverTimestamp()
      };

      // For free events, automatically mark as paid
      if (data.totalAmount === 0 && data.paymentStatus !== 'paid') {
        updateData.paymentStatus = 'paid';
      }

      await updateDoc(registrationRef, updateData);

      // Send check-in notification
      try {
        const sendCheckInNotification = httpsCallable(functions, 'sendCheckInNotification');
        await sendCheckInNotification({
          registrationId,
          eventId: data.eventId,
          userEmail: data.userDetails.email,
          userName: data.userDetails.name
        });
      } catch (error) {
        console.warn('Failed to send check-in notification:', error);
      }
    } catch (error) {
      console.error('Error checking in attendee:', error);
      throw error; // Re-throw the original error with its message
    }
  }

  /**
   * Update registration status (for admin use)
   */
  static async updateRegistrationStatus(
    registrationId: string, 
    status: 'pending' | 'approved' | 'rejected',
    notes?: string
  ): Promise<void> {
    try {
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      const updateData: any = {
        registrationStatus: status,
        updatedAt: serverTimestamp()
      };

      if (notes) {
        updateData.adminNotes = notes;
      }

      // If approving, also update payment status if needed
      if (status === 'approved') {
        const registration = await getDoc(registrationRef);
        if (registration.exists()) {
          const data = registration.data();
          // If it's a free event, mark as paid
          if (data.totalAmount === 0) {
            updateData.paymentStatus = 'paid';
          }
        }
      }

      await updateDoc(registrationRef, updateData);
    } catch (error) {
      console.error('Error updating registration status:', error);
      throw new Error('Failed to update registration status');
    }
  }

  /**
   * Get registration statistics for an event
   */
  static async getRegistrationStats(eventId: string): Promise<RegistrationStats> {
    try {
      const registrations = await this.getEventRegistrations(eventId);
      
      let totalRegistrations = 0;
      let paidRegistrations = 0;
      let freeRegistrations = 0;
      let pendingPayments = 0;
      let checkedInCount = 0;
      let noShowCount = 0;
      let revenue = 0;

      registrations.forEach(registration => {
        totalRegistrations += registration.quantity;
        
        if (registration.paymentStatus === 'paid') {
          if (registration.totalAmount > 0) {
            paidRegistrations += registration.quantity;
            revenue += registration.totalAmount;
          } else {
            freeRegistrations += registration.quantity;
          }
        } else if (registration.paymentStatus === 'pending') {
          pendingPayments += registration.quantity;
        }

        if (registration.attendanceStatus === 'checked-in') {
          checkedInCount += registration.quantity;
        } else if (registration.attendanceStatus === 'no-show') {
          noShowCount += registration.quantity;
        }
      });

      return {
        totalRegistrations,
        paidRegistrations,
        freeRegistrations,
        pendingPayments,
        checkedInCount,
        noShowCount,
        revenue
      };
    } catch (error) {
      console.error('Error fetching registration stats:', error);
      throw new Error('Failed to fetch registration stats');
    }
  }

  /**
   * Verify QR code for check-in
   */
  static async verifyQRCode(qrCode: string): Promise<{
    isValid: boolean;
    registration?: Registration;
    event?: Event;
    message?: string;
  }> {
    try {
      // Find registration by QR code
      const registrationsQuery = query(
        collection(db, this.REGISTRATIONS_COLLECTION),
        where('qrCode', '==', qrCode),
        limit(1)
      );
      const snapshot = await getDocs(registrationsQuery);
      
      if (snapshot.empty) {
        return { isValid: false, message: 'Invalid QR code' };
      }

      const registrationDoc = snapshot.docs[0];
      const registration = {
        id: registrationDoc.id,
        ...registrationDoc.data()
      } as Registration;

      // Get event details
      const eventRef = doc(db, this.EVENTS_COLLECTION, registration.eventId);
      const eventSnap = await getDoc(eventRef);
      
      if (!eventSnap.exists()) {
        return { isValid: false, message: 'Event not found' };
      }

      const event = {
        id: eventSnap.id,
        ...eventSnap.data()
      } as Event;

      // Check if event is today or ongoing
      const now = new Date();
      const eventDate = event.startDate.toDate();
      const daysDiff = Math.abs(now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 1) {
        return { 
          isValid: false, 
          registration, 
          event,
          message: 'QR code is not valid for today\'s event' 
        };
      }

      return { 
        isValid: true, 
        registration, 
        event,
        message: 'QR code verified successfully' 
      };
    } catch (error) {
      console.error('Error verifying QR code:', error);
      return { isValid: false, message: 'Failed to verify QR code' };
    }
  }

  /**
   * Cancel registration
   */
  static async cancelRegistration(registrationId: string, reason?: string): Promise<void> {
    try {
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      const registration = await getDoc(registrationRef);
      
      if (!registration.exists()) {
        throw new Error('Registration not found');
      }

      const data = registration.data();
      
      // Update registration status
      await updateDoc(registrationRef, {
        attendanceStatus: 'cancelled',
        cancellationReason: reason || 'Cancelled by user',
        cancelledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Update event attendee count
      const eventRef = doc(db, this.EVENTS_COLLECTION, data.eventId);
      await updateDoc(eventRef, {
        currentAttendees: increment(-data.quantity),
        updatedAt: serverTimestamp()
      });

      // Process refund if applicable
      if (data.paymentStatus === 'paid' && data.totalAmount > 0) {
        try {
          const processRefund = httpsCallable(functions, 'processRefund');
          await processRefund({
            registrationId,
            reason: reason || 'User cancellation'
          });
        } catch (error) {
          console.warn('Failed to process refund:', error);
        }
      }
    } catch (error) {
      console.error('Error cancelling registration:', error);
      throw new Error('Failed to cancel registration');
    }
  }

  /**
   * Generate QR code for registration
   */
  private static generateQRCode(registrationId: string): string {
    // Simple QR code generation - in production, use a proper QR library
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `REG-${timestamp}-${random}-${registrationId.substring(0, 8)}`.toUpperCase();
  }

  /**
   * Export registrations to CSV format
   */
  static async exportRegistrations(eventId: string): Promise<string> {
    try {
      const registrations = await this.getEventRegistrations(eventId);
      
      if (registrations.length === 0) {
        throw new Error('No registrations found for this event');
      }

      // Create CSV header
      const headers = [
        'Registration ID',
        'Name',
        'Email',
        'Phone',
        'Organization',
        'Ticket Type',
        'Quantity',
        'Total Amount',
        'Payment Status',
        'Attendance Status',
        'Registration Date',
        'QR Code'
      ];

      // Create CSV rows
      const rows = registrations.map(reg => [
        reg.id,
        reg.userDetails.name,
        reg.userDetails.email,
        reg.userDetails.phoneNumber || '',
        reg.userDetails.organization || '',
        reg.ticketTypeId,
        reg.quantity.toString(),
        reg.totalAmount.toString(),
        reg.paymentStatus,
        reg.attendanceStatus,
        reg.registrationDate.toDate().toISOString(),
        reg.qrCode
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      console.error('Error exporting registrations:', error);
      throw new Error('Failed to export registrations');
    }
  }

  /**
   * Local validation method to replace Firebase Function call
   */
  private static async validateRegistrationLocally(registrationData: RegistrationData): Promise<{
    isValid: boolean;
    pricing: TicketPricing;
    errors?: string[];
    message?: string;
  }> {
    try {
      // Get event data
      const eventRef = doc(db, 'events', registrationData.eventId);
      const eventSnap = await getDoc(eventRef);
      
      if (!eventSnap.exists()) {
        return {
          isValid: false,
          pricing: {} as TicketPricing,
          message: 'Event not found'
        };
      }
      
      const eventData = eventSnap.data();
      
      // Check if event is published
      if (!eventData.isPublished) {
        return {
          isValid: false,
          pricing: {} as TicketPricing,
          message: 'Event is not published'
        };
      }
      
      // Check if event is full
      const currentAttendees = eventData.currentAttendees || 0;
      const maxAttendees = eventData.maxAttendees;
      
      if (maxAttendees && currentAttendees >= maxAttendees) {
        return {
          isValid: false,
          pricing: {} as TicketPricing,
          message: 'Event is full'
        };
      }
      
      // Find ticket type
      const ticketTypes = eventData.ticketTypes || [];
      const ticketType = ticketTypes.find((tt: any) => tt.id === registrationData.ticketTypeId);
      
      if (!ticketType) {
        return {
          isValid: false,
          pricing: {} as TicketPricing,
          message: 'Ticket type not found'
        };
      }
      
      // Calculate pricing
      const originalPrice = ticketType.price || 0;
      let discountAmount = 0;
      let promoCode = null;
      
      // Check promo code if provided
      if (registrationData.promoCode) {
        const promoCodes = eventData.promoCodes || [];
        const validPromoCode = promoCodes.find((pc: any) => 
          pc.code === registrationData.promoCode && 
          pc.isActive &&
          (!pc.usageLimit || pc.usedCount < pc.usageLimit)
        );
        
        if (validPromoCode) {
          promoCode = validPromoCode as any;
          if (validPromoCode.discountType === 'percentage') {
            discountAmount = (originalPrice * validPromoCode.discountValue) / 100;
          } else {
            discountAmount = validPromoCode.discountValue;
          }
        }
      }
      
      const currentPrice = Math.max(0, originalPrice - discountAmount);
      
      const pricing: TicketPricing = {
        ticketTypeId: registrationData.ticketTypeId,
        originalPrice,
        currentPrice,
        discountAmount,
        ...(promoCode ? { 
          discountType: 'promo_code' as const,
          promoCode: (promoCode as any).code 
        } : {})
      };
      
      return {
        isValid: true,
        pricing
      };
      
    } catch (error) {
      console.error('Error validating registration locally:', error);
      return {
        isValid: false,
        pricing: {} as TicketPricing,
        message: 'Validation failed'
      };
    }
  }
} 