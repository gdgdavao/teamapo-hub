import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import { Notification, NotificationType } from '../types';

export class NotificationService {
  private static COLLECTION = 'notifications';
  private static notificationCache = new Map<string, number>(); // Cache to prevent duplicates

  /**
   * Create a unique key for deduplication
   */
  private static createNotificationKey(
    userId: string,
    type: NotificationType,
    title: string,
    message: string
  ): string {
    return `${userId}-${type}-${title}-${message}`;
  }

  /**
   * Check if notification already exists recently (within 5 minutes)
   */
  private static isDuplicateNotification(key: string): boolean {
    const now = Date.now();
    const lastCreated = this.notificationCache.get(key);
    
    if (lastCreated && (now - lastCreated) < 5 * 60 * 1000) { // 5 minutes
      return true;
    }
    
    // Clean up old cache entries (older than 10 minutes)
    this.cleanupCache();
    
    return false;
  }

  /**
   * Clean up old cache entries to prevent memory leaks
   */
  private static cleanupCache(): void {
    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    
    for (const [key, timestamp] of this.notificationCache.entries()) {
      if (timestamp < tenMinutesAgo) {
        this.notificationCache.delete(key);
      }
    }
  }

  /**
   * Create a new notification with deduplication
   */
  static async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<string> {
    try {
      // Create deduplication key
      const notificationKey = this.createNotificationKey(userId, type, title, message);
      
      // Check for duplicates
      if (this.isDuplicateNotification(notificationKey)) {
        logger.log('Skipping duplicate notification:', notificationKey);
        return ''; // Return empty string for duplicates
      }

      const notification: Omit<Notification, 'id'> = {
        userId,
        type,
        title,
        message,
        data: data || {},
        isRead: false,
        isEmailSent: false,
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, this.COLLECTION), notification);
      
      // Update cache with creation time
      this.notificationCache.set(notificationKey, Date.now());
      
      return docRef.id;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, this.COLLECTION, notificationId);
      await updateDoc(notificationRef, {
        isRead: true,
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId: string): Promise<void> {
    try {
      const batch = writeBatch(db);

      // Get all unread notifications for the user
      const q = query(
        collection(db, this.COLLECTION),
        where('userId', '==', userId),
        where('isRead', '==', false)
      );

      const snapshot = await import('firebase/firestore').then(({ getDocs }) => getDocs(q));

      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { isRead: true });
      });

      await batch.commit();
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.COLLECTION, notificationId));
    } catch (error) {
      logger.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user with real-time updates
   */
  static subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    limitCount: number = 20
  ) {
    const q = query(
      collection(db, this.COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
      const notifications: Notification[] = [];
      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        } as Notification);
      });
      callback(notifications);
    }, (error) => {
      logger.error('Error subscribing to notifications:', error);
    });
  }

  /**
   * Get unread notification count for a user
   */
  static subscribeToUnreadCount(
    userId: string,
    callback: (count: number) => void
  ) {
    const q = query(
      collection(db, this.COLLECTION),
      where('userId', '==', userId),
      where('isRead', '==', false)
    );

    return onSnapshot(q, (snapshot) => {
      callback(snapshot.size);
    }, (error) => {
      logger.error('Error subscribing to unread count:', error);
    });
  }

  /**
   * Create admin notification for new pending attendee
   */
  static async createAdminPendingAttendeeNotification(
    adminUserId: string,
    attendeeName: string,
    eventTitle: string,
    registrationId: string,
    amount: number,
    currency: string = 'PHP'
  ): Promise<string> {
    const notificationId = await this.createNotification(
      adminUserId,
      'admin_pending_attendee',
      'New Pending Attendee',
      `${attendeeName} registered for "${eventTitle}" - Payment verification required`,
      { 
        attendeeName, 
        eventTitle, 
        registrationId, 
        amount, 
        currency,
        actionRequired: 'payment_verification'
      }
    );
    
    // Return the notification ID or a placeholder for duplicates
    return notificationId || 'duplicate-skipped';
  }

  /**
   * Create admin notification for high pending count
   */
  static async createAdminHighPendingCountNotification(
    adminUserId: string,
    pendingCount: number
  ): Promise<string> {
    const notificationId = await this.createNotification(
      adminUserId,
      'admin_high_pending_count',
      'High Pending Count Alert',
      `You have ${pendingCount} pending attendee registrations that need attention`,
      { 
        pendingCount,
        actionRequired: 'review_attendees',
        priority: 'high'
      }
    );
    
    // Return the notification ID or a placeholder for duplicates
    return notificationId || 'duplicate-skipped';
  }

  /**
   * Create admin notification for event creation
   */
  static async createAdminEventCreatedNotification(
    adminUserId: string,
    eventTitle: string,
    eventId: string
  ): Promise<string> {
    return this.createNotification(
      adminUserId,
      'admin_event_created',
      'Event Created Successfully',
      `Event "${eventTitle}" has been created and is ready for management`,
      { 
        eventTitle, 
        eventId,
        actionRequired: 'manage_event'
      }
    );
  }

  /**
   * Create admin notification for check-in activity
   */
  static async createAdminCheckInNotification(
    adminUserId: string,
    attendeeName: string,
    eventTitle: string,
    checkInTime: Date
  ): Promise<string> {
    return this.createNotification(
      adminUserId,
      'admin_check_in',
      'Attendee Checked In',
      `${attendeeName} has checked in for "${eventTitle}" at ${checkInTime.toLocaleTimeString()}`,
      { 
        attendeeName, 
        eventTitle, 
        checkInTime: checkInTime.toISOString(),
        actionRequired: 'none'
      }
    );
  }

  /**
   * Create admin notification for payment verification
   */
  static async createAdminPaymentVerifiedNotification(
    adminUserId: string,
    attendeeName: string,
    eventTitle: string,
    amount: number,
    currency: string = 'PHP',
    status: 'approved' | 'rejected'
  ): Promise<string> {
    const action = status === 'approved' ? 'approved' : 'rejected';
    return this.createNotification(
      adminUserId,
      'admin_payment_verified',
      `Payment ${action.charAt(0).toUpperCase() + action.slice(1)}`,
      `Payment for ${attendeeName} (${eventTitle}) has been ${action}`,
      { 
        attendeeName, 
        eventTitle, 
        amount, 
        currency,
        status,
        actionRequired: 'none'
      }
    );
  }

  /**
   * Create registration confirmation notification
   */
  static async createRegistrationConfirmation(
    userId: string,
    eventTitle: string,
    registrationId: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'registration_confirmation',
      'Registration Confirmed',
      `Your registration for "${eventTitle}" has been confirmed!`,
      { registrationId, eventTitle }
    );
  }

  /**
   * Create payment success notification
   */
  static async createPaymentSuccess(
    userId: string,
    eventTitle: string,
    amount: number,
    currency: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'payment_success',
      'Payment Successful',
      `Payment of ${currency} ${amount} for "${eventTitle}" was successful!`,
      { eventTitle, amount, currency }
    );
  }

  /**
   * Create event reminder notification
   */
  static async createEventReminder(
    userId: string,
    eventTitle: string,
    eventDate: string,
    eventId: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'event_reminder',
      'Event Reminder',
      `Don't forget! "${eventTitle}" is happening on ${eventDate}`,
      { eventId, eventTitle, eventDate }
    );
  }

  /**
   * Create event update notification
   */
  static async createEventUpdate(
    userId: string,
    eventTitle: string,
    updateType: string,
    eventId: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'event_update',
      'Event Updated',
      `There are updates to "${eventTitle}": ${updateType}`,
      { eventId, eventTitle, updateType }
    );
  }

  /**
   * Create certificate ready notification
   */
  static async createCertificateReady(
    userId: string,
    eventTitle: string,
    certificateUrl: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'certificate_ready',
      'Certificate Ready',
      `Your certificate for "${eventTitle}" is now available for download!`,
      { eventTitle, certificateUrl }
    );
  }

  /**
   * Create feedback request notification
   */
  static async createFeedbackRequest(
    userId: string,
    eventTitle: string,
    eventId: string
  ): Promise<string> {
    return this.createNotification(
      userId,
      'feedback_request',
      'Feedback Request',
      `Please share your feedback for "${eventTitle}"`,
      { eventId, eventTitle }
    );
  }

  /**
   * Create bulk admin notifications for multiple pending attendees
   */
  static async createBulkAdminPendingNotifications(
    adminUserId: string,
    pendingRegistrations: Array<{
      attendeeName: string;
      eventTitle: string;
      registrationId: string;
      amount: number;
      currency?: string;
    }>
  ): Promise<string[]> {
    const notifications: Promise<string>[] = [];
    
    for (const registration of pendingRegistrations) {
      const notification = this.createAdminPendingAttendeeNotification(
        adminUserId,
        registration.attendeeName,
        registration.eventTitle,
        registration.registrationId,
        registration.amount,
        registration.currency
      );
      notifications.push(notification);
    }
    
    return Promise.all(notifications);
  }

  /**
   * Get admin notifications (for admin users)
   */
  static subscribeToAdminNotifications(
    adminUserId: string,
    callback: (notifications: Notification[]) => void,
    limitCount: number = 50
  ) {
    const q = query(
      collection(db, this.COLLECTION),
      where('userId', '==', adminUserId),
      where('type', 'in', [
        'admin_pending_attendee',
        'admin_high_pending_count',
        'admin_event_created',
        'admin_check_in',
        'admin_payment_verified'
      ]),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(q, (snapshot) => {
      const notifications: Notification[] = [];
      snapshot.forEach((doc) => {
        notifications.push({
          id: doc.id,
          ...doc.data()
        } as Notification);
      });
      callback(notifications);
    }, (error) => {
      logger.error('Error subscribing to admin notifications:', error);
    });
  }
}
