import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  Timestamp,
  limit as firestoreLimit,
  QueryConstraint
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { logger } from '../utils/logger';

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

export interface EmailTemplate {
  id: string;
  name: string;
  type: 'registration_confirmation' | 'payment_notification' | 'event_reminder' | 'feedback_request' | 'checkin_notification';
  description: string;
}

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, any>;
  eventId?: string;
  registrationId?: string;
}

export interface ResendEmailStatus {
  id: string;
  status: 'queued' | 'sent' | 'delivered' | 'delivery_delayed' | 'bounced' | 'complained';
  created_at: string;
  last_event: string;
  to: string[];
  from: string;
  subject: string;
}

export class EmailService {
  private static readonly ACTIVITY_LOGS_COLLECTION = 'activity_logs';

  /**
   * Get available email templates
   */
  static getEmailTemplates(): EmailTemplate[] {
    return [
      {
        id: 'registration_confirmation',
        name: 'Registration Confirmation',
        type: 'registration_confirmation',
        description: 'Send registration confirmation to attendees'
      },
      {
        id: 'payment_notification',
        name: 'Payment Notification',
        type: 'payment_notification',
        description: 'Send payment status notifications'
      },
      {
        id: 'event_reminder',
        name: 'Event Reminder',
        type: 'event_reminder',
        description: 'Send event reminder to attendees'
      },
      {
        id: 'feedback_request',
        name: 'Feedback & Certificate',
        type: 'feedback_request',
        description: 'Request feedback from attendees - certificate will be automatically sent after submission'
      },
      {
        id: 'checkin_notification',
        name: 'Check-in Confirmation',
        type: 'checkin_notification',
        description: 'Send check-in confirmation to attendees'
      }
    ];
  }

  /**
   * Get sent emails for an event
   */
  static async getEventEmails(eventId: string, limitCount: number = 1000): Promise<EmailLog[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('eventId', '==', eventId),
        orderBy('timestamp', 'desc')
      ];

      if (limitCount) {
        constraints.push(firestoreLimit(limitCount));
      }

      const emailsQuery = query(
        collection(db, this.ACTIVITY_LOGS_COLLECTION),
        ...constraints
      );

      const snapshot = await getDocs(emailsQuery);
      
      // Email types we care about from activity_logs
      const EMAIL_TYPES = [
        'email_confirmation_sent',
        'payment_notification_sent', 
        'event_reminder_sent',
        'feedback_request_sent',
        'checkin_notification_sent'
      ];
      
      return snapshot.docs
        .filter(doc => {
          const type = doc.data().type;
          return type && EMAIL_TYPES.includes(type);
        })
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as EmailLog));
    } catch (error) {
      logger.error('Error fetching event emails:', error);
      throw new Error('Failed to fetch event emails');
    }
  }

  /**
   * Get all sent emails across all events
   */
  static async getAllEmails(limitCount: number = 1000): Promise<EmailLog[]> {
    try {
      const constraints: QueryConstraint[] = [
        orderBy('timestamp', 'desc')
      ];

      if (limitCount) {
        constraints.push(firestoreLimit(limitCount));
      }

      const emailsQuery = query(
        collection(db, this.ACTIVITY_LOGS_COLLECTION),
        ...constraints
      );

      const snapshot = await getDocs(emailsQuery);
      
      // Email types we care about from activity_logs
      const EMAIL_TYPES = [
        'email_confirmation_sent',
        'payment_notification_sent', 
        'event_reminder_sent',
        'feedback_request_sent',
        'checkin_notification_sent'
      ];
      
      return snapshot.docs
        .filter(doc => {
          const type = doc.data().type;
          return type && EMAIL_TYPES.includes(type);
        })
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as EmailLog));
    } catch (error) {
      logger.error('Error fetching all emails:', error);
      throw new Error('Failed to fetch all emails');
    }
  }

  /**
   * Get emails by attendee email
   */
  static async getAttendeeEmails(userEmail: string, limitCount: number = 50): Promise<EmailLog[]> {
    try {
      const constraints: QueryConstraint[] = [
        where('userEmail', '==', userEmail),
        orderBy('timestamp', 'desc')
      ];

      if (limitCount) {
        constraints.push(firestoreLimit(limitCount));
      }

      const emailsQuery = query(
        collection(db, this.ACTIVITY_LOGS_COLLECTION),
        ...constraints
      );

      const snapshot = await getDocs(emailsQuery);
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as EmailLog));
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
   * Send payment notification email
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
   * Get Resend email status
   */
  static async getEmailStatus(emailId: string): Promise<ResendEmailStatus | null> {
    try {
      const getEmailStatus = httpsCallable(functions, 'getResendEmailStatus');
      const result = await getEmailStatus({ emailId }) as any;
      
      if (result.data.success) {
        return result.data.status;
      }
      
      return null;
    } catch (error) {
      logger.error('Error fetching email status:', error);
      return null;
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
   * Send bulk emails to multiple attendees
   */
  static async sendBulkEmails(
    attendees: Array<{ email: string; name: string; registrationId?: string }>,
    template: EmailTemplate,
    eventData: {
      eventId: string;
      eventTitle: string;
      eventDate?: string;
      eventLocation?: string;
    },
    additionalData?: Record<string, any>
  ): Promise<{ success: number; failed: number; results: Array<{ email: string; success: boolean; message: string }> }> {
    try {
      const results: Array<{ email: string; success: boolean; message: string }> = [];
      let success = 0;
      let failed = 0;

      for (const attendee of attendees) {
        try {
          let result: { success: boolean; message: string; emailId?: string };

          switch (template.type) {
            case 'registration_confirmation':
              result = await this.sendConfirmationEmail({
                registrationId: attendee.registrationId || '',
                eventId: eventData.eventId,
                userEmail: attendee.email,
                userName: attendee.name,
                emailType: 'approved'
              });
              break;

            case 'event_reminder':
              result = await this.sendEventReminder({
                userEmail: attendee.email,
                userName: attendee.name,
                eventTitle: eventData.eventTitle,
                eventDate: eventData.eventDate || 'TBD',
                eventLocation: eventData.eventLocation || 'TBD',
                registrationId: attendee.registrationId
              });
              break;

            case 'feedback_request':
              result = await this.sendFeedbackRequest({
                userEmail: attendee.email,
                userName: attendee.name,
                eventTitle: eventData.eventTitle,
                eventId: eventData.eventId,
                registrationId: attendee.registrationId
              });
              break;

            default:
              result = {
                success: false,
                message: 'Unsupported template type for bulk send'
              };
          }

          if (result.success) {
            success++;
          } else {
            failed++;
          }

          results.push({
            email: attendee.email,
            success: result.success,
            message: result.message
          });
        } catch (error: any) {
          failed++;
          results.push({
            email: attendee.email,
            success: false,
            message: error.message || 'Failed to send email'
          });
        }
      }

      return { success, failed, results };
    } catch (error) {
      logger.error('Error sending bulk emails:', error);
      throw new Error('Failed to send bulk emails');
    }
  }

  /**
   * Get email statistics for an event
   */
  static async getEmailStats(eventId: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    byType: Record<string, number>;
  }> {
    try {
      const emails = await this.getEventEmails(eventId);
      
      const stats = {
        total: emails.length,
        successful: emails.filter(e => e.success).length,
        failed: emails.filter(e => !e.success).length,
        byType: {} as Record<string, number>
      };

      emails.forEach(email => {
        if (!stats.byType[email.type]) {
          stats.byType[email.type] = 0;
        }
        stats.byType[email.type]++;
      });

      return stats;
    } catch (error) {
      logger.error('Error fetching email stats:', error);
      throw new Error('Failed to fetch email statistics');
    }
  }

  /**
   * Get all emails directly from Resend API (including bounced emails)
   */
  static async getAllResendEmails(): Promise<{
    success: boolean;
    total: number;
    bounced_count: number;
    delivered_count: number;
    pending_count: number;
    bounced_emails: Array<{
      id: string;
      to: string[];
      from: string;
      subject: string;
      created_at: string;
      last_event: string;
    }>;
  } | null> {
    try {
      const getAllResendEmails = httpsCallable(functions, 'getAllResendEmails');
      const result = await getAllResendEmails({}) as any;
      
      if (result.data.success) {
        return result.data;
      }
      
      return null;
    } catch (error) {
      logger.error('Error fetching all Resend emails:', error);
      return null;
    }
  }

  /**
   * Export email logs to CSV
   */
  static async exportEmailLogs(emails: EmailLog[]): Promise<string> {
    try {
      if (emails.length === 0) {
        throw new Error('No emails to export');
      }

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

      const rows = emails.map(email => [
        email.timestamp.toDate().toISOString(),
        email.type,
        email.userEmail,
        email.userName,
        email.eventTitle || '',
        email.registrationId || '',
        email.status || '',
        email.emailId || '',
        email.success ? 'Yes' : 'No'
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(field => `"${field}"`).join(','))
        .join('\n');

      return csvContent;
    } catch (error) {
      logger.error('Error exporting email logs:', error);
      throw new Error('Failed to export email logs');
    }
  }
}

