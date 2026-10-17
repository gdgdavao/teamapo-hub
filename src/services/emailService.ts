import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  limit as firestoreLimit
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { logger } from '../utils/logger';
import { escapeCSVCell } from '../utils/csvExport';
import { toISOStringSafe } from '../utils/dateUtils';

export interface EmailLog {
  id: string;
  type: 'email_confirmation_sent' | 'payment_notification_sent' | 'event_reminder_sent' | 'feedback_request_sent' | 'checkin_notification_sent';
  registrationId?: string;
  eventId?: string;
  eventTitle?: string;
  userEmail: string;
  userName: string;
  emailId?: string;
  success: boolean;
  timestamp: Timestamp;
  status?: string;
  reminderType?: string;
  certificateUrl?: string;
  feedbackUrl?: string;
  /** When true, payment notification used registration-focused copy (free events). */
  isFreeRegistration?: boolean;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, any>;
  eventId?: string;
  registrationId?: string;
}

export class EmailService {
  private static readonly ACTIVITY_LOGS_COLLECTION = 'activity_logs';

  /**
   * Email types this product sends. activity_logs holds other kinds of audit
   * entries too, so every read filters on this.
   */
  private static readonly EMAIL_TYPES = [
    'email_confirmation_sent',
    'payment_notification_sent',
    'event_reminder_sent',
    'feedback_request_sent',
    'checkin_notification_sent'
  ] as const;

  private static toEmailLogs(docs: { id: string; data: () => Record<string, any> }[]): EmailLog[] {
    return docs
      .filter((doc) => (this.EMAIL_TYPES as readonly string[]).includes(doc.data().type))
      .map((doc) => ({ id: doc.id, ...doc.data() } as EmailLog));
  }

  /**
   * Every email sent for one event, newest first. Drives the CSV export.
   *
   * No `orderBy`: an equality filter on `eventId` alone is served by Firestore's
   * automatic single-field index, so this needs no composite index deployed. It
   * is still provable under firestore.rules:118, which branches on
   * `resource.data.eventId` — the exact field this query constrains.
   */
  static async getEventEmailLog(eventId: string, limitCount: number = 1000): Promise<EmailLog[]> {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, this.ACTIVITY_LOGS_COLLECTION),
          where('eventId', '==', eventId),
          firestoreLimit(limitCount)
        )
      );

      return this.toEmailLogs(snapshot.docs).sort(
        (a, b) => b.timestamp?.toMillis?.() - a.timestamp?.toMillis?.()
      );
    } catch (error) {
      logger.error('Error fetching event email log:', error);
      throw new Error('Failed to fetch event email log');
    }
  }

  /**
   * One attendee's email history. Both equality filters are required: `eventId`
   * is what makes the query provable under firestore.rules:118, and `userEmail`
   * is what keeps the result exact rather than truncated to the newest N.
   */
  static async getAttendeeEmails(
    eventId: string,
    userEmail: string,
    limitCount: number = 50
  ): Promise<EmailLog[]> {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, this.ACTIVITY_LOGS_COLLECTION),
          where('eventId', '==', eventId),
          where('userEmail', '==', userEmail),
          orderBy('timestamp', 'desc'),
          firestoreLimit(limitCount)
        )
      );

      return this.toEmailLogs(snapshot.docs);
    } catch (error) {
      logger.error('Error fetching attendee emails:', error);
      throw new Error('Failed to fetch attendee emails');
    }
  }

  /**
   * Send confirmation email
   */
  static async sendConfirmationEmail(params: {
    registrationId: string;
    eventId: string;
    userEmail: string;
    userName: string;
    requiresPayment?: boolean;
    emailType?: 'submitted' | 'approved';
    isResend?: boolean;
  }): Promise<{ success: boolean; message: string; emailId?: string }> {
    try {
      const sendConfirmationEmail = httpsCallable(functions, 'sendConfirmationEmail');
      const result = await sendConfirmationEmail(params) as any;
      
      return {
        success: result.data.success,
        message: result.data.message,
        emailId: result.data.emailId
      };
    } catch (error: any) {
      logger.error('Error sending confirmation email:', error);
      return {
        success: false,
        message: error.message || 'Failed to send confirmation email'
      };
    }
  }

  /**
   * Send registration approval/status notification email (pending payment emails are discontinued)
   */
  static async sendPaymentNotification(params: {
    registrationId: string;
    status: 'approved' | 'rejected' | 'pending';
    eventTitle: string;
    attendeeEmail: string;
    attendeeName: string;
    paymentInstructions?: string;
    isResend?: boolean;
    isFreeRegistration?: boolean;
  }): Promise<{ success: boolean; message: string; emailId?: string }> {
    try {
      const sendPaymentNotification = httpsCallable(functions, 'sendPaymentNotification');
      const result = await sendPaymentNotification(params) as any;
      
      return {
        success: result.data.success,
        message: result.data.message,
        emailId: result.data.emailId
      };
    } catch (error: any) {
      logger.error('Error sending payment notification:', error);
      return {
        success: false,
        message: error.message || 'Failed to send payment notification'
      };
    }
  }

  /**
   * Send event reminder email
   */
  static async sendEventReminder(params: {
    userEmail: string;
    userName: string;
    eventTitle: string;
    eventDate: string;
    eventLocation: string;
    registrationId?: string;
    reminderType?: '24h' | '1h';
    isResend?: boolean;
  }): Promise<{ success: boolean; message: string; emailId?: string }> {
    try {
      const sendEventReminder = httpsCallable(functions, 'sendEventReminder');
      const result = await sendEventReminder(params) as any;
      
      return {
        success: result.data.success,
        message: result.data.message,
        emailId: result.data.emailId
      };
    } catch (error: any) {
      logger.error('Error sending event reminder:', error);
      return {
        success: false,
        message: error.message || 'Failed to send event reminder'
      };
    }
  }

  /**
   * Send feedback request email
   */
  static async sendFeedbackRequest(params: {
    userEmail: string;
    userName: string;
    eventTitle: string;
    eventId: string;
    registrationId?: string;
    feedbackUrl?: string;
    isResend?: boolean;
  }): Promise<{ success: boolean; message: string; emailId?: string }> {
    try {
      const sendFeedbackRequest = httpsCallable(functions, 'sendFeedbackRequest');
      const result = await sendFeedbackRequest(params) as any;
      
      return {
        success: result.data.success,
        message: result.data.message,
        emailId: result.data.emailId
      };
    } catch (error: any) {
      logger.error('Error sending feedback request:', error);
      return {
        success: false,
        message: error.message || 'Failed to send feedback request'
      };
    }
  }

  /**
   * Send certificate notification email
   */
  static async sendCertificateNotification(params: {
    userEmail: string;
    userName: string;
    eventTitle: string;
    certificateUrl: string;
    registrationId?: string;
    isResend?: boolean;
  }): Promise<{ success: boolean; message: string; emailId?: string }> {
    try {
      const sendCertificateNotification = httpsCallable(functions, 'sendCertificateNotification');
      const result = await sendCertificateNotification(params) as any;
      
      return {
        success: result.data.success,
        message: result.data.message,
        emailId: result.data.emailId
      };
    } catch (error: any) {
      logger.error('Error sending certificate notification:', error);
      return {
        success: false,
        message: error.message || 'Failed to send certificate notification'
      };
    }
  }

  /**
   * Send check-in notification email
   */
  static async sendCheckInNotification(params: {
    registrationId: string;
    eventId: string;
    userEmail: string;
    userName: string;
    isResend?: boolean;
  }): Promise<{ success: boolean; message: string; emailId?: string }> {
    try {
      const sendCheckInNotification = httpsCallable(functions, 'sendCheckInNotification');
      const result = await sendCheckInNotification(params) as any;
      
      return {
        success: result.data.success,
        message: result.data.message,
        emailId: result.data.emailId
      };
    } catch (error: any) {
      logger.error('Error sending check-in notification:', error);
      return {
        success: false,
        message: error.message || 'Failed to send check-in notification'
      };
    }
  }

  /**
   * Resend email by log ID with optional email override
   * @param emailLog - The original email log entry
   * @param overrideEmail - Optional new email address to send to (for bounced/invalid emails)
   * @param isResend - Flag to mark this as a resend operation in activity logs
   */
  static async resendEmail(
    emailLog: EmailLog, 
    overrideEmail?: string,
    isResend: boolean = true
  ): Promise<{ success: boolean; message: string; emailId?: string }> {
    try {
      // Use override email if provided, otherwise use original
      const targetEmail = overrideEmail || emailLog.userEmail;
      
      // Determine which function to call based on email type
      switch (emailLog.type) {
        case 'email_confirmation_sent':
          return await this.sendConfirmationEmail({
            registrationId: emailLog.registrationId || '',
            eventId: emailLog.eventId || '',
            userEmail: targetEmail,
            userName: emailLog.userName,
            emailType: 'approved',
            isResend
          });

        case 'payment_notification_sent':
          return await this.sendPaymentNotification({
            registrationId: emailLog.registrationId || '',
            status: emailLog.status as any || 'pending',
            eventTitle: emailLog.eventTitle || '',
            attendeeEmail: targetEmail,
            attendeeName: emailLog.userName,
            isResend,
            isFreeRegistration: emailLog.isFreeRegistration === true
          });

        case 'event_reminder_sent':
          return await this.sendEventReminder({
            userEmail: targetEmail,
            userName: emailLog.userName,
            eventTitle: emailLog.eventTitle || '',
            eventDate: 'TBD',
            eventLocation: 'TBD',
            registrationId: emailLog.registrationId,
            reminderType: emailLog.reminderType as any,
            isResend
          });

        case 'feedback_request_sent':
          return await this.sendFeedbackRequest({
            userEmail: targetEmail,
            userName: emailLog.userName,
            eventTitle: emailLog.eventTitle || '',
            eventId: emailLog.eventId || '',
            registrationId: emailLog.registrationId,
            feedbackUrl: emailLog.feedbackUrl,
            isResend
          });

        case 'checkin_notification_sent':
          return await this.sendCheckInNotification({
            registrationId: emailLog.registrationId || '',
            eventId: emailLog.eventId || '',
            userEmail: targetEmail,
            userName: emailLog.userName,
            isResend
          });

        default:
          return {
            success: false,
            message: 'Unknown email type'
          };
      }
    } catch (error: any) {
      logger.error('Error resending email:', error);
      return {
        success: false,
        message: error.message || 'Failed to resend email'
      };
    }
  }
/**
   * Export email logs to CSV
   */
  static exportEmailLogs(emails: EmailLog[]): string {
    const headers = [
      'Timestamp',
      'Type',
      'Recipient Email',
      'Recipient Name',
      'Event Title',
      'Registration ID',
      'Status',
      'Email ID',
      'Success'
    ];

    const rows = emails.map((email) => [
      toISOStringSafe(email.timestamp, ''),
      email.type,
      email.userEmail,
      email.userName,
      email.eventTitle ?? '',
      email.registrationId ?? '',
      email.status ?? '',
      email.emailId ?? '',
      email.success ? 'Yes' : 'No'
    ]);

    return [headers, ...rows]
      .map((row) => row.map((field) => escapeCSVCell(field)).join(','))
      .join('\n');
  }
}

