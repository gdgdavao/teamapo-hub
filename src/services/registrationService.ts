import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  Timestamp
} from 'firebase/firestore';
import type { FirebaseError } from 'firebase/app';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { Registration, Event, TicketPricing } from '../types';
import { NotificationService } from './notificationService';
import { EmailService } from './emailService';

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

  private static async adjustTicketSales(params: {
    eventId: string;
    ticketTypeId: string;
    delta: number;
  }): Promise<void> {
    const { eventId, ticketTypeId, delta } = params;
    if (!delta) {
      return;
    }

    console.log(`Adjusting ticket sales: eventId=${eventId}, ticketTypeId=${ticketTypeId}, delta=${delta}`);
    const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);

    try {
      await runTransaction(db, async transaction => {
        const eventSnapshot = await transaction.get(eventRef);
        if (!eventSnapshot.exists()) {
          throw new Error('Event not found');
        }

        const eventData = eventSnapshot.data() as Event;
        const ticketTypes = Array.isArray(eventData.ticketTypes) ? [...eventData.ticketTypes] : [];
        const ticketIndex = ticketTypes.findIndex(ticket => ticket.id === ticketTypeId);

        if (ticketIndex < 0) {
          throw new Error('Ticket type not found');
        }

        const targetTicket = ticketTypes[ticketIndex];
        const currentSold = Number.isFinite(targetTicket.currentSold) ? targetTicket.currentSold : 0;
        const maxQuantity = Number.isFinite(targetTicket.maxQuantity) ? targetTicket.maxQuantity : undefined;
        const updatedSold = currentSold + delta;

        console.log(`Ticket "${targetTicket.name}": currentSold=${currentSold}, updatedSold=${updatedSold}, maxQuantity=${maxQuantity}`);

        if (updatedSold < 0) {
          // If trying to decrement and would go negative, set to 0 instead
          // This handles cases where registrations were created with errors
          console.warn(`Ticket sales would go negative (${updatedSold}). Setting to 0 instead.`);
          ticketTypes[ticketIndex] = {
            ...targetTicket,
            currentSold: 0
          };
        } else {
          if (maxQuantity && updatedSold > maxQuantity) {
            throw new Error('Ticket quantity limit exceeded');
          }

          ticketTypes[ticketIndex] = {
            ...targetTicket,
            currentSold: updatedSold
          };
        }

        transaction.update(eventRef, {
          ticketTypes,
          updatedAt: serverTimestamp()
        });
        
        console.log('Ticket sales updated successfully');
      });
    } catch (error) {
      console.error('Error adjusting ticket sales:', error);
      throw error;
    }
  }

  /**
   * Increment promo code usage counter
   */
  private static async incrementPromoCodeUsage(eventId: string, promoCodeId: string): Promise<void> {
    const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);

    try {
      await runTransaction(db, async transaction => {
        const eventSnapshot = await transaction.get(eventRef);
        if (!eventSnapshot.exists()) {
          throw new Error('Event not found');
        }

        const eventData = eventSnapshot.data() as Event;
        const promoCodes = Array.isArray(eventData.promoCodes) ? [...eventData.promoCodes] : [];
        const promoIndex = promoCodes.findIndex(pc => pc.id === promoCodeId);

        if (promoIndex < 0) {
          console.warn(`Promo code ${promoCodeId} not found in event ${eventId}`);
          return; // Don't fail the transaction if promo code is missing
        }

        const promoCode = promoCodes[promoIndex];
        const currentUses = Number.isFinite(promoCode.currentUses) ? promoCode.currentUses : 0;
        const maxUses = promoCode.maxUses;

        // Double-check usage limit
        if (maxUses && currentUses >= maxUses) {
          throw new Error('Promo code usage limit exceeded');
        }

        // Increment usage counter
        promoCodes[promoIndex] = {
          ...promoCode,
          currentUses: currentUses + 1
        };

        transaction.update(eventRef, {
          promoCodes,
          updatedAt: serverTimestamp()
        });

        console.log(`Promo code "${promoCode.code}" usage incremented: ${currentUses} -> ${currentUses + 1}`);
      });
    } catch (error) {
      console.error('Error incrementing promo code usage:', error);
      throw error;
    }
  }

  /**
   * Decrement promo code usage counter (used when cancelling a registration)
   */
  private static async decrementPromoCodeUsage(eventId: string, promoCodeId: string): Promise<void> {
    const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);

    try {
      await runTransaction(db, async transaction => {
        const eventSnapshot = await transaction.get(eventRef);
        if (!eventSnapshot.exists()) {
          throw new Error('Event not found');
        }

        const eventData = eventSnapshot.data() as Event;
        const promoCodes = Array.isArray(eventData.promoCodes) ? [...eventData.promoCodes] : [];
        const promoIndex = promoCodes.findIndex(pc => pc.id === promoCodeId);

        if (promoIndex < 0) {
          console.warn(`Promo code ${promoCodeId} not found in event ${eventId}`);
          return; // Don't fail the transaction if promo code is missing
        }

        const promoCode = promoCodes[promoIndex];
        const currentUses = Number.isFinite(promoCode.currentUses) ? promoCode.currentUses : 0;

        // Decrement usage counter, but don't go below 0
        promoCodes[promoIndex] = {
          ...promoCode,
          currentUses: Math.max(0, currentUses - 1)
        };

        transaction.update(eventRef, {
          promoCodes,
          updatedAt: serverTimestamp()
        });

        console.log(`Promo code "${promoCode.code}" usage decremented: ${currentUses} -> ${Math.max(0, currentUses - 1)}`);
      });
    } catch (error) {
      console.error('Error decrementing promo code usage:', error);
      // Don't throw - this is a cleanup operation
    }
  }

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
        // Save promo code information from validation
        ...(validation.pricing.promoCode ? { promoCode: validation.pricing.promoCode } : {}),
        ...(validation.pricing.promoCodeId ? { promoCodeId: validation.pricing.promoCodeId } : {}),
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

      // Update ticket sales immediately to prevent overselling
      // Even pending registrations should reduce available tickets
      await this.adjustTicketSales({
        eventId: registrationData.eventId,
        ticketTypeId: registrationData.ticketTypeId,
        delta: registrationData.quantity
      });

      // Update event attendee count
      const eventRef = doc(db, this.EVENTS_COLLECTION, registrationData.eventId);
      await updateDoc(eventRef, {
        currentAttendees: increment(registrationData.quantity),
        updatedAt: serverTimestamp()
      });

      // Increment promo code usage if a promo code was applied
      if (validation.pricing.promoCodeId) {
        await this.incrementPromoCodeUsage(registrationData.eventId, validation.pricing.promoCodeId);
      }

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
   * Send registration confirmation email immediately after registration
   */
  static async sendRegistrationConfirmationEmail(
    registrationId: string,
    eventId: string,
    userEmail: string,
    userName: string,
    requiresPayment: boolean = false
  ): Promise<void> {
    try {
      const sendConfirmationEmail = httpsCallable(functions, 'sendConfirmationEmail');
      await sendConfirmationEmail({
        registrationId,
        eventId,
        userEmail,
        userName,
        requiresPayment,
        emailType: 'submitted' // This is the immediate confirmation without QR code or registration ID
      });
      console.log('Registration submission confirmation email sent successfully');
    } catch (error) {
      console.error('Error sending registration confirmation email:', error);
      throw new Error('Failed to send confirmation email');
    }
  }

  /**
   * Complete registration after payment verification
   */
  static async completeRegistration(registrationId: string): Promise<void> {
    try {
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      const registrationSnapshot = await getDoc(registrationRef);

      if (!registrationSnapshot.exists()) {
        throw new Error('Registration not found');
      }

      const registrationData = registrationSnapshot.data() as Registration;

      await updateDoc(registrationRef, {
        attendanceStatus: 'registered',
        paymentStatus: 'paid',
        updatedAt: serverTimestamp()
      });

      // Note: We don't update ticket sales or attendee count here anymore
      // because they are already updated in createPendingRegistration
      // This prevents double-counting when payment is verified

      // Send approval confirmation email with QR code and registration ID
      try {
        const sendConfirmationEmail = httpsCallable(functions, 'sendConfirmationEmail');
        await sendConfirmationEmail({
          registrationId,
          eventId: registrationData.eventId,
          userEmail: registrationData.userDetails.email,
          userName: registrationData.userDetails.name,
          emailType: 'approved', // This will include QR code and registration ID
          requiresPayment: false // Payment is already completed at this point
        });
      } catch (emailError) {
        console.error('Error sending approval confirmation email:', emailError);
        // Don't throw - email failure shouldn't break the flow
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
        // Save promo code information from both sources
        ...(validation.pricing.promoCode ? { promoCode: validation.pricing.promoCode } : {}),
        ...(validation.pricing.promoCodeId ? { promoCodeId: validation.pricing.promoCodeId } : {}),
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

      await this.adjustTicketSales({
        eventId: registrationData.eventId,
        ticketTypeId: registrationData.ticketTypeId,
        delta: registrationData.quantity
      });

      // Increment promo code usage if a promo code was applied
      if (validation.pricing.promoCodeId) {
        await this.incrementPromoCodeUsage(registrationData.eventId, validation.pricing.promoCodeId);
      }

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
   * Returns null if registration not found or if user lacks permission (anonymous users)
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
    } catch (error: any) {
      // Handle permission errors gracefully (expected for anonymous users)
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        console.warn('Registration read permission denied (expected for anonymous users)');
        return null;
      }
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
   * Subscribe to ticket sales counts for an event
   */
  static subscribeToEventTicketSales(
    eventId: string,
    onUpdate: (sales: Record<string, number>) => void,
    onError?: (error: Error) => void
  ): () => void {
    if (!eventId) {
      console.warn('RegistrationService.subscribeToEventTicketSales called without an eventId');
      return () => undefined;
    }

    const registrationsRef = collection(db, this.REGISTRATIONS_COLLECTION);
    const registrationsQuery = query(registrationsRef, where('eventId', '==', eventId));

    return onSnapshot(
      registrationsQuery,
      snapshot => {
        const totals: Record<string, number> = {};

        snapshot.forEach(docSnap => {
          const data = docSnap.data() as Partial<Registration>;
          const ticketTypeId = typeof data.ticketTypeId === 'string' ? data.ticketTypeId : null;
          const quantity = typeof data.quantity === 'number' ? data.quantity : 0;

          if (!ticketTypeId || quantity <= 0) {
            return;
          }

          const paymentStatus = typeof data.paymentStatus === 'string'
            ? data.paymentStatus.toLowerCase()
            : 'pending';
          const attendanceStatus = typeof data.attendanceStatus === 'string'
            ? data.attendanceStatus.toLowerCase()
            : 'registered';

          const paymentExcluded =
            paymentStatus === 'failed' ||
            paymentStatus === 'refunded' ||
            paymentStatus === 'cancelled';

          if (paymentExcluded || attendanceStatus === 'cancelled') {
            return;
          }

          totals[ticketTypeId] = (totals[ticketTypeId] || 0) + quantity;
        });

        onUpdate(totals);
      },
      error => {
        const firebaseError = error as FirebaseError;
        const isPermissionError = firebaseError?.code === 'permission-denied';

        if (isPermissionError) {
          console.warn('Permission denied while subscribing to ticket sales. Falling back to event data.');
        } else {
          console.error('Error subscribing to event ticket sales:', error);
        }

        if (onError) {
          onError(error as Error);
        }
      }
    );
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
      let freeApprovalDetails: {
        eventId: string;
        attendeeEmail?: string;
        attendeeName?: string;
      } | null = null;

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
            freeApprovalDetails = {
              eventId: data.eventId,
              attendeeEmail: data.userDetails?.email,
              attendeeName: data.userDetails?.name
            };
          }
        }
      }

      await updateDoc(registrationRef, updateData);

      if (
        freeApprovalDetails &&
        freeApprovalDetails.attendeeEmail &&
        freeApprovalDetails.attendeeName &&
        status === 'approved'
      ) {
        try {
          const eventRef = doc(db, this.EVENTS_COLLECTION, freeApprovalDetails.eventId);
          const eventSnap = await getDoc(eventRef);
          const eventTitle = eventSnap.exists() ? (eventSnap.data() as Event).title : 'Event';
          await EmailService.sendPaymentNotification({
            registrationId,
            status: 'approved',
            eventTitle,
            attendeeEmail: freeApprovalDetails.attendeeEmail,
            attendeeName: freeApprovalDetails.attendeeName
          });
        } catch (notificationError) {
          console.warn('Failed to send payment notification for free registration:', notificationError);
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

      if (data.ticketTypeId && data.quantity) {
        await this.adjustTicketSales({
          eventId: data.eventId,
          ticketTypeId: data.ticketTypeId,
          delta: -data.quantity
        });
      }

      // Decrement promo code usage if a promo code was used
      if (data.promoCodeId) {
        await this.decrementPromoCodeUsage(data.eventId, data.promoCodeId);
      }

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
      
      // Check registration status
      const registrationStatus = eventData.registrationStatus || 'open';
      if (registrationStatus === 'closed') {
        return {
          isValid: false,
          pricing: {} as TicketPricing,
          message: 'Registration is closed for this event'
        };
      }
      
      if (registrationStatus === 'walk-in-only') {
        return {
          isValid: false,
          pricing: {} as TicketPricing,
          message: 'This event is accepting walk-ins only. Please register at the venue.'
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

      const maxQuantity = Number.isFinite(ticketType.maxQuantity) ? ticketType.maxQuantity as number : undefined;
      const currentSold = Number.isFinite(ticketType.currentSold) ? ticketType.currentSold as number : 0;

      if (maxQuantity && maxQuantity > 0) {
        const available = Math.max(0, maxQuantity - currentSold);

        if (available <= 0) {
          return {
            isValid: false,
            pricing: {} as TicketPricing,
            message: 'Ticket is sold out'
          };
        }

        if (registrationData.quantity > available) {
          return {
            isValid: false,
            pricing: {} as TicketPricing,
            message: `Only ${available} tickets remaining`
          };
        }
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
          (!pc.maxUses || pc.currentUses < pc.maxUses)
        );
        
        if (validPromoCode) {
          promoCode = validPromoCode as any;
          if (validPromoCode.discountType === 'percentage') {
            discountAmount = (originalPrice * validPromoCode.discountValue) / 100;
          } else {
            discountAmount = validPromoCode.discountValue;
          }
        } else {
          // Invalid promo code - reset it
          console.warn('Invalid promo code provided:', registrationData.promoCode);
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
          promoCode: (promoCode as any).code,
          promoCodeId: (promoCode as any).id  // Add the promo code ID
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

  /**
   * Delete a registration and its associated payment proofs
   * @param registrationId - Registration ID to delete
   */
  static async deleteRegistration(registrationId: string): Promise<void> {
    try {
      // Get registration data first to find associated payment proofs
      const registrationRef = doc(db, 'registrations', registrationId);
      const registrationSnap = await getDoc(registrationRef);
      
      if (!registrationSnap.exists()) {
        throw new Error('Registration not found');
      }

      const registrationData = registrationSnap.data();
      
      // Return tickets to available pool before deleting
      // Only adjust if the registration wasn't already cancelled
      if (registrationData.attendanceStatus !== 'cancelled' && 
          registrationData.ticketTypeId && 
          registrationData.quantity) {
        await this.adjustTicketSales({
          eventId: registrationData.eventId,
          ticketTypeId: registrationData.ticketTypeId,
          delta: -registrationData.quantity // Negative to add back to available
        });

        // Also decrement attendee count
        const eventRef = doc(db, this.EVENTS_COLLECTION, registrationData.eventId);
        await updateDoc(eventRef, {
          currentAttendees: increment(-registrationData.quantity),
          updatedAt: serverTimestamp()
        });

        // Decrement promo code usage if a promo code was used
        if (registrationData.promoCodeId) {
          await this.decrementPromoCodeUsage(registrationData.eventId, registrationData.promoCodeId);
        }
      }
      
      // Delete all associated payment proofs
      if (registrationData.paymentProofId) {
        try {
          const { PaymentService } = await import('./paymentService');
          await PaymentService.deletePaymentProof(registrationData.paymentProofId);
        } catch (error) {
          console.warn('Failed to delete payment proof:', error);
        }
      }

      // Also query for any other payment proofs linked to this registration
      const paymentProofsQuery = query(
        collection(db, 'paymentProofs'),
        where('registrationId', '==', registrationId)
      );
      const paymentProofsSnap = await getDocs(paymentProofsQuery);
      
      // Delete all found payment proofs
      const deletePromises = paymentProofsSnap.docs.map(async (proofDoc) => {
        try {
          const { PaymentService } = await import('./paymentService');
          await PaymentService.deletePaymentProof(proofDoc.id);
        } catch (error) {
          console.warn(`Failed to delete payment proof ${proofDoc.id}:`, error);
        }
      });
      
      await Promise.all(deletePromises);
      
      // Finally, delete the registration document
      await deleteDoc(registrationRef);
      
      console.log(`Registration ${registrationId} and associated payment proofs deleted successfully`);
    } catch (error) {
      console.error('Error deleting registration:', error);
      throw new Error('Failed to delete registration');
    }
  }

  /**
   * Create a walk-in registration (immediate registration at event)
   * Skips online payment flow and creates registration with specified payment status
   */
  static async createWalkInRegistration(data: {
    eventId: string;
    userDetails: {
      name: string;
      email: string;
      phoneNumber?: string;
      organization?: string;
    };
    ticketTypeId: string;
    quantity: number;
    paymentStatus: 'paid' | 'pending';
    paymentMethod?: string;
    paymentReference?: string;
    notes?: string;
    customFormData?: Record<string, any>; // Store all form responses
    registeredBy: string; // UID of admin/organizer
  }): Promise<{
    registrationId: string;
    qrCode: string;
  }> {
    try {
      // Validate event
      const eventRef = doc(db, this.EVENTS_COLLECTION, data.eventId);
      const eventSnap = await getDoc(eventRef);
      
      if (!eventSnap.exists()) {
        throw new Error('Event not found');
      }
      
      const event = eventSnap.data() as Event;
      
      // Check event status - allow for published and ongoing events
      if (event.status !== 'published' && event.status !== 'ongoing') {
        throw new Error('Walk-in registrations are only allowed for published or ongoing events');
      }
      
      // Find ticket type
      const ticketType = event.ticketTypes.find(tt => tt.id === data.ticketTypeId);
      if (!ticketType) {
        throw new Error('Ticket type not found');
      }
      
      // Check ticket availability
      if (ticketType.maxQuantity) {
        const available = ticketType.maxQuantity - ticketType.currentSold;
        if (data.quantity > available) {
          throw new Error(`Only ${available} tickets available for ${ticketType.name}`);
        }
      }
      
      // Check event capacity
      if (event.maxAttendees) {
        const available = event.maxAttendees - event.currentAttendees;
        if (data.quantity > available) {
          throw new Error(`Event is full. Only ${available} spots remaining`);
        }
      }
      
      // Generate registration ID and QR code
      const registrationRef = doc(collection(db, this.REGISTRATIONS_COLLECTION));
      const registrationId = registrationRef.id;
      const qrCode = this.generateQRCode(registrationId);
      
      // Calculate pricing
      const originalAmount = ticketType.price * data.quantity;
      const totalAmount = originalAmount; // No discounts for walk-ins by default
      
      // Create registration document
      const registration: Omit<Registration, 'id'> = {
        eventId: data.eventId,
        userId: '', // Anonymous - walk-in attendee
        userDetails: {
          name: data.userDetails.name,
          email: data.userDetails.email,
          phoneNumber: data.userDetails.phoneNumber,
          organization: data.userDetails.organization
        },
        ticketTypeId: data.ticketTypeId,
        quantity: data.quantity,
        originalAmount,
        discountAmount: 0,
        totalAmount,
        currency: ticketType.currency || 'PHP',
        pricing: {
          ticketTypeId: data.ticketTypeId,
          originalPrice: ticketType.price,
          currentPrice: ticketType.price,
          discountAmount: 0
        },
        paymentStatus: data.paymentStatus,
        attendanceStatus: data.paymentStatus === 'paid' ? 'confirmed' : 'registered',
        feedbackSubmitted: false,
        certificateIssued: false,
        qrCode,
        registrationDate: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
        registrationType: 'walk-in',
        registeredBy: data.registeredBy
      };
      
      // Add payment details if paid
      if (data.paymentStatus === 'paid' && data.paymentMethod) {
        (registration as any).paymentDetails = {
          paymentMethod: data.paymentMethod,
          paymentReference: data.paymentReference,
          paidAt: serverTimestamp()
        };
      }
      
      // Add notes if provided
      if (data.notes) {
        (registration as any).notes = data.notes;
      }
      
      // Add custom form responses if provided
      if (data.customFormData && Object.keys(data.customFormData).length > 0) {
        (registration as any).customResponses = data.customFormData;
      }
      
      // Save registration
      await setDoc(registrationRef, registration);
      
      // Update event attendee count and ticket sold count
      await updateDoc(eventRef, {
        currentAttendees: increment(data.quantity),
        updatedAt: serverTimestamp()
      });

      await this.adjustTicketSales({
        eventId: data.eventId,
        ticketTypeId: data.ticketTypeId,
        delta: data.quantity
      });
      
      // Send confirmation email (optional for walk-ins)
      try {
        await this.sendRegistrationConfirmationEmail(
          registrationId,
          data.eventId,
          data.userDetails.email,
          data.userDetails.name,
          false // Walk-ins are already processed
        );
      } catch (emailError) {
        console.warn('Failed to send confirmation email for walk-in:', emailError);
        // Don't throw error if email fails
      }
      
      console.log('Walk-in registration created:', registrationId);
      
      return {
        registrationId,
        qrCode
      };
    } catch (error) {
      console.error('Error creating walk-in registration:', error);
      throw error;
    }
  }
} 