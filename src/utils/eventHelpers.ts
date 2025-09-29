import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import EventService from '../services/eventService';
import { EventFormData } from '../services/eventService';

/**
 * Helper utilities for event management with Firebase integration
 */

export interface EventCreationOptions {
  validateOnServer?: boolean;
  autoPublish?: boolean;
  uploadImage?: boolean;
  initializeAnalytics?: boolean;
}

/**
 * Create an event with comprehensive validation and setup
 */
export const createEventWithValidation = async (
  eventData: EventFormData,
  organizerUid: string,
  options: EventCreationOptions = {}
): Promise<string> => {
  const {
    validateOnServer = true,
    autoPublish = false,
    uploadImage = true,
    initializeAnalytics = true
  } = options;

  try {
    // Step 1: Client-side validation
    const clientValidation = EventService.validateEventDataLocal(eventData);
    if (!clientValidation.isValid) {
      throw new Error(`Client validation failed: ${clientValidation.errors.join(', ')}`);
    }

    // Step 2: Server-side validation (if enabled)
    if (validateOnServer) {
      const validateEventData = httpsCallable(functions, 'validateEventData');
      const serverValidation = await validateEventData({ eventData });
      const validation = serverValidation.data as any;
      
      if (!validation.isValid) {
        throw new Error(`Server validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Step 3: Create the event
    const eventId = await EventService.createEvent(eventData, organizerUid);

    // Step 4: Upload image if provided
    if (uploadImage && eventData.imageUrl && eventData.imageUrl.startsWith('data:')) {
      const response = await fetch(eventData.imageUrl);
      const blob = await response.blob();
      const file = new File([blob], 'event-image.jpg', { type: 'image/jpeg' });
      await EventService.uploadEventImage(eventId, file);
    }

    // Step 5: Upload payment QR if provided (supports multiple paymentConfigs)
    if (Array.isArray(eventData.paymentConfigs) && eventData.paymentConfigs.length > 0) {
      const firstConfigWithImage = eventData.paymentConfigs.find(c => !!c.qrCodeImage);
      if (firstConfigWithImage?.qrCodeImage) {
        await EventService.uploadPaymentQR(eventId, firstConfigWithImage.qrCodeImage);
      }
    }

    // Step 6: Initialize analytics (if enabled)
    if (initializeAnalytics) {
      // Match backend function name `initialize_event`
      const initializeEvent = httpsCallable(functions, 'initialize_event');
      await initializeEvent({ eventId });
    }

    // Step 7: Auto-publish if enabled
    if (autoPublish) {
      await EventService.publishEvent(eventId);
    }

    return eventId;
  } catch (error) {
    console.error('Error creating event with validation:', error);
    throw error;
  }
};

/**
 * Get comprehensive event statistics
 */
export const getEventStatistics = async (eventId: string): Promise<any> => {
  try {
    const getEventStatistics = httpsCallable(functions, 'getEventStatistics');
    const result = await getEventStatistics({ eventId });
    return result.data;
  } catch (error) {
    console.error('Error getting event statistics:', error);
    throw new Error('Failed to get event statistics');
  }
};

/**
 * Duplicate an event with all its configurations
 */
export const duplicateEventComplete = async (
  eventId: string,
  newTitle?: string,
  modifications?: Partial<EventFormData>
): Promise<string> => {
  try {
    // First duplicate the event
    const newEventId = await EventService.duplicateEvent(eventId, newTitle);
    
    // Apply any modifications
    if (modifications) {
      await EventService.updateEvent(newEventId, modifications);
    }
    
    // Initialize analytics for the new event (match backend name)
    const initializeEvent = httpsCallable(functions, 'initialize_event');
    await initializeEvent({ eventId: newEventId });
    
    return newEventId;
  } catch (error) {
    console.error('Error duplicating event:', error);
    throw new Error('Failed to duplicate event');
  }
};

/**
 * Search events with comprehensive filtering
 */
export const searchEventsAdvanced = async (filters: {
  query?: string;
  category?: string;
  city?: string;
  tags?: string[];
  dateRange?: { start: Date; end: Date };
  priceRange?: { min: number; max: number };
  venueType?: 'online' | 'offline' | 'hybrid';
  limit?: number;
}): Promise<any[]> => {
  try {
    // Use EventService for basic filtering
    const events = await EventService.searchEvents({
      category: filters.category,
      city: filters.city,
      tags: filters.tags,
      dateRange: filters.dateRange,
      priceRange: filters.priceRange,
      venueType: filters.venueType
    });
    
    // Apply text search if query provided
    let filteredEvents = events;
    if (filters.query) {
      const searchTerm = filters.query.toLowerCase();
      filteredEvents = events.filter(event => 
        event.title.toLowerCase().includes(searchTerm) ||
        event.description.toLowerCase().includes(searchTerm) ||
        event.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply limit if provided
    if (filters.limit) {
      filteredEvents = filteredEvents.slice(0, filters.limit);
    }
    
    return filteredEvents;
  } catch (error) {
    console.error('Error searching events:', error);
    throw new Error('Failed to search events');
  }
};

/**
 * Validate event data with both client and server validation
 */
export const validateEventComplete = async (eventData: EventFormData): Promise<{
  isValid: boolean;
  clientErrors: string[];
  serverErrors: string[];
  allErrors: string[];
}> => {
  try {
    // Client-side validation
    const clientValidation = EventService.validateEventDataLocal(eventData);
    
    // Server-side validation
    const validateEventData = httpsCallable(functions, 'validateEventData');
    const serverValidation = await validateEventData({ eventData });
    const validation = serverValidation.data as any;
    
    const allErrors = [...clientValidation.errors, ...validation.errors];
    
    return {
      isValid: clientValidation.isValid && validation.isValid,
      clientErrors: clientValidation.errors,
      serverErrors: validation.errors,
      allErrors: allErrors
    };
  } catch (error) {
    console.error('Error validating event:', error);
    return {
      isValid: false,
      clientErrors: [],
      serverErrors: ['Failed to validate event'],
      allErrors: ['Failed to validate event']
    };
  }
};

/**
 * Get event analytics with caching
 */
export const getEventAnalyticsWithCache = async (eventId: string): Promise<any> => {
  const cacheKey = `event_analytics_${eventId}`;
  const cacheExpiry = 5 * 60 * 1000; // 5 minutes
  
  try {
    // Check cache first
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheExpiry) {
        return data;
      }
    }
    
    // Fetch fresh data
    const analytics = await getEventStatistics(eventId);
    
    // Cache the result
    localStorage.setItem(cacheKey, JSON.stringify({
      data: analytics,
      timestamp: Date.now()
    }));
    
    return analytics;
  } catch (error) {
    console.error('Error getting cached analytics:', error);
    throw error;
  }
};

/**
 * Utility to format event data for display
 */
export const formatEventForDisplay = (event: any): any => {
  return {
    ...event,
    formattedStartDate: event.startDate.toDate().toLocaleDateString(),
    formattedStartTime: event.startDate.toDate().toLocaleTimeString(),
    formattedEndDate: event.endDate.toDate().toLocaleDateString(),
    formattedEndTime: event.endDate.toDate().toLocaleTimeString(),
    duration: Math.round((event.endDate.toDate().getTime() - event.startDate.toDate().getTime()) / (1000 * 60 * 60)), // hours
    daysUntilEvent: Math.ceil((event.startDate.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    isUpcoming: event.startDate.toDate().getTime() > Date.now(),
    isPast: event.endDate.toDate().getTime() < Date.now(),
    isOngoing: event.startDate.toDate().getTime() <= Date.now() && event.endDate.toDate().getTime() >= Date.now(),
    minPrice: event.ticketTypes?.length ? Math.min(...event.ticketTypes.map((t: any) => t.price)) : 0,
    maxPrice: event.ticketTypes?.length ? Math.max(...event.ticketTypes.map((t: any) => t.price)) : 0,
    hasFreeTicets: event.ticketTypes?.some((t: any) => t.price === 0) || false
  };
};
