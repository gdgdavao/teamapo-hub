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
import { Notification, NotificationType } from '../types';

export class NotificationService {
  private static COLLECTION = 'notifications';

  /**
   * Create a new notification
   */
  static async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<string> {
    try {
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
      return docRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
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
      console.error('Error marking notification as read:', error);
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
      console.error('Error marking all notifications as read:', error);
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
      console.error('Error deleting notification:', error);
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
      console.error('Error subscribing to notifications:', error);
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
      console.error('Error subscribing to unread count:', error);
    });
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
}
