import {
  collection,
  deleteDoc,
  deleteField,
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
import { logger } from '../utils/logger';
import { Registration, Event, TicketPricing, FormField } from '../types';
import {
  extractContactDetailsFromResponses,
  validateFormResponses,
  type ResponseValue,
} from '../utils/formResponses';
import { EmailService } from './emailService';
import { EventService } from './eventService';
import { resolveDisplayStatus, StatusBearingRegistration } from '../utils/registrationStatus';
import { toDateSafe, toISOStringSafe } from '../utils/dateUtils';
import { AuditLogService } from './auditLogService';
import { swrCache } from '../utils/swrCache';

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

  private static readonly CACHE_TTL_MS = 30_000; // 30 seconds

  /**
   * Invalidate cache for a specific event or the entire registrations cache.
   */
  static invalidateCache(eventId?: string): void {
    if (eventId) {
      swrCache.delete(`regs:${eventId}`);
      swrCache.delete('regs:all');
      swrCache.deletePrefix('regs:organizer:');
      swrCache.delete('stats:dashboard');
      swrCache.delete(`stats:event:${eventId}`);
    } else {
      swrCache.deletePrefix('regs:');
      swrCache.delete('stats:dashboard');
      swrCache.deletePrefix('stats:event:');
    }
  }

  /**
   * Prefetch event registrations into cache on hover or intent.
   * Respects Save-Data and slow 2G mobile connections.
   */
  static prefetchEventRegistrations(eventId: string): void {
    if (!eventId) return;
    if (typeof navigator !== 'undefined') {
      const conn = (navigator as any).connection;
      if (conn?.saveData || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g') {
        return;
      }
    }
    void this.getEventRegistrations(eventId).catch(() => {
      // Opportunistic background prefetch: gracefully swallow permission errors or aborted requests
    });
  }

  private static async adjustTicketSales(params: {
    eventId: string;
    ticketTypeId: string;
    delta: number;
  }): Promise<void> {
    const { eventId, ticketTypeId, delta } = params;
    if (!delta) {
      return;
    }

    logger.log(`Adjusting ticket sales: eventId=${eventId}, ticketTypeId=${ticketTypeId}, delta=${delta}`);
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

        logger.log(`Ticket "${targetTicket.name}": currentSold=${currentSold}, updatedSold=${updatedSold}, maxQuantity=${maxQuantity}`);

        if (updatedSold < 0) {
          // If trying to decrement and would go negative, set to 0 instead
          // This handles cases where registrations were created with errors
          logger.warn(`Ticket sales would go negative (${updatedSold}). Setting to 0 instead.`);
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
        
        logger.log('Ticket sales updated successfully');
      });
    } catch (error) {
      logger.error('Error adjusting ticket sales:', error);
      throw error;
    }
  }

  /**
   * Increment promo code usage counter
   */
  private static async incrementPromoCodeUsage(eventId: string, promoCodeId: string): Promise<void> {
    const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
    const promoConfigRef = doc(db, this.EVENTS_COLLECTION, eventId, 'config', 'promoCodes');

    try {
      await runTransaction(db, async transaction => {
        const [eventSnapshot, promoConfigSnapshot] = await Promise.all([
          transaction.get(eventRef),
          transaction.get(promoConfigRef)
        ]);
        if (!eventSnapshot.exists()) {
          throw new Error('Event not found');
        }

        const eventData = eventSnapshot.data() as Event;
        const configPromos = promoConfigSnapshot.exists() ? promoConfigSnapshot.data()?.promoCodes : null;
        const promoCodes = Array.isArray(configPromos)
          ? [...configPromos]
          : (Array.isArray(eventData.promoCodes) ? [...eventData.promoCodes] : []);
        const promoIndex = promoCodes.findIndex(pc => pc.id === promoCodeId);

        if (promoIndex < 0) {
          logger.warn(`Promo code ${promoCodeId} not found in event ${eventId}`);
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

        transaction.set(promoConfigRef, {
          promoCodes,
          updatedAt: serverTimestamp()
        }, { merge: true });

        if ('promoCodes' in (eventData as any)) {
          transaction.update(eventRef, {
            promoCodes: deleteField(),
            hasPromoCodes: promoCodes.some(pc => pc.isActive !== false),
            updatedAt: serverTimestamp()
          });
        }

        logger.log(`Promo code "${promoCode.code}" usage incremented: ${currentUses} -> ${currentUses + 1}`);
      });
      swrCache.delete(`promos:${eventId}`);
    } catch (error) {
      logger.error('Error incrementing promo code usage:', error);
      throw error;
    }
  }

  /**
   * Decrement promo code usage counter (used when cancelling a registration)
   */
  private static async decrementPromoCodeUsage(eventId: string, promoCodeId: string): Promise<void> {
    const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
    const promoConfigRef = doc(db, this.EVENTS_COLLECTION, eventId, 'config', 'promoCodes');

    try {
      await runTransaction(db, async transaction => {
        const [eventSnapshot, promoConfigSnapshot] = await Promise.all([
          transaction.get(eventRef),
          transaction.get(promoConfigRef)
        ]);
        if (!eventSnapshot.exists()) {
          throw new Error('Event not found');
        }

        const eventData = eventSnapshot.data() as Event;
        const configPromos = promoConfigSnapshot.exists() ? promoConfigSnapshot.data()?.promoCodes : null;
        const promoCodes = Array.isArray(configPromos)
          ? [...configPromos]
          : (Array.isArray(eventData.promoCodes) ? [...eventData.promoCodes] : []);
        const promoIndex = promoCodes.findIndex(pc => pc.id === promoCodeId);

        if (promoIndex < 0) {
          logger.warn(`Promo code ${promoCodeId} not found in event ${eventId}`);
          return; // Don't fail the transaction if promo code is missing
        }

        const promoCode = promoCodes[promoIndex];
        const currentUses = Number.isFinite(promoCode.currentUses) ? promoCode.currentUses : 0;

        // Decrement usage counter, but don't go below 0
        promoCodes[promoIndex] = {
          ...promoCode,
          currentUses: Math.max(0, currentUses - 1)
        };

        transaction.set(promoConfigRef, {
          promoCodes,
          updatedAt: serverTimestamp()
        }, { merge: true });

        if ('promoCodes' in (eventData as any)) {
          transaction.update(eventRef, {
            promoCodes: deleteField(),
            hasPromoCodes: promoCodes.some(pc => pc.isActive !== false),
            updatedAt: serverTimestamp()
          });
        }

        logger.log(`Promo code "${promoCode.code}" usage decremented: ${currentUses} -> ${Math.max(0, currentUses - 1)}`);
      });
      swrCache.delete(`promos:${eventId}`);
    } catch (error) {
      logger.error('Error decrementing promo code usage:', error);
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
      // Validate the form locally, then reserve inventory in a trusted function.
      const validation = await this.validateRegistrationLocally(registrationData);
      
      if (!validation.isValid) {
        throw new Error(validation.message || validation.errors?.join(', ') || 'Registration validation failed');
      }

      const createRegistration = httpsCallable(functions, 'createAnonymousRegistration');
      const result = await createRegistration({ eventId: registrationData.eventId, registrationData });
      const created = result.data as {
        registrationId: string;
        pricing: TicketPricing;
        qrCode: string;
        requiresPayment: boolean;
        paymentLinkToken?: string;
      };

      this.invalidateCache(registrationData.eventId);

      return {
        registrationId: created.registrationId,
        pricing: created.pricing,
        qrCode: created.qrCode,
        requiresPayment: created.requiresPayment,
        paymentLinkToken: created.paymentLinkToken
      };
    } catch (error: any) {
      logger.error('Error creating pending registration:', error);
      throw error instanceof Error ? error : new Error(error?.message || 'Failed to create registration');
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
      logger.log('Registration submission confirmation email sent successfully');
    } catch (error) {
      logger.error('Error sending registration confirmation email:', error);
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
      this.invalidateCache(registrationData.eventId);

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
        logger.error('Error sending approval confirmation email:', emailError);
        // Don't throw - email failure shouldn't break the flow
      }
    } catch (error) {
      logger.error('Error completing registration:', error);
      throw new Error('Failed to complete registration');
    }
  }

  /**
   * Register for an event (legacy method - forwards to createPendingRegistration)
   */
  static async registerForEvent(registrationData: RegistrationData): Promise<{
    registrationId: string;
    pricing: TicketPricing;
    qrCode: string;
    requiresPayment: boolean;
  }> {
    return this.createPendingRegistration(registrationData);
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
        logger.warn('Registration read permission denied (expected for anonymous users)');
        return null;
      }
      logger.error('Error fetching registration:', error);
      throw new Error('Failed to fetch registration');
    }
  }

  static async getRegistrationByPaymentToken(registrationId: string, token: string): Promise<Registration | null> {
    try {
      const resolve = httpsCallable(functions, 'getPaymentRegistration');
      const result = await resolve({ registrationId, token });
      const data = result.data as { registration?: Registration };
      return data.registration || null;
    } catch (error) {
      logger.warn('Payment registration token could not be resolved:', error);
      return null;
    }
  }

  /**
   * Resolve an approved attendee's ticket details using their walletPassToken.
   * Returns sanitized registration and event data for rendering the TicketCard.
   */
  static async getTicketPass(registrationId: string, token: string): Promise<{
    registration: Partial<Registration> & { id: string; qrCode: string };
    event: { id: string; title: string; startDate?: string | Date; timezone?: string; venue?: any; ticketTypes?: any[] };
  } | null> {
    try {
      const resolve = httpsCallable(functions, 'getTicketPass');
      const result = await resolve({ registrationId, token });
      const data = result.data as {
        registration?: Partial<Registration> & { id: string; qrCode: string };
        event?: any;
      };
      if (data?.registration && data?.event) {
        return {
          registration: data.registration,
          event: data.event,
        };
      }
      return null;
    } catch (error) {
      logger.warn('Ticket pass could not be resolved by token:', error);
      return null;
    }
  }

  /**
   * Get all registrations for an event
   */
  static async getEventRegistrations(eventId: string): Promise<Registration[]> {
    if (!eventId) return [];

    return swrCache.getOrFetch(
      `regs:${eventId}`,
      async () => {
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
          logger.error('Error fetching event registrations:', error);
          throw new Error('Failed to fetch event registrations');
        }
      },
      this.CACHE_TTL_MS
    );
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
      logger.warn('RegistrationService.subscribeToEventTicketSales called without an eventId');
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
          logger.warn('Permission denied while subscribing to ticket sales. Falling back to event data.');
        } else {
          logger.error('Error subscribing to event ticket sales:', error);
        }

        if (onError) {
          onError(error as Error);
        }
      }
    );
  }

  /**
   * Get all registrations across all events (platform-wide read; admin only)
   */
  static async getAllRegistrations(): Promise<Registration[]> {
    return swrCache.getOrFetch(
      'regs:all',
      async () => {
        try {
          const registrationsQuery = query(
            collection(db, this.REGISTRATIONS_COLLECTION), // firestore:unscoped-ok - admin platform-wide roster
            orderBy('registrationDate', 'desc')
          );
          const snapshot = await getDocs(registrationsQuery);
          
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Registration));
        } catch (error) {
          logger.error('Error fetching all registrations:', error);
          throw new Error('Failed to fetch all registrations');
        }
      },
      this.CACHE_TTL_MS
    );
  }

  /**
   * Get registrations owned by one organizer.
   *
   * Organizers must never call getAllRegistrations(): firestore.rules now scopes
   * /registrations by organizerUid, so the unscoped query would be denied — and
   * pulling every attendee record across every event is a Data Privacy Act 2012
   * problem regardless of what the rules permit.
   */
  static async getRegistrationsByOrganizer(organizerUid: string): Promise<Registration[]> {
    if (!organizerUid) return [];

    return swrCache.getOrFetch(
      `regs:organizer:${organizerUid}`,
      async () => {
        try {
          const q = query(
            collection(db, this.REGISTRATIONS_COLLECTION),
            where('organizerUid', '==', organizerUid),
            orderBy('registrationDate', 'desc')
          );
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
        } catch (error) {
          logger.error('Error fetching organizer registrations:', error);
          throw new Error('Failed to fetch registrations');
        }
      },
      this.CACHE_TTL_MS
    );
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
      logger.error('Error fetching user registrations:', error);
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

      void AuditLogService.recordAuditLog({
        category: 'event_operations',
        action: 'attendee_checked_in',
        target: {
          type: 'registration',
          id: registrationId,
          label: data.userDetails?.name,
        },
        details: {
          eventId: data.eventId,
          checkInMethod,
          bypassPaymentCheck,
        },
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
        logger.warn('Failed to send check-in notification:', error);
      }
    } catch (error) {
      logger.error('Error checking in attendee:', error);
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
        logger.warn('Failed to send check-in notification:', error);
      }
    } catch (error) {
      logger.error('Error checking in attendee:', error);
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
      let approvalNotificationDetails: {
        eventId: string;
        attendeeEmail: string;
        attendeeName: string;
        isFreeRegistration: boolean;
      } | null = null;

      if (notes) {
        updateData.adminNotes = notes;
      }

      // If approving, also update payment status if needed and prepare approval email details
      if (status === 'approved') {
        const registration = await getDoc(registrationRef);
        if (registration.exists()) {
          const data = registration.data();
          const isFree = data.totalAmount === 0 || !data.totalAmount;
          if (isFree) {
            updateData.paymentStatus = 'paid';
          }
          if (!data.walletPassToken) {
            updateData.walletPassToken = typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID().replace(/-/g, '') + Math.random().toString(36).substring(2, 10)
              : Math.random().toString(36).substring(2) + Date.now().toString(36);
          }
          const email = (data.userDetails?.email || data.attendeeEmail || data.email || '').trim();
          const name = (data.userDetails?.name || data.attendeeName || data.name || 'Attendee').trim();
          if (email && data.eventId) {
            approvalNotificationDetails = {
              eventId: data.eventId,
              attendeeEmail: email,
              attendeeName: name,
              isFreeRegistration: isFree
            };
          }
        }
      }

      await updateDoc(registrationRef, updateData);
      this.invalidateCache();

      if (approvalNotificationDetails && status === 'approved') {
        try {
          const eventRef = doc(db, this.EVENTS_COLLECTION, approvalNotificationDetails.eventId);
          const eventSnap = await getDoc(eventRef);
          const eventTitle = eventSnap.exists() ? (eventSnap.data() as Event).title : 'Event';
          await EmailService.sendPaymentNotification({
            registrationId,
            status: 'approved',
            eventTitle,
            attendeeEmail: approvalNotificationDetails.attendeeEmail,
            attendeeName: approvalNotificationDetails.attendeeName,
            isFreeRegistration: approvalNotificationDetails.isFreeRegistration
          });
        } catch (notificationError) {
          logger.warn('Failed to send registration approval email notification:', notificationError);
        }
      }

      void AuditLogService.recordAuditLog({
        category: 'event_operations',
        action: status === 'approved' ? 'registration_approved' : 'registration_rejected',
        target: {
          type: 'registration',
          id: registrationId,
        },
        details: {
          status,
          notes: notes ?? null,
        },
      });
    } catch (error) {
      logger.error('Error updating registration status:', error);
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
      logger.error('Error fetching registration stats:', error);
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
      const eventDate = toDateSafe(event.startDate) ?? now;
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
      logger.error('Error verifying QR code:', error);
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
          logger.warn('Failed to process refund:', error);
        }
      }
    } catch (error) {
      logger.error('Error cancelling registration:', error);
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
        toISOStringSafe(reg.registrationDate, ''),
        reg.qrCode
      ]);

      // Combine headers and rows
      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      logger.error('Error exporting registrations:', error);
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

      if (registrationData.quantity !== 1) {
        return {
          isValid: false,
          pricing: {} as TicketPricing,
          message: 'Only 1 ticket per person is allowed'
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
      }
      
      // Calculate pricing (authoritative promo code validation and discount calculation
      // happens server-side inside createAnonymousRegistration transaction)
      const originalPrice = ticketType.price || 0;
      let discountAmount = 0;
      let appliedCode: string | undefined;

      if (registrationData.promoCode) {
        const remoteValidation = await EventService.validatePromoCodeRemote({
          eventId: registrationData.eventId,
          code: registrationData.promoCode,
          ticketTypeId: registrationData.ticketTypeId
        });

        if (!remoteValidation.valid) {
          return {
            isValid: false,
            pricing: {} as TicketPricing,
            message: remoteValidation.message || 'Invalid promo code'
          };
        }

        appliedCode = remoteValidation.code || registrationData.promoCode.trim().toUpperCase();
        if (typeof remoteValidation.discountAmount === 'number') {
          discountAmount = remoteValidation.discountAmount;
        } else if (remoteValidation.discountType === 'percentage' && typeof remoteValidation.discountValue === 'number') {
          discountAmount = (originalPrice * remoteValidation.discountValue) / 100;
          if (typeof remoteValidation.maxDiscountAmount === 'number') {
            discountAmount = Math.min(discountAmount, remoteValidation.maxDiscountAmount);
          }
        } else if (typeof remoteValidation.discountValue === 'number') {
          discountAmount = Math.min(remoteValidation.discountValue, originalPrice);
        }
      }

      const currentPrice = Math.max(0, originalPrice - discountAmount);

      const pricing: TicketPricing = {
        ticketTypeId: registrationData.ticketTypeId,
        originalPrice,
        currentPrice,
        discountAmount,
        ...(appliedCode ? {
          discountType: 'promo_code' as const,
          promoCode: appliedCode
        } : {})
      };
      
      return {
        isValid: true,
        pricing
      };
      
    } catch (error) {
      logger.error('Error validating registration locally:', error);
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
   * @param force - Bypass confirmed registration checks (admin only)
   */
  static async deleteRegistration(registrationId: string, force = false): Promise<void> {
    try {
      // Get registration data first to find associated payment proofs
      const registrationRef = doc(db, 'registrations', registrationId);
      const registrationSnap = await getDoc(registrationRef);
      
      if (!registrationSnap.exists()) {
        throw new Error('Registration not found');
      }

      const registrationData = registrationSnap.data();

      // Prevent deleting confirmed or attended registrations unless force is true (admin override)
      const displayStatus = resolveDisplayStatus(registrationData as StatusBearingRegistration);
      if (
        !force && (
          displayStatus === 'confirmed' ||
          displayStatus === 'attended' ||
          registrationData.paymentStatus === 'paid' ||
          registrationData.registrationStatus === 'approved' ||
          registrationData.status === 'confirmed'
        )
      ) {
        throw new Error('Cannot delete a confirmed registration');
      }
      
      // Return tickets to available pool before deleting
      // Only adjust if the registration wasn't already cancelled
      if (registrationData.attendanceStatus !== 'cancelled' && 
          registrationData.ticketTypeId && 
          registrationData.quantity) {
        try {
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
        } catch (adjustError) {
          logger.warn('Failed to adjust ticket sales during registration deletion:', adjustError);
        }
      }
      
      // Delete all associated payment proofs
      if (registrationData.paymentProofId) {
        try {
          const { PaymentService } = await import('./paymentService');
          await PaymentService.deletePaymentProof(registrationData.paymentProofId);
        } catch (error) {
          logger.warn('Failed to delete payment proof:', error);
        }
      }

      // Also query for any other payment proofs linked to this registration
      try {
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
            logger.warn(`Failed to delete payment proof ${proofDoc.id}:`, error);
          }
        });
        
        await Promise.all(deletePromises);
      } catch (proofQueryError) {
        logger.warn('Failed to query or delete additional payment proofs for registration:', proofQueryError);
      }
      
      // Finally, delete the registration document
      await deleteDoc(registrationRef);
      this.invalidateCache(registrationData.eventId);

      void AuditLogService.recordAuditLog({
        category: 'event_operations',
        action: 'registration_deleted',
        target: {
          type: 'registration',
          id: registrationId,
          label: (registrationData.userDetails?.name || registrationData.name) ?? undefined,
        },
        details: {
          eventId: registrationData.eventId,
        },
      });
      
      logger.log(`Registration ${registrationId} and associated payment proofs deleted successfully`);
    } catch (error) {
      logger.error('Error deleting registration:', error);
      throw error instanceof Error ? error : new Error('Failed to delete registration');
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
        if (available <= 0) {
          throw new Error(`Tickets for ${ticketType.name} are sold out`);
        }
      }
      
      // Check event capacity
      if (event.maxAttendees) {
        const available = event.maxAttendees - event.currentAttendees;
        if (available <= 0) {
          throw new Error('Event is full. No spots remaining');
        }
      }

      // Prevent duplicate registration for walk-in if email already registered
      if (data.userDetails.email) {
        const normalizedEmail = data.userDetails.email.trim().toLowerCase();
        const dupQuery = query(
          collection(db, this.REGISTRATIONS_COLLECTION),
          where('eventId', '==', data.eventId),
          where('userDetails.email', '==', normalizedEmail)
        );
        const dupSnap = await getDocs(dupQuery);
        const activeDup = dupSnap.docs.find(d => {
          const reg = d.data() as Registration;
          return reg.attendanceStatus !== 'cancelled' && reg.paymentStatus !== 'cancelled';
        });
        if (activeDup) {
          throw new Error(`Attendee with email "${normalizedEmail}" is already registered for this event.`);
        }
      }
      
      // Generate registration ID and QR code
      const registrationRef = doc(collection(db, this.REGISTRATIONS_COLLECTION));
      const registrationId = registrationRef.id;
      const qrCode = this.generateQRCode(registrationId);
      
      // Calculate pricing (strictly 1 ticket)
      const originalAmount = ticketType.price;
      const totalAmount = originalAmount; // No discounts for walk-ins by default
      
      // Create registration document
      const registration: Omit<Registration, 'id'> = {
        eventId: data.eventId,
        userId: '', // Anonymous - walk-in attendee
        userDetails: {
          name: data.userDetails.name,
          email: data.userDetails.email.trim().toLowerCase(),
          phoneNumber: data.userDetails.phoneNumber,
          organization: data.userDetails.organization
        },
        ticketTypeId: data.ticketTypeId,
        quantity: 1,
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
        currentAttendees: increment(1),
        updatedAt: serverTimestamp()
      });

      await this.adjustTicketSales({
        eventId: data.eventId,
        ticketTypeId: data.ticketTypeId,
        delta: 1
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
        logger.warn('Failed to send confirmation email for walk-in:', emailError);
        // Don't throw error if email fails
      }
      
      logger.log('Walk-in registration created:', registrationId);
      
      return {
        registrationId,
        qrCode
      };
    } catch (error) {
      logger.error('Error creating walk-in registration:', error);
      throw error;
    }
  }

  /**
   * Update attendee details and optional admin notes for an existing registration.
   */
  static async updateAttendeeDetails(
    registrationId: string,
    details: {
      name: string;
      email: string;
      phone?: string | null;
      organization?: string | null;
      adminNotes?: string | null;
    }
  ): Promise<void> {
    try {
      const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
      const updateData: Record<string, any> = {
        'userDetails.name': details.name.trim(),
        'userDetails.email': details.email.trim().toLowerCase(),
        'userDetails.phoneNumber': details.phone ? details.phone.trim() : null,
        'userDetails.organization': details.organization ? details.organization.trim() : null,
        updatedAt: serverTimestamp(),
      };

      if (details.adminNotes !== undefined) {
        updateData.adminNotes = details.adminNotes ? details.adminNotes.trim() : null;
      }

      await updateDoc(registrationRef, updateData);
      this.invalidateCache();
      logger.log(`Registration ${registrationId} attendee details updated successfully`);
    } catch (error) {
      logger.error('Error updating attendee details:', error);
      throw error;
    }
  }

  /**
   * Atomically transfer a registration from its current ticket tier to a target ticket tier,
   * recalculating the pricing snapshot (including promo code discounts) and shifting
   * `currentSold` counters on the parent event document.
   */
  static async transferTicketType(params: {
    registrationId: string;
    targetTicketTypeId: string;
    forceCapacity?: boolean;
  }): Promise<{
    alreadyOnTarget: boolean;
    previousTicketTypeId: string;
    targetTicketTypeId: string;
    targetTicketTypeName: string;
    originalAmount: number;
    discountAmount: number;
    totalAmount: number;
    pricing: Record<string, any>;
  }> {
    const { registrationId, targetTicketTypeId, forceCapacity = false } = params;
    if (!registrationId || !targetTicketTypeId) {
      throw new Error('Registration ID and target ticket type ID are required');
    }

    const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);

    try {
      let eventIdForCache = '';
      let attendeeLabel: string | undefined;

      const result = await runTransaction(db, async (transaction) => {
        const regSnap = await transaction.get(registrationRef);
        if (!regSnap.exists()) {
          throw new Error('Registration not found');
        }

        const regData = regSnap.data() as Record<string, any>;
        const eventId = String(regData.eventId || '');
        if (!eventId) {
          throw new Error('Registration is missing eventId');
        }
        eventIdForCache = eventId;
        attendeeLabel = regData.userDetails?.name || regData.name || undefined;

        const previousTicketTypeId = String(regData.ticketTypeId || '');
        const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
        const promoConfigRef = doc(db, this.EVENTS_COLLECTION, eventId, 'config', 'promoCodes');

        const [eventSnap, promoConfigSnap] = await Promise.all([
          transaction.get(eventRef),
          transaction.get(promoConfigRef),
        ]);

        if (!eventSnap.exists()) {
          throw new Error('Event not found');
        }

        const eventData = eventSnap.data() as Event;
        const ticketTypes = Array.isArray(eventData.ticketTypes)
          ? eventData.ticketTypes.map((t) => ({ ...t }))
          : [];

        const targetIndex = ticketTypes.findIndex((t) => t.id === targetTicketTypeId);
        if (targetIndex < 0) {
          throw new Error('Target ticket type not found on event');
        }

        const targetTicket = ticketTypes[targetIndex];
        const quantity =
          typeof regData.quantity === 'number' && regData.quantity > 0 ? regData.quantity : 1;

        // Idempotent no-op if already assigned to the target ticket tier
        if (previousTicketTypeId === targetTicketTypeId) {
          const existingPricing =
            regData.pricing && typeof regData.pricing === 'object' ? { ...regData.pricing } : {};
          return {
            alreadyOnTarget: true,
            previousTicketTypeId,
            targetTicketTypeId,
            targetTicketTypeName: targetTicket.name,
            originalAmount: Number(regData.originalAmount ?? targetTicket.price * quantity),
            discountAmount: Number(regData.discountAmount ?? 0),
            totalAmount: Number(regData.totalAmount ?? 0),
            pricing: existingPricing,
          };
        }

        const isCancelled =
          regData.attendanceStatus === 'cancelled' || regData.paymentStatus === 'cancelled';

        if (!isCancelled) {
          // 1. Check capacity on target ticket type
          const targetSold = Number.isFinite(targetTicket.currentSold)
            ? targetTicket.currentSold
            : 0;
          const targetMax = Number.isFinite(targetTicket.maxQuantity)
            ? targetTicket.maxQuantity
            : undefined;

          if (!forceCapacity && targetMax !== undefined && targetMax > 0 && targetSold + quantity > targetMax) {
            throw new Error(`Ticket tier "${targetTicket.name}" has reached its maximum capacity`);
          }

          // 2. Decrement previous ticket type currentSold
          const prevIndex = ticketTypes.findIndex((t) => t.id === previousTicketTypeId);
          if (prevIndex >= 0) {
            const prevTicket = ticketTypes[prevIndex];
            const prevSold = Number.isFinite(prevTicket.currentSold) ? prevTicket.currentSold : 0;
            ticketTypes[prevIndex] = {
              ...prevTicket,
              currentSold: Math.max(0, prevSold - quantity),
            };
          }

          // 3. Increment target ticket type currentSold
          const refreshedTarget = ticketTypes[targetIndex];
          const refreshedTargetSold = Number.isFinite(refreshedTarget.currentSold)
            ? refreshedTarget.currentSold
            : 0;
          ticketTypes[targetIndex] = {
            ...refreshedTarget,
            currentSold: refreshedTargetSold + quantity,
          };
        }

        // 4. Recalculate pricing snapshot (respecting promo code discounts)
        const unitPrice = Number.isFinite(targetTicket.price) ? Number(targetTicket.price) : 0;
        const originalAmount = unitPrice * quantity;

        const rawPromoCode =
          typeof regData.promoCode === 'string' && regData.promoCode.trim()
            ? regData.promoCode.trim()
            : typeof regData.pricing?.promoCode === 'string' && regData.pricing.promoCode.trim()
            ? regData.pricing.promoCode.trim()
            : typeof regData.pricing?.promoCode?.code === 'string' &&
              regData.pricing.promoCode.code.trim()
            ? regData.pricing.promoCode.code.trim()
            : '';

        let unitDiscount = 0;

        if (rawPromoCode) {
          const configPromos = promoConfigSnap.exists()
            ? promoConfigSnap.data()?.promoCodes
            : null;
          const promoList: any[] = Array.isArray(configPromos)
            ? configPromos
            : Array.isArray((eventData as any).promoCodes)
            ? (eventData as any).promoCodes
            : [];

          const normalizedCode = rawPromoCode.toUpperCase();
          const matchedPromo = promoList.find(
            (pc) =>
              pc &&
              typeof pc.code === 'string' &&
              pc.code.trim().toUpperCase() === normalizedCode
          );

          if (matchedPromo) {
            const discountType =
              matchedPromo.discountType === 'fixed' ? 'fixed' : 'percentage';
            const discountValue = Number(matchedPromo.discountValue || 0);
            const maxDiscount =
              typeof matchedPromo.maxDiscountAmount === 'number' &&
              matchedPromo.maxDiscountAmount > 0
                ? matchedPromo.maxDiscountAmount
                : null;

            if (discountType === 'percentage') {
              const rawDisc = (unitPrice * discountValue) / 100;
              const cappedDisc = maxDiscount !== null ? Math.min(rawDisc, maxDiscount) : rawDisc;
              unitDiscount = Math.min(cappedDisc, unitPrice);
            } else {
              unitDiscount = Math.min(discountValue, unitPrice);
            }
          } else {
            // Fallback: if registration previously had a 100% complimentary promo discount, preserve 100%
            const prevOrig = Number(regData.originalAmount ?? regData.pricing?.originalPrice ?? 0);
            const prevDisc = Number(regData.discountAmount ?? regData.pricing?.discountAmount ?? 0);
            const prevTotal = Number(regData.totalAmount ?? regData.pricing?.currentPrice ?? 0);
            if (prevTotal === 0 && (prevOrig === 0 || prevDisc >= prevOrig)) {
              unitDiscount = unitPrice;
            } else if (prevOrig > 0 && prevDisc > 0) {
              const ratio = Math.min(1, prevDisc / prevOrig);
              unitDiscount = Math.min(unitPrice, unitPrice * ratio);
            }
          }
        }

        const unitFinalPrice = Math.max(0, unitPrice - unitDiscount);
        const discountAmount = unitDiscount * quantity;
        const totalAmount = unitFinalPrice * quantity;

        const existingPricing =
          regData.pricing && typeof regData.pricing === 'object' ? regData.pricing : {};
        const updatedPricing: Record<string, any> = {
          ticketTypeId: targetTicketTypeId,
          ticketTypeName: targetTicket.name,
          originalPrice: unitPrice,
          currentPrice: unitFinalPrice,
          discountAmount: unitDiscount,
        };

        if (rawPromoCode) {
          updatedPricing.discountType = existingPricing.discountType || 'promo_code';
          updatedPricing.promoCode = existingPricing.promoCode ?? rawPromoCode;
        }
        const promoCodeIdVal = regData.promoCodeId ?? existingPricing.promoCodeId;
        if (typeof promoCodeIdVal === 'string' && promoCodeIdVal) {
          updatedPricing.promoCodeId = promoCodeIdVal;
        }

        transaction.update(registrationRef, {
          ticketTypeId: targetTicketTypeId,
          originalAmount,
          discountAmount,
          totalAmount,
          pricing: updatedPricing,
          updatedAt: serverTimestamp(),
        });

        if (!isCancelled) {
          transaction.update(eventRef, {
            ticketTypes,
            updatedAt: serverTimestamp(),
          });
        }

        return {
          alreadyOnTarget: false,
          previousTicketTypeId,
          targetTicketTypeId,
          targetTicketTypeName: targetTicket.name,
          originalAmount,
          discountAmount,
          totalAmount,
          pricing: updatedPricing,
        };
      });

      this.invalidateCache(eventIdForCache || undefined);
      EventService.invalidateCache(eventIdForCache || undefined);

      if (!result.alreadyOnTarget) {
        void AuditLogService.recordAuditLog({
          category: 'event_operations',
          action: 'registration_ticket_transferred',
          target: {
            type: 'registration',
            id: registrationId,
            ...(attendeeLabel ? { label: attendeeLabel } : {}),
          },
          details: {
            eventId: eventIdForCache,
            previousTicketTypeId: result.previousTicketTypeId,
            targetTicketTypeId: result.targetTicketTypeId,
            targetTicketTypeName: result.targetTicketTypeName,
            totalAmount: result.totalAmount,
          },
        });
      }

      return result;
    } catch (error) {
      logger.error('Error transferring registration ticket type:', error);
      throw error instanceof Error ? error : new Error('Failed to transfer ticket type');
    }
  }

  /**
   * Updates an attendee's form responses (customResponses). Admin-only per
   * CASL 'editResponses' and the matching firestore.rules clause — the caller
   * gates the UI; the rules are the security boundary.
   *
   * Enforces the event form's own validation rules (required fields, email /
   * phone formats) before writing, and keeps `userDetails` contact fields in
   * sync with the corrected answers so every consumer reads one truth.
   *
   * Idempotent: re-submitting the same responses rewrites the same values.
   *
   * @throws Error with a user-facing message when validation fails or the
   *   registration does not belong to `eventId`.
   */
  static async updateRegistrationFormResponses(
    registrationId: string,
    eventId: string,
    responses: Record<string, ResponseValue | undefined>,
    formFields: FormField[]
  ): Promise<void> {
    // Validate against the form definition first — required fields and
    // per-field type constraints (email/phone format, lengths, options).
    const errors = validateFormResponses(responses, formFields);
    const firstError = Object.values(errors)[0];
    if (firstError) {
      throw new Error(firstError);
    }

    // Zero `undefined` in Firestore writes (AGENTS.md §5.1): drop unset keys,
    // keep explicit empty strings so an admin can clear an optional answer.
    const sanitized: Record<string, ResponseValue> = {};
    for (const [key, value] of Object.entries(responses)) {
      if (value !== undefined) {
        sanitized[key] = value;
      }
    }

    const registrationRef = doc(db, this.REGISTRATIONS_COLLECTION, registrationId);
    const snapshot = await getDoc(registrationRef);
    if (!snapshot.exists()) {
      throw new Error('Registration not found');
    }
    const data = snapshot.data();
    // Scoped-write guard (AGENTS.md §5.2): never touch a registration that
    // does not belong to the event the editor is working in.
    if (data.eventId !== eventId) {
      throw new Error('Registration does not belong to this event');
    }

    const updateData: Record<string, unknown> = {
      customResponses: sanitized,
      updatedAt: serverTimestamp(),
    };

    // Sync the contact fields the form collects so `userDetails` never
    // contradicts the corrected responses. Dot paths update only these keys;
    // cleared values are written as null rather than left stale.
    const details = extractContactDetailsFromResponses(sanitized, formFields);
    if ('name' in details) updateData['userDetails.name'] = details.name || null;
    if ('email' in details) updateData['userDetails.email'] = details.email || null;
    if ('phone' in details) updateData['userDetails.phoneNumber'] = details.phone || null;

    await updateDoc(registrationRef, updateData);

    void AuditLogService.recordAuditLog({
      category: 'event_operations',
      action: 'registration_responses_updated',
      target: {
        type: 'registration',
        id: registrationId,
        ...(data.userDetails?.name ? { label: data.userDetails.name } : {}),
      },
      details: {
        eventId,
        changedFields: Object.keys(sanitized),
      },
    });

    // The attendees list and the registration document cache are stale now.
    swrCache.delete('regs:all');
    swrCache.delete(`regs:${eventId}`);
    swrCache.deletePrefix('regs:organizer:');
    swrCache.delete('stats:dashboard');
    swrCache.delete(`stats:event:${eventId}`);
  }
}
