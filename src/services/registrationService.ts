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
   * Register for an event
   */
  static async registerForEvent(registrationData: RegistrationData): Promise<{
    registrationId: string;
    pricing: TicketPricing;
    qrCode: string;
    requiresPayment: boolean;
  }> {
    try {
      // Validate event and get pricing using Firebase Function
      const validateRegistration = httpsCallable(functions, 'validateRegistration');
      const validationResult = await validateRegistration(registrationData);
      
      const validation = validationResult.data as { 
        isValid: boolean; 
        pricing: TicketPricing; 
        errors?: string[];
        message?: string; 
      };
      
      if (!validation.isValid) {
        throw new Error(validation.message || validation.errors?.join(', ') || 'Registration validation failed');
      }

      // Generate registration ID
      const registrationRef = doc(collection(db, this.REGISTRATIONS_COLLECTION));
      const registrationId = registrationRef.id;

      // Generate QR code
      const qrCode = this.generateQRCode(registrationId);

      // Determine payment status
      const requiresPayment = validation.pricing.currentPrice > 0;
      const paymentStatus = requiresPayment ? 'pending' : 'paid';

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
        promoCode: registrationData.promoCode,
        promoCodeId: validation.pricing.promoCode ? registrationData.promoCode : undefined,
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
        const sendRegistrationEmail = httpsCallable(functions, 'sendRegistrationConfirmation');
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
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      const registrationSnap = await getDoc(registrationRef);
      
      if (registrationSnap.exists()) {
        return {
          id: registrationSnap.id,
          ...registrationSnap.data()
        } as Registration;
      }
      
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
  static async checkInAttendee(registrationId: string, checkInMethod: 'qr' | 'manual' = 'manual'): Promise<void> {
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

      if (data.paymentStatus !== 'paid') {
        throw new Error('Payment required before check-in');
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
    } catch (error) {
      console.error('Error checking in attendee:', error);
      throw new Error('Failed to check in attendee');
    }
  }

  /**
   * Update registration status
   */
  static async updateRegistrationStatus(
    registrationId: string, 
    status: 'confirmed' | 'cancelled' | 'no-show'
  ): Promise<void> {
    try {
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      await updateDoc(registrationRef, {
        attendanceStatus: status,
        updatedAt: serverTimestamp()
      });

      // If cancelling, update event attendee count
      if (status === 'cancelled') {
        const registration = await getDoc(registrationRef);
        if (registration.exists()) {
          const data = registration.data();
          const eventRef = doc(db, this.EVENTS_COLLECTION, data.eventId);
          await updateDoc(eventRef, {
            currentAttendees: increment(-data.quantity),
            updatedAt: serverTimestamp()
          });
        }
      }
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
} 