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
  Timestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../config/firebase';
import { Event, TicketType, PromoCode, FormField } from '../types';

// Interface for event form data
export interface EventFormData {
  // Basic Info
  title: string;
  description: string;
  shortDescription: string;
  imageUrl?: string;

  // Date & Time
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  timezone: string;

  // Venue
  venueType: 'online' | 'offline' | 'hybrid';
  venueName?: string;
  venueAddress?: string;
  city: string;

  // Speakers (as per PRD requirement)
  speakers: {
    id: string;
    name: string;
    title: string;
    company?: string;
    bio: string;
    photoUrl?: string;
  }[];

  // Pricing & Tickets
  ticketTypes: TicketType[];
  promoCodes: PromoCode[];

  // Legacy pricing (for backward compatibility)
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
  category: string;
  tags: string[];
  requirements: string[];
  registrationDeadline?: string;
  registrationStatus?: 'open' | 'closed' | 'walk-in-only';
}

interface PaymentConfig {
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
}

// Firebase service for event management
export class EventService {
  private static readonly EVENTS_COLLECTION = 'events';
  private static readonly EVENT_IMAGES_PATH = 'event-images';
  private static readonly SPEAKER_PHOTOS_PATH = 'speaker-photos';
  private static readonly PAYMENT_QR_PATH = 'payment-qr';

  /**
   * Recursively remove undefined values from an object to prevent Firestore errors
   */
  private static removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    // Strip functions entirely (e.g., objects carrying toDate as a function)
    if (typeof obj === 'function') {
      return undefined as any;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item)).filter(item => item !== undefined);
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && typeof value !== 'function') {
          const cleanedValue = this.removeUndefinedValues(value);
          if (cleanedValue !== undefined) {
            cleaned[key] = cleanedValue;
          }
        }
      }
      return cleaned;
    }
    
    return obj;
  }

  /**
   * Sanitize speakers to ensure Firestore-serializable values only
   * - Keep whitelisted fields
   * - Drop preview data URLs (base64) to avoid oversized/invalid values
   * - Trim strings and remove empty optional fields
   */
  private static sanitizeSpeakers(speakers: any[] = []): any[] {
    return (speakers || []).map((s) => {
      const safe: any = {
        id: String(s.id ?? '').trim(),
        name: typeof s.name === 'string' ? s.name.trim() : '',
        title: typeof s.title === 'string' ? s.title.trim() : '',
        bio: typeof s.bio === 'string' ? s.bio.trim() : ''
      };

      if (s.company && typeof s.company === 'string' && s.company.trim()) {
        safe.company = s.company.trim();
      }

      // Only persist hosted URLs for photoUrl; ignore base64 data URLs
      if (s.photoUrl && typeof s.photoUrl === 'string') {
        const url = s.photoUrl.trim();
        if (url && !url.startsWith('data:')) {
          safe.photoUrl = url;
        }
      }

      return this.removeUndefinedValues(safe);
    });
  }

  /**
   * Convert various date-like inputs to Firestore Timestamp
   */
  private static toFirestoreTimestamp(value: any): Timestamp | undefined {
    try {
      if (!value) return undefined;
      if (value instanceof Timestamp) return value;
      if (value instanceof Date) return Timestamp.fromDate(value);
      if (typeof value === 'number') return Timestamp.fromMillis(value);
      if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return Timestamp.fromDate(d);
        return undefined;
      }
      if (typeof value === 'object') {
        if (typeof (value as any).toDate === 'function') {
          const d = (value as any).toDate();
          if (d instanceof Date && !isNaN(d.getTime())) return Timestamp.fromDate(d);
        }
        if (typeof (value as any).seconds === 'number') {
          const seconds = (value as any).seconds as number;
          const nanos = (value as any).nanoseconds as number | undefined;
          return new Timestamp(seconds, nanos ?? 0);
        }
      }
    } catch (_e) {
      // fall through
    }
    return undefined;
  }

  /**
   * Sanitize ticket types to ensure Firestore-serializable values
   */
  private static sanitizeTicketTypes(ticketTypes: TicketType[] = []): TicketType[] {
    return ticketTypes.map((t) => {
      const sanitized: any = { ...t };
      // Coerce required numeric fields
      sanitized.price = typeof t.price === 'number' ? t.price : 0;
      sanitized.currentSold = typeof t.currentSold === 'number' ? t.currentSold : 0;
      sanitized.isActive = !!t.isActive;
      // Convert date-like fields

      const vf = this.toFirestoreTimestamp((t as any).validFrom);
      if (vf) sanitized.validFrom = vf; else delete sanitized.validFrom;

      const vu = this.toFirestoreTimestamp((t as any).validUntil);
      if (vu) sanitized.validUntil = vu; else delete sanitized.validUntil;

      // Remove any accidental function-valued properties
      return this.removeUndefinedValues(sanitized);
    });
  }

  /**
   * Sanitize promo codes to ensure Firestore-serializable values
   */
  private static sanitizePromoCodes(promoCodes: PromoCode[] = []): any[] {
    return promoCodes.map((p) => {
      const sanitized: any = { ...p };
      const fieldsToConvert = ['validFrom', 'validUntil', 'createdAt', 'updatedAt'];
      fieldsToConvert.forEach((k) => {
        const ts = this.toFirestoreTimestamp((p as any)[k]);
        if (ts) sanitized[k] = ts; else delete sanitized[k];
      });
      return this.removeUndefinedValues(sanitized);
    });
  }

  /**
   * Create a new event with proper validation and error handling
   */
  static async createEvent(eventData: EventFormData, organizerUid: string): Promise<string> {
    try {
      // Validate required fields client-side first
      this.validateEventData(eventData);
      
      // Remote validation via Cloud Function (with graceful fallback)
      try {
        const remoteValidation = await this.validateEventDataRemote(eventData);
        if (!remoteValidation.isValid) {
          throw new Error(`Validation failed: ${remoteValidation.errors.join(', ')}`);
        }
      } catch (e) {
        // Fallback to local validation if function fails
        const validation = this.validateEventDataLocal(eventData);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Generate a new event ID
      const eventRef = doc(collection(db, this.EVENTS_COLLECTION));
      const eventId = eventRef.id;

      // Get organizer information
      const organizerInfo = await this.getOrganizerInfo(organizerUid);

      // Build the venue object carefully
      const venue: any = {
        type: eventData.venueType,
        city: eventData.city
      };
      
      // Add venue name only if provided and not empty
      if (eventData.venueName && eventData.venueName.trim()) {
        venue.name = eventData.venueName.trim();
      }
      
      // Add venue address only if provided and not empty
      if (eventData.venueAddress && eventData.venueAddress.trim()) {
        venue.address = eventData.venueAddress.trim();
      }
      
      // Add online details for online events
      if (eventData.venueType === 'online') {
        venue.onlineDetails = {
          platform: 'Google Meet',
          instructions: 'Meeting link will be sent via email'
        };
      }

      // Convert form data to Event object (only include defined fields to avoid Firestore errors)
      const event: any = {
        title: eventData.title.trim(),
        description: eventData.description.trim(),
        shortDescription: eventData.shortDescription.trim(),
        organizer: {
          uid: organizerUid,
          name: organizerInfo.name,
          email: organizerInfo.email
        },
  speakers: this.sanitizeSpeakers(eventData.speakers || []),
        startDate: this.combineDateAndTime(eventData.startDate, eventData.startTime),
        endDate: this.combineDateAndTime(eventData.endDate, eventData.endTime),
        timezone: eventData.timezone,
        venue: venue,
        ticketTypes: this.sanitizeTicketTypes(eventData.ticketTypes || []),
        promoCodes: this.sanitizePromoCodes(eventData.promoCodes || []),
        tags: eventData.tags || [],
        category: eventData.category,
        status: 'draft',
        registrationStatus: eventData.registrationStatus || 'open',
        currentAttendees: 0,
        isPublished: false,
        requirements: eventData.requirements || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add optional fields only if they have actual values
      if (eventData.imageUrl && eventData.imageUrl.trim()) {
        event.imageUrl = eventData.imageUrl.trim();
      }
      
      if (eventData.maxAttendees && eventData.maxAttendees > 0) {
        event.maxAttendees = eventData.maxAttendees;
      }
      
      if (eventData.registrationDeadline && eventData.registrationDeadline.trim()) {
        event.registrationDeadline = Timestamp.fromDate(new Date(eventData.registrationDeadline));
      }

      // Clean the event object to remove any undefined values
      const cleanedEvent = this.removeUndefinedValues(event);
      
      // Debug logging
      console.log('Original event object keys:', Object.keys(event));
      console.log('Cleaned event object keys:', Object.keys(cleanedEvent));
      console.log('Event data being sent to Firestore:', JSON.stringify(cleanedEvent, null, 2));
      
      // Create the event document
      await setDoc(eventRef, cleanedEvent);

      // Note: Base64 image uploads are now handled in the UI layer before calling createEvent
      // This prevents Firestore size limit errors from large base64 strings

  // Create registration and feedback forms as subcollections (initial)
  await this.createEventForms(eventId, eventData);

      // Create payment configuration if needed
      if (eventData.paymentConfigs && eventData.paymentConfigs.length > 0) {
        // Remove File objects from payment configs before saving to Firestore
        const paymentConfigsWithoutFiles = eventData.paymentConfigs.map(config => {
          const { qrCodeImage, ...configWithoutFile } = config;
          return configWithoutFile;
        });
        await this.createPaymentConfiguration(eventId, this.removeUndefinedValues(paymentConfigsWithoutFiles[0]));
      }

      // Initialize event via Cloud Function (analytics, defaults). If it overwrites default forms,
      // update forms again immediately after.
      try {
        console.log('Calling initialize_event function for eventId:', eventId);
        const initializeEvent = httpsCallable(functions, 'initialize_event');
        const result = await initializeEvent({ eventId });
        console.log('initialize_event result:', result);
        // Ensure our provided forms remain in place
        await this.updateEventForms(eventId, {
          registrationForm: eventData.registrationForm,
          feedbackForm: eventData.feedbackForm
        });
      } catch (initErr) {
        console.warn('Event initialization function failed; continuing without it:', initErr);
      }

      return eventId;
    } catch (error) {
      console.error('Error creating event:', error);
      throw new Error(`Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update an existing event
   */
  static async updateEvent(eventId: string, eventData: Partial<EventFormData>): Promise<void> {
    try {
      const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
      
      // Create update data object, filtering out undefined values
      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      // Only add fields that have actual values (avoid undefined)
      Object.keys(eventData).forEach(key => {
        const value = (eventData as any)[key];
        if (value !== undefined && key !== 'startDate' && key !== 'startTime' && key !== 'endDate' && key !== 'endTime') {
          updateData[key] = value;
        }
      });

      // Normalize nested arrays if provided
      if (eventData.ticketTypes) {
        updateData.ticketTypes = this.sanitizeTicketTypes(eventData.ticketTypes as TicketType[]);
      }
      if (eventData.promoCodes) {
        updateData.promoCodes = this.sanitizePromoCodes(eventData.promoCodes as PromoCode[]);
      }
      if (eventData.speakers) {
        updateData.speakers = this.sanitizeSpeakers(eventData.speakers as any[]);
      }

      // Handle date/time updates
      if (eventData.startDate && eventData.startTime) {
        updateData.startDate = this.combineDateAndTime(eventData.startDate, eventData.startTime);
      }
      if (eventData.endDate && eventData.endTime) {
        updateData.endDate = this.combineDateAndTime(eventData.endDate, eventData.endTime);
      }

      // Clean the update data to remove any undefined values
      const cleanedUpdateData = this.removeUndefinedValues(updateData);
      
      await updateDoc(eventRef, cleanedUpdateData);

      // Update forms if provided
      if (eventData.registrationForm || eventData.feedbackForm) {
        await this.updateEventForms(eventId, eventData);
      }

      // Update payment configuration if provided
      if (eventData.paymentConfigs && eventData.paymentConfigs.length > 0) {
        // Remove File objects from payment configs before saving to Firestore
        const paymentConfigsWithoutFiles = eventData.paymentConfigs.map(config => {
          const { qrCodeImage, ...configWithoutFile } = config;
          return configWithoutFile;
        });
        await this.updatePaymentConfiguration(eventId, this.removeUndefinedValues(paymentConfigsWithoutFiles[0]));
      }
    } catch (error) {
      console.error('Error updating event:', error);
      throw new Error('Failed to update event');
    }
  }

  /**
   * Get event by ID
   */
  static async getEvent(eventId: string): Promise<Event | null> {
    try {
      const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
      const eventSnap = await getDoc(eventRef);

      if (eventSnap.exists()) {
        return { id: eventSnap.id, ...eventSnap.data() } as Event;
      }
      return null;
    } catch (error) {
      console.error('Error getting event:', error);
      throw new Error('Failed to get event');
    }
  }

  /**
   * Get events by organizer
   */
  static async getEventsByOrganizer(organizerUid: string): Promise<Event[]> {
    try {
      const eventsRef = collection(db, this.EVENTS_COLLECTION);
      const q = query(
        eventsRef,
        where('organizer.uid', '==', organizerUid),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    } catch (error) {
      console.error('Error getting events by organizer:', error);
      throw new Error('Failed to get events');
    }
  }

  /**
   * Get all published events
   */
  static async getPublishedEvents(): Promise<Event[]> {
    try {
      const eventsRef = collection(db, this.EVENTS_COLLECTION);
      const q = query(
        eventsRef,
        where('isPublished', '==', true),
        where('status', '==', 'published'),
        orderBy('startDate', 'asc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    } catch (error) {
      console.error('Error getting published events:', error);
      throw new Error('Failed to get published events');
    }
  }

  /**
   * Get events eligible for social media linking
   * - isPublished === true
   * - status in ['published' (upcoming only), 'ongoing']
   */
  static async getEventsForSocialMedia(): Promise<Event[]> {
    try {
      const eventsRef = collection(db, this.EVENTS_COLLECTION);
      const now = Timestamp.fromDate(new Date());

      // Published and upcoming
      const publishedUpcomingQuery = query(
        eventsRef,
        where('isPublished', '==', true),
        where('status', '==', 'published'),
        where('startDate', '>=', now),
        orderBy('startDate', 'asc')
      );

      // Ongoing (no date restriction)
      const ongoingQuery = query(
        eventsRef,
        where('isPublished', '==', true),
        where('status', '==', 'ongoing')
      );

      const [publishedSnap, ongoingSnap] = await Promise.all([
        getDocs(publishedUpcomingQuery),
        getDocs(ongoingQuery)
      ]);

      const mapDoc = (d: any) => ({ id: d.id, ...d.data() }) as Event;
      const merged = [
        ...publishedSnap.docs.map(mapDoc),
        ...ongoingSnap.docs.map(mapDoc)
      ];

      // Deduplicate by id
      const byId = new Map<string, Event>();
      merged.forEach(ev => byId.set(ev.id, ev));
      const results = Array.from(byId.values());

      // Sort by startDate ascending
      results.sort((a, b) => {
        const aDate = a.startDate instanceof Timestamp ? a.startDate.toDate() : new Date(String(a.startDate));
        const bDate = b.startDate instanceof Timestamp ? b.startDate.toDate() : new Date(String(b.startDate));
        return aDate.getTime() - bDate.getTime();
      });

      return results;
    } catch (error) {
      console.error('Error getting events for social media:', error);
      throw new Error('Failed to get events for social media');
    }
  }

  /**
   * Publish an event
   */
  static async publishEvent(eventId: string): Promise<void> {
    try {
      // Try Cloud Function first
      try {
        console.log('Calling publish_event function for eventId:', eventId);
        const publishEventFn = httpsCallable(functions, 'publish_event');
        const result = await publishEventFn({ eventId });
        console.log('publish_event result:', result);
        const data = result.data as { success?: boolean; message?: string };
        if (!data?.success) {
          throw new Error(data?.message || 'Publish function returned failure');
        }
      } catch (fnErr) {
        console.warn('Publish function failed; falling back to direct Firestore update:', fnErr);
        // Fallback to direct Firestore update
        const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
        await updateDoc(eventRef, {
          status: 'published',
          isPublished: true,
          publishedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error publishing event:', error);
      throw new Error('Failed to publish event');
    }
  }

  /**
   * Delete an event
   */
  static async deleteEvent(eventId: string, forceDelete: boolean = false): Promise<void> {
    try {
      console.log('Starting delete event for eventId:', eventId, 'forceDelete:', forceDelete);
      
      const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
      console.log('Deleting event document from Firestore');
      await deleteDoc(eventRef);
      console.log('Successfully deleted event document');

      // Delete associated subcollections and files
      await this.deleteEventData(eventId, forceDelete);
      console.log('Event deletion completed successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      throw new Error('Failed to delete event');
    }
  }

  /**
   * Upload event image
   */
  static async uploadEventImage(eventId: string, imageFile: File): Promise<string> {
    try {
      console.log('Uploading event image for eventId:', eventId, 'fileName:', imageFile.name);
      const imageRef = ref(storage, `${this.EVENT_IMAGES_PATH}/${eventId}/${imageFile.name}`);
      console.log('Storage path:', `${this.EVENT_IMAGES_PATH}/${eventId}/${imageFile.name}`);
      
      // Check current auth state before upload
      const { auth } = await import('../config/firebase');
      const currentUser = auth.currentUser;
      console.log('Current user during upload:', currentUser?.uid, currentUser?.email);
      
      const snapshot = await uploadBytes(imageRef, imageFile, { contentType: imageFile.type || 'image/jpeg' });
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update event with image URL
      const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
      await updateDoc(eventRef, {
        imageUrl: downloadURL,
        updatedAt: serverTimestamp()
      });

      return downloadURL;
    } catch (error) {
      console.error('Error uploading event image:', error);
      throw new Error('Failed to upload event image');
    }
  }

  /**
   * Upload speaker photo
   */
  static async uploadSpeakerPhoto(eventId: string, speakerId: string, imageFile: File): Promise<string> {
    try {
      console.log('Uploading speaker photo for eventId:', eventId, 'speakerId:', speakerId, 'fileName:', imageFile.name);
      const timestamp = Date.now();
      const imageRef = ref(storage, `${this.SPEAKER_PHOTOS_PATH}/${eventId}/${speakerId}/photo-${timestamp}.jpg`);
      console.log('Storage path:', `${this.SPEAKER_PHOTOS_PATH}/${eventId}/${speakerId}/photo-${timestamp}.jpg`);
      
      // Check current auth state before upload
      const { auth } = await import('../config/firebase');
      const currentUser = auth.currentUser;
      console.log('Current user during speaker photo upload:', currentUser?.uid, currentUser?.email);
      
      const snapshot = await uploadBytes(imageRef, imageFile, { contentType: imageFile.type || 'image/jpeg' });
      const downloadURL = await getDownloadURL(snapshot.ref);

      return downloadURL;
    } catch (error) {
      console.error('Error uploading speaker photo:', error);
      throw new Error('Failed to upload speaker photo');
    }
  }

  /**
   * Create event forms (registration and feedback)
   */
  private static async createEventForms(eventId: string, eventData: EventFormData): Promise<void> {
    try {
      // Create registration form
      const registrationFormRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/forms/registration`);
      await setDoc(registrationFormRef, {
        type: 'registration',
        fields: eventData.registrationForm,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Create feedback form
      const feedbackFormRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/forms/feedback`);
      await setDoc(feedbackFormRef, {
        type: 'feedback',
        fields: eventData.feedbackForm,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating event forms:', error);
      throw error;
    }
  }

  /**
   * Update event forms
   */
  private static async updateEventForms(eventId: string, eventData: Partial<EventFormData>): Promise<void> {
    try {
      if (eventData.registrationForm) {
        const registrationFormRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/forms/registration`);
        await updateDoc(registrationFormRef, {
          fields: eventData.registrationForm,
          updatedAt: serverTimestamp()
        });
      }

      if (eventData.feedbackForm) {
        const feedbackFormRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/forms/feedback`);
        await updateDoc(feedbackFormRef, {
          fields: eventData.feedbackForm,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating event forms:', error);
      throw error;
    }
  }

  /**
   * Create payment configuration
   */
  private static async createPaymentConfiguration(eventId: string, paymentConfig: any): Promise<void> {
    try {
      // Remove qrCodeUrl if it's a base64 string (too large for Firestore)
      const cleanedConfig = { ...paymentConfig };
      if (cleanedConfig.qrCodeUrl && cleanedConfig.qrCodeUrl.startsWith('data:image/')) {
        console.log('Removing base64 qrCodeUrl from payment config (too large for Firestore)');
        delete cleanedConfig.qrCodeUrl;
      }
      
      const paymentRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/config/payment`);
      await setDoc(paymentRef, {
        ...cleanedConfig,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating payment configuration:', error);
      throw error;
    }
  }

  /**
   * Update payment configuration
   */
  private static async updatePaymentConfiguration(eventId: string, paymentConfig: any): Promise<void> {
    try {
      // Remove qrCodeUrl if it's a base64 string (too large for Firestore)
      const cleanedConfig = { ...paymentConfig };
      if (cleanedConfig.qrCodeUrl && cleanedConfig.qrCodeUrl.startsWith('data:image/')) {
        console.log('Removing base64 qrCodeUrl from payment config update (too large for Firestore)');
        delete cleanedConfig.qrCodeUrl;
      }
      
      const paymentRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/config/payment`);
      await updateDoc(paymentRef, {
        ...cleanedConfig,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating payment configuration:', error);
      throw error;
    }
  }

  /**
   * Delete event data (subcollections and files)
   */
  private static async deleteEventData(eventId: string, forceDelete: boolean = false): Promise<void> {
    try {
      console.log('Deleting event data for eventId:', eventId, 'forceDelete:', forceDelete);
      
      // Delete event images from storage
      const imagesRef = ref(storage, `${this.EVENT_IMAGES_PATH}/${eventId}`);
      console.log('Deleting storage folder:', `${this.EVENT_IMAGES_PATH}/${eventId}`);
      try {
        await deleteObject(imagesRef);
        console.log('Successfully deleted event images folder');
      } catch (error) {
        console.log('Error deleting event images folder (may not exist):', error);
        // Ignore if files don't exist
      }

      // Call cloud function to delete subcollections
      console.log('Calling deleteEventData Cloud Function');
      const deleteEventData = httpsCallable(functions, 'deleteEventData');
      const result = await deleteEventData({ eventId, forceDelete });
      console.log('deleteEventData result:', result);
    } catch (error) {
      console.error('Error deleting event data:', error);
      // Don't throw error here as main event is already deleted
    }
  }

  /**
   * Helper function to combine date and time strings into Timestamp
   */
  private static combineDateAndTime(dateString: string, timeString: string): Timestamp {
    const datetime = new Date(`${dateString}T${timeString}`);
    return Timestamp.fromDate(datetime);
  }

  /**
   * Validate event data before creation/update
   */
  private static validateEventData(eventData: EventFormData): void {
    if (!eventData.title || eventData.title.trim().length === 0) {
      throw new Error('Event title is required');
    }
    if (!eventData.description || eventData.description.trim().length === 0) {
      throw new Error('Event description is required');
    }
    if (!eventData.startDate || !eventData.startTime) {
      throw new Error('Start date and time are required');
    }
    if (!eventData.endDate || !eventData.endTime) {
      throw new Error('End date and time are required');
    }
    if (!eventData.city || eventData.city.trim().length === 0) {
      throw new Error('City is required');
    }
    if (eventData.venueType === 'offline' && (!eventData.venueName || eventData.venueName.trim().length === 0)) {
      throw new Error('Venue name is required for offline events');
    }
  }

  /**
   * Get organizer information from user profile
   */
  private static async getOrganizerInfo(organizerUid: string): Promise<{ name: string; email: string }> {
    try {
      const userRef = doc(db, 'users', organizerUid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        console.log('User data from Firestore:', userData);
        console.log('User role:', userData.role);
        console.log('User UID:', organizerUid);
        
        return {
          name: userData.displayName || 'Unknown Organizer',
          email: userData.email || ''
        };
      } else {
        console.error('❌ User document not found in Firestore users collection');
        console.log('Searched for UID:', organizerUid);
        console.log('This user needs to be created in the users collection with proper role');
      }
      
      return { name: 'Unknown Organizer', email: '' };
    } catch (error) {
      console.error('Error getting organizer info:', error);
      return { name: 'Unknown Organizer', email: '' };
    }
  }

  /**
   * Upload event image from data URL
   */
  private static async uploadEventImageFromDataUrl(eventId: string, dataUrl: string): Promise<string> {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      // Create file reference - using the original path structure
      const timestamp = Date.now();
      const imageRef = ref(storage, `${this.EVENT_IMAGES_PATH}/${eventId}/event-image-${timestamp}.jpg`);
      
      // Upload the blob
      const snapshot = await uploadBytes(imageRef, blob, { contentType: (blob as any).type || 'image/jpeg' });
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update event with image URL
      const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
      await updateDoc(eventRef, {
        imageUrl: downloadURL,
        updatedAt: serverTimestamp()
      });

      return downloadURL;
    } catch (error) {
      console.error('Error uploading event image from data URL:', error);
      throw new Error('Failed to upload event image');
    }
  }

  /**
   * Enhanced upload payment QR code with better error handling
   */
  static async uploadPaymentQR(eventId: string, qrFile: File): Promise<string> {
    try {
      // Debug logging
      console.log('uploadPaymentQR - qrFile:', qrFile);
      console.log('uploadPaymentQR - qrFile.type:', qrFile?.type);
      console.log('uploadPaymentQR - qrFile.size:', qrFile?.size);
      console.log('uploadPaymentQR - qrFile.name:', qrFile?.name);
      console.log('uploadPaymentQR - qrFile instanceof File:', qrFile instanceof File);
      console.log('uploadPaymentQR - qrFile constructor:', qrFile?.constructor?.name);
      
      // Validate file
      if (!qrFile || !(qrFile instanceof File)) {
        throw new Error('QR code must be a valid File object');
      }
      
      if (!qrFile.type || !qrFile.type.startsWith('image/')) {
        throw new Error('QR code must be an image file');
      }
      
      if (!qrFile.size || qrFile.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('QR code image must be smaller than 5MB');
      }

      const timestamp = Date.now();
      const fileExtension = qrFile.name.split('.').pop() || 'jpg';
      const qrRef = ref(storage, `${this.PAYMENT_QR_PATH}/${eventId}/payment-qr-${timestamp}.${fileExtension}`);
      
      console.log('Uploading payment QR for eventId:', eventId, 'fileName:', qrFile.name);
      console.log('Storage path:', `${this.PAYMENT_QR_PATH}/${eventId}/payment-qr-${timestamp}.${fileExtension}`);
      
      // Check current auth state before upload
      const { auth } = await import('../config/firebase');
      const currentUser = auth.currentUser;
      console.log('Current user during QR upload:', currentUser?.uid, currentUser?.email);
      
      const snapshot = await uploadBytes(qrRef, qrFile, { contentType: qrFile.type || 'image/jpeg' });
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Update payment configuration with QR URL
      const paymentRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/config/payment`);
      await updateDoc(paymentRef, {
        qrCodeUrl: downloadURL,
        updatedAt: serverTimestamp()
      });

      return downloadURL;
    } catch (error) {
      console.error('Error uploading payment QR:', error);
      throw new Error(`Failed to upload payment QR: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get event registration form
   */
  static async getEventRegistrationForm(eventId: string): Promise<FormField[]> {
    try {
      const formRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/forms/registration`);
      const formSnap = await getDoc(formRef);
      
      if (formSnap.exists()) {
        const formData = formSnap.data();
        return formData.fields || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error getting registration form:', error);
      return [];
    }
  }

  /**
   * Get event feedback form
   */
  static async getEventFeedbackForm(eventId: string): Promise<FormField[]> {
    try {
      const formRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/forms/feedback`);
      const formSnap = await getDoc(formRef);
      
      if (formSnap.exists()) {
        const formData = formSnap.data();
        return formData.fields || [];
      }
      
      return [];
    } catch (error) {
      console.error('Error getting feedback form:', error);
      return [];
    }
  }

  /**
   * Get feedback form structure (for feedback page)
   */
  static async getFeedbackForm(eventId: string): Promise<{ fields: FormField[] }> {
    try {
      const formRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/forms/feedback`);
      const formSnap = await getDoc(formRef);
      
      if (formSnap.exists()) {
        const formData = formSnap.data();
        return {
          fields: formData.fields || []
        };
      }
      
      // Return default feedback form if none exists
      return {
        fields: [
          {
            id: 'overall_rating',
            type: 'rating',
            label: 'Overall Event Rating',
            required: true,
            gridSize: 'full'
          },
          {
            id: 'liked_most',
            type: 'textarea',
            label: 'What did you like most about this event?',
            required: false,
            gridSize: 'full',
            placeholder: 'Tell us what you enjoyed...'
          },
          {
            id: 'improvements',
            type: 'textarea',
            label: 'What could we improve?',
            required: false,
            gridSize: 'full',
            placeholder: 'Share your suggestions for improvement...'
          },
          {
            id: 'would_recommend',
            type: 'radio',
            label: 'Would you recommend this event to others?',
            required: false,
            gridSize: 'full',
            options: ['Yes', 'No', 'Maybe']
          }
        ]
      };
    } catch (error) {
      console.error('Error getting feedback form:', error);
      // Return default form on error
      return {
        fields: [
          {
            id: 'overall_rating',
            type: 'rating',
            label: 'Overall Event Rating',
            required: true,
            gridSize: 'full'
          },
          {
            id: 'comments',
            type: 'textarea',
            label: 'Comments',
            required: false,
            gridSize: 'full',
            placeholder: 'Share your feedback...'
          }
        ]
      };
    }
  }

  /**
   * Get event payment configuration
   */
  static async getEventPaymentConfig(eventId: string): Promise<any> {
    try {
      const paymentRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/config/payment`);
      const paymentSnap = await getDoc(paymentRef);
      
      if (paymentSnap.exists()) {
        return paymentSnap.data();
      }
      
      return null;
    } catch (error) {
      console.error('Error getting payment config:', error);
      return null;
    }
  }

  /**
   * Enhanced event search with filters
   */
  static async searchEvents(filters: {
    category?: string;
    city?: string;
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    priceRange?: { min: number; max: number };
    venueType?: 'online' | 'offline' | 'hybrid';
  }): Promise<Event[]> {
    try {
      const eventsRef = collection(db, this.EVENTS_COLLECTION);
      let q = query(
        eventsRef,
        where('isPublished', '==', true),
        where('status', '==', 'published'),
        orderBy('startDate', 'asc')
      );

      // Apply filters
      if (filters.category) {
        q = query(q, where('category', '==', filters.category));
      }
      
      if (filters.city) {
        q = query(q, where('venue.city', '==', filters.city));
      }
      
      if (filters.venueType) {
        q = query(q, where('venue.type', '==', filters.venueType));
      }

      const querySnapshot = await getDocs(q);
      let events = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));

      // Apply client-side filters for complex conditions
      if (filters.tags && filters.tags.length > 0) {
        events = events.filter(event => 
          filters.tags!.some(tag => event.tags.includes(tag))
        );
      }

      if (filters.dateRange) {
        events = events.filter(event => {
          const eventDate = event.startDate.toDate();
          return eventDate >= filters.dateRange!.start && eventDate <= filters.dateRange!.end;
        });
      }

      if (filters.priceRange) {
        events = events.filter(event => {
          const minPrice = Math.min(...event.ticketTypes.map(t => t.price));
          const maxPrice = Math.max(...event.ticketTypes.map(t => t.price));
          return minPrice >= filters.priceRange!.min && maxPrice <= filters.priceRange!.max;
        });
      }

      return events;
    } catch (error) {
      console.error('Error searching events:', error);
      throw new Error('Failed to search events');
    }
  }

  /**
   * Validate event data on client side before sending to Firebase
   * @param eventData - The event data to validate
   * @param isUpdate - If true, skip past date validation (for editing existing events)
   */
  static validateEventDataLocal(eventData: EventFormData, isUpdate: boolean = false): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!eventData.title?.trim()) errors.push('Event title is required');
    if (!eventData.description?.trim()) errors.push('Event description is required');
    if (!eventData.startDate) errors.push('Start date is required');
    if (!eventData.startTime) errors.push('Start time is required');
    if (!eventData.endDate) errors.push('End date is required');
    if (!eventData.endTime) errors.push('End time is required');
    if (!eventData.city?.trim()) errors.push('City is required');

    // Date validation
    if (eventData.startDate && eventData.startTime && eventData.endDate && eventData.endTime) {
      const startDateTime = new Date(`${eventData.startDate}T${eventData.startTime}`);
      const endDateTime = new Date(`${eventData.endDate}T${eventData.endTime}`);
      
      if (startDateTime >= endDateTime) {
        errors.push('End date/time must be after start date/time');
      }
      
      // Only validate past dates for new events
      // When updating, allow keeping the same date even if it's today or in the past
      if (!isUpdate && startDateTime < new Date()) {
        errors.push('Event cannot start in the past');
      }
    }

    // Venue validation
    if (eventData.venueType === 'offline' && !eventData.venueName?.trim()) {
      errors.push('Venue name is required for offline events');
    }

    // Ticket validation
    if (eventData.ticketTypes?.length) {
      eventData.ticketTypes.forEach((ticket, index) => {
        if (!ticket.name?.trim()) errors.push(`Ticket ${index + 1}: Name is required`);
        if (ticket.price < 0) errors.push(`Ticket ${index + 1}: Price cannot be negative`);
        if (ticket.maxQuantity && ticket.maxQuantity < 1) {
          errors.push(`Ticket ${index + 1}: Max quantity must be at least 1`);
        }
      });
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Increment event view count
   */
  static async incrementEventViews(eventId: string): Promise<void> {
    try {
      const analyticsRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/analytics/summary`);
      await updateDoc(analyticsRef, {
        views: serverTimestamp(), // Will be incremented in Firestore rules
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error incrementing event views:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get event analytics summary
   */
  static async getEventAnalytics(eventId: string): Promise<any> {
    try {
      const getEventAnalytics = httpsCallable(functions, 'getEventAnalytics');
      const result = await getEventAnalytics({ eventId });
      return result.data;
    } catch (error) {
      console.error('Error getting event analytics:', error);
      throw new Error('Failed to get event analytics');
    }
  }

  /**
   * Duplicate an existing event
   */
  static async duplicateEvent(eventId: string, newTitle?: string): Promise<string> {
    try {
      // Prefer snake_case per backend, fallback to camelCase for compatibility
      let result: any;
      try {
        const fn = httpsCallable(functions, 'duplicate_event');
        result = await fn({ eventId, newTitle: newTitle || `Event Copy` });
      } catch (_e) {
        const fnCompat = httpsCallable(functions, 'duplicateEvent');
        result = await fnCompat({ eventId, newTitle: newTitle || `Event Copy` });
      }
      
      const response = result.data as { success: boolean; newEventId: string; message?: string };
      if (!response.success) {
        throw new Error(response.message || 'Failed to duplicate event');
      }
      
      return response.newEventId;
    } catch (error) {
      console.error('Error duplicating event:', error);
      throw new Error(`Failed to duplicate event: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get comprehensive event statistics
   */
  static async getEventStatistics(eventId: string): Promise<any> {
    try {
      const getEventStatistics = httpsCallable(functions, 'getEventStatistics');
      const result = await getEventStatistics({ eventId });
      
      const response = result.data as { success: boolean; statistics: any; message?: string };
      if (!response.success) {
        throw new Error(response.message || 'Failed to get event statistics');
      }
      
      return response.statistics;
    } catch (error) {
      console.error('Error getting event statistics:', error);
      throw new Error(`Failed to get event statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate event data using Firebase Function
   */
  static async validateEventDataRemote(eventData: EventFormData): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      console.log('Calling validate_event_data Cloud Function');
      const validateEventData = httpsCallable(functions, 'validate_event_data');
      const result = await validateEventData({ eventData });
      console.log('validate_event_data result:', result);
      
      return result.data as { isValid: boolean; errors: string[] };
    } catch (error) {
      console.error('Error validating event data:', error);
      return {
        isValid: false,
        errors: ['Failed to validate event data remotely']
      };
    }
  }

  /**
   * Get all events (admin only)
   */
  static async getAllEvents(): Promise<Event[]> {
    try {
      const eventsRef = collection(db, this.EVENTS_COLLECTION);
      const q = query(
        eventsRef,
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
    } catch (error) {
      console.error('Error getting all events:', error);
      throw new Error('Failed to get events');
    }
  }

  /**
   * Update event status
   */
  static async updateEventStatus(eventId: string, status: string): Promise<void> {
    try {
      console.log('🔥 EventService: Updating event status in Firebase', { eventId, status });
      
      const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
      const updateData = {
        status: status,
        isPublished: status === 'published', // Update isPublished based on status
        updatedAt: serverTimestamp()
      };
      
      console.log('🔥 EventService: Update data:', updateData);
      
      await updateDoc(eventRef, updateData);
      
      console.log('✅ EventService: Firebase update completed successfully');
      
      // Verify the update by reading the document back
      try {
        const updatedDoc = await getDoc(eventRef);
        if (updatedDoc.exists()) {
          const data = updatedDoc.data();
          console.log('🔍 EventService: Verified Firebase update - current status:', data.status);
        } else {
          console.warn('⚠️ EventService: Document not found after update');
        }
      } catch (verifyError) {
        console.warn('⚠️ EventService: Could not verify update:', verifyError);
      }
    } catch (error) {
      console.error('❌ EventService: Error updating event status:', error);
      throw new Error('Failed to update event status');
    }
  }

  /**
   * Update event registration status
   */
  static async updateRegistrationStatus(eventId: string, registrationStatus: 'open' | 'closed' | 'walk-in-only'): Promise<void> {
    try {
      console.log('🔥 EventService: Updating registration status in Firebase', { eventId, registrationStatus });
      
      const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
      const updateData = {
        registrationStatus: registrationStatus,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(eventRef, updateData);
      console.log('✅ EventService: Registration status updated successfully');
    } catch (error) {
      console.error('❌ EventService: Error updating registration status:', error);
      throw new Error('Failed to update registration status');
    }
  }
}

export default EventService;
