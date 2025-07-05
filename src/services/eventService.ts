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
  paymentConfig?: PaymentConfig;

  // Settings
  category: string;
  tags: string[];
  requirements: string[];
  registrationDeadline?: string;
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
  private static readonly PAYMENT_QR_PATH = 'payment-qr';

  /**
   * Create a new event with proper validation and error handling
   */
  static async createEvent(eventData: EventFormData, organizerUid: string): Promise<string> {
    try {
      // Validate required fields client-side first
      this.validateEventData(eventData);

      // Call Firebase Function for comprehensive validation
      const validateEventData = httpsCallable(functions, 'validateEventData');
      const validationResult = await validateEventData({ eventData });
      
      const validation = validationResult.data as { isValid: boolean; errors: string[] };
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate a new event ID
      const eventRef = doc(collection(db, this.EVENTS_COLLECTION));
      const eventId = eventRef.id;

      // Get organizer information
      const organizerInfo = await this.getOrganizerInfo(organizerUid);

      // Convert form data to Event object
      const event: Omit<Event, 'id'> = {
        title: eventData.title,
        description: eventData.description,
        shortDescription: eventData.shortDescription,
        imageUrl: eventData.imageUrl,
        organizer: {
          uid: organizerUid,
          name: organizerInfo.name,
          email: organizerInfo.email
        },
        speakers: [],
        startDate: this.combineDateAndTime(eventData.startDate, eventData.startTime),
        endDate: this.combineDateAndTime(eventData.endDate, eventData.endTime),
        timezone: eventData.timezone,
        venue: {
          type: eventData.venueType,
          name: eventData.venueName,
          address: eventData.venueAddress,
          city: eventData.city,
          onlineDetails: eventData.venueType === 'online' ? {
            platform: 'Google Meet',
            instructions: 'Meeting link will be sent via email'
          } : undefined
        },
        ticketTypes: eventData.ticketTypes,
        promoCodes: eventData.promoCodes || [],
        tags: eventData.tags,
        category: eventData.category as any,
        status: 'draft' as any,
        maxAttendees: eventData.maxAttendees,
        currentAttendees: 0,
        isPublished: false,
        registrationDeadline: eventData.registrationDeadline ? 
          Timestamp.fromDate(new Date(eventData.registrationDeadline)) : undefined,
        requirements: eventData.requirements || [],
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any
      };

      // Create the event document
      await setDoc(eventRef, event);

      // Upload event image if provided
      if (eventData.imageUrl && eventData.imageUrl.startsWith('data:')) {
        await this.uploadEventImageFromDataUrl(eventId, eventData.imageUrl);
      }

      // Create registration and feedback forms as subcollections
      await this.createEventForms(eventId, eventData);

      // Create payment configuration if needed
      if (eventData.paymentConfig) {
        await this.createPaymentConfiguration(eventId, eventData.paymentConfig);
      }

      // Call cloud function to initialize event data
      const initializeEvent = httpsCallable(functions, 'initialize_event');
      const initResult = await initializeEvent({ eventId });
      
      const initResponse = initResult.data as { success: boolean; message?: string };
      if (!initResponse.success) {
        console.warn('Event initialization failed, but event was created:', initResponse.message);
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
      
      const updateData: any = {
        ...eventData,
        updatedAt: serverTimestamp()
      };

      // Handle date/time updates
      if (eventData.startDate && eventData.startTime) {
        updateData.startDate = this.combineDateAndTime(eventData.startDate, eventData.startTime);
      }
      if (eventData.endDate && eventData.endTime) {
        updateData.endDate = this.combineDateAndTime(eventData.endDate, eventData.endTime);
      }

      await updateDoc(eventRef, updateData);

      // Update forms if provided
      if (eventData.registrationForm || eventData.feedbackForm) {
        await this.updateEventForms(eventId, eventData);
      }

      // Update payment configuration if provided
      if (eventData.paymentConfig) {
        await this.updatePaymentConfiguration(eventId, eventData.paymentConfig);
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
   * Publish an event
   */
  static async publishEvent(eventId: string): Promise<void> {
    try {
      // Use the Firebase Function to publish the event
      const publishEvent = httpsCallable(functions, 'publish_event');
      const result = await publishEvent({ eventId });
      
      const response = result.data as { success: boolean; message?: string };
      if (!response.success) {
        throw new Error(response.message || 'Failed to publish event via Firebase Function');
      }
    } catch (error) {
      console.error('Error publishing event:', error);
      throw new Error('Failed to publish event');
    }
  }

  /**
   * Delete an event
   */
  static async deleteEvent(eventId: string): Promise<void> {
    try {
      const eventRef = doc(db, this.EVENTS_COLLECTION, eventId);
      await deleteDoc(eventRef);

      // Delete associated subcollections and files
      await this.deleteEventData(eventId);
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
      const imageRef = ref(storage, `${this.EVENT_IMAGES_PATH}/${eventId}/${imageFile.name}`);
      const snapshot = await uploadBytes(imageRef, imageFile);
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
      const paymentRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/config/payment`);
      await setDoc(paymentRef, {
        ...paymentConfig,
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
      const paymentRef = doc(db, `${this.EVENTS_COLLECTION}/${eventId}/config/payment`);
      await updateDoc(paymentRef, {
        ...paymentConfig,
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
  private static async deleteEventData(eventId: string): Promise<void> {
    try {
      // Delete event images from storage
      const imagesRef = ref(storage, `${this.EVENT_IMAGES_PATH}/${eventId}`);
      try {
        await deleteObject(imagesRef);
      } catch (error) {
        // Ignore if files don't exist
      }

      // Call cloud function to delete subcollections
      const deleteEventData = httpsCallable(functions, 'deleteEventData');
      await deleteEventData({ eventId });
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
        return {
          name: userData.displayName || 'Unknown Organizer',
          email: userData.email || ''
        };
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
      
      // Create file reference
      const timestamp = Date.now();
      const imageRef = ref(storage, `${this.EVENT_IMAGES_PATH}/${eventId}/event-image-${timestamp}.jpg`);
      
      // Upload the blob
      const snapshot = await uploadBytes(imageRef, blob);
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
      // Validate file
      if (!qrFile.type.startsWith('image/')) {
        throw new Error('QR code must be an image file');
      }
      
      if (qrFile.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error('QR code image must be smaller than 5MB');
      }

      const timestamp = Date.now();
      const fileExtension = qrFile.name.split('.').pop() || 'jpg';
      const qrRef = ref(storage, `${this.PAYMENT_QR_PATH}/${eventId}/payment-qr-${timestamp}.${fileExtension}`);
      
      const snapshot = await uploadBytes(qrRef, qrFile);
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
   */
  static validateEventDataLocal(eventData: EventFormData): { isValid: boolean; errors: string[] } {
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
      
      if (startDateTime < new Date()) {
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
      const duplicateEvent = httpsCallable(functions, 'duplicateEvent');
      const result = await duplicateEvent({ 
        eventId, 
        newTitle: newTitle || `Event Copy` 
      });
      
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
      const validateEventData = httpsCallable(functions, 'validateEventData');
      const result = await validateEventData({ eventData });
      
      return result.data as { isValid: boolean; errors: string[] };
    } catch (error) {
      console.error('Error validating event data:', error);
      return {
        isValid: false,
        errors: ['Failed to validate event data remotely']
      };
    }
  }
}

export default EventService;
