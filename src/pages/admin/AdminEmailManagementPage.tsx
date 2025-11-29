import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Search, 
  Mail, 
  Send, 
  RefreshCw, 
  Download, 
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  MailOpen,
  AlertCircle,
  X,
  Edit3
} from 'lucide-react';
import { EmailService, EmailLog, EmailTemplate } from '../../services/emailService';
import { EventService } from '../../services/eventService';
import { RegistrationService } from '../../services/registrationService';
import { Event, Registration } from '../../types';
import { logger } from '../../utils/logger';
import AdminLayout from '../../components/admin/AdminLayout';

type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'delivery_delayed' | 'bounced' | 'complained' | 'unknown';
type EmailLogWithStatus = EmailLog & { deliveryStatus?: DeliveryStatus };

const AdminEmailManagementPage = () => {
  const { eventId } = useParams<{ eventId?: string }>();
  
  const [emails, setEmails] = useState<EmailLogWithStatus[]>([]);
  const [filteredEmails, setFilteredEmails] = useState<EmailLogWithStatus[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>(eventId || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmailType, setSelectedEmailType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [refreshingStatuses, setRefreshingStatuses] = useState(false);
  const [fetchingFromResend, setFetchingFromResend] = useState(false);
  
  // Resend modal state
  const [showResendModal, setShowResendModal] = useState(false);
  const [resendTarget, setResendTarget] = useState<EmailLogWithStatus | null>(null);
  const [overrideEmail, setOverrideEmail] = useState('');
  const [resendingFromModal, setResendingFromModal] = useState(false);
  const [resendEmailType, setResendEmailType] = useState<string>('');
  
  // Bulk selection state
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [bulkResending, setBulkResending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  
  const [emailStats, setEmailStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
    bounced: 0,
    byType: {} as Record<string, number>
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Update filtered emails when filters change
  useEffect(() => {
    filterEmails();
  }, [emails, searchTerm, selectedEmailType, selectedStatus, selectedEvent]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load events
      const eventsData = await EventService.getAllEvents();
      setEvents(eventsData);

      // Load emails based on event selection
      let emailsData: EmailLogWithStatus[];
      if (eventId) {
        emailsData = await EmailService.getEventEmails(eventId);
        setSelectedEvent(eventId);
        
        // Load event-specific registrations
        const regsData = await RegistrationService.getEventRegistrations(eventId);
        setRegistrations(regsData);
      } else {
        emailsData = await EmailService.getAllEmails();
      }

      // Initially set emails without delivery status (for performance)
      const initialEmails: EmailLogWithStatus[] = emailsData.map(email => ({
        ...email,
        deliveryStatus: email.success ? 'sent' : 'unknown'
      }));

      // Calculate stats based on deliveryStatus
      const computeStats = (list: EmailLogWithStatus[]) => {
        const isSuccess = (s?: DeliveryStatus) => s === 'delivered' || s === 'sent';
        const isFailed = (s?: DeliveryStatus) => s === 'bounced' || s === 'complained';
        const stats = {
          total: list.length,
          successful: list.filter(e => isSuccess(e.deliveryStatus)).length,
          failed: list.filter(e => isFailed(e.deliveryStatus)).length,
          bounced: list.filter(e => e.deliveryStatus === 'bounced').length,
          byType: {} as Record<string, number>
        };
        list.forEach(email => {
          if (!stats.byType[email.type]) stats.byType[email.type] = 0;
          stats.byType[email.type]++;
        });
        return stats;
      };

      setEmails(initialEmails);
      setEmailStats(computeStats(initialEmails));
    } catch (error) {
      logger.error('Error loading email data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBouncedEmailsFromResend = async () => {
    if (fetchingFromResend) return;
    
    setFetchingFromResend(true);
    try {
      logger.log('Fetching ALL emails directly from Resend API...');
      const resendData = await EmailService.getAllResendEmails();
      
      if (resendData && resendData.success) {
        logger.log(`📧 Resend API Summary:
          Total: ${resendData.total}
          ✅ Delivered: ${resendData.delivered_count}
          ❌ Bounced: ${resendData.bounced_count}
          ⏳ Pending: ${resendData.pending_count}
        `);
        
        // Log bounced emails
        if (resendData.bounced_emails.length > 0) {
          logger.log('\n🚫 BOUNCED EMAILS FROM RESEND:');
          resendData.bounced_emails.forEach((email, index) => {
            logger.log(`  ${index + 1}. ${email.to.join(', ')} - ${email.subject} (${email.id})`);
          });
        }
        
        alert(
          `📊 Resend API Data:\n\n` +
          `Total Emails: ${resendData.total}\n` +
          `✅ Delivered: ${resendData.delivered_count}\n` +
          `❌ Bounced: ${resendData.bounced_count}\n` +
          `⏳ Pending/Other: ${resendData.pending_count}\n\n` +
          `Check browser console for full bounced emails list.`
        );
      } else {
        alert('Failed to fetch emails from Resend API');
      }
    } catch (error) {
      logger.error('Error fetching from Resend:', error);
      alert('Error fetching emails from Resend. Check console for details.');
    } finally {
      setFetchingFromResend(false);
    }
  };

  const refreshDeliveryStatuses = async () => {
    if (refreshingStatuses) return;
    
    setRefreshingStatuses(true);
    try {
      const emailsWithIds = emails.filter(e => e.emailId);
      logger.log(`Refreshing delivery status for ${emailsWithIds.length} emails with emailIds...`);
      
      let successCount = 0;
      let bouncedCount = 0;
      let failedFetchCount = 0;

      // Enrich with delivery status from Resend (process in batches to avoid rate limiting)
      const batchSize = 10;
      const enrichedEmails = [...emails];
      
      for (let i = 0; i < emailsWithIds.length; i += batchSize) {
        const batch = emailsWithIds.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (email) => {
            try {
              const status = await EmailService.getEmailStatus(email.emailId!);
              
              if (status) {
                // Map Resend status to our DeliveryStatus
                let deliveryStatus: DeliveryStatus;
                const resendStatus = status.status?.toLowerCase() || status.last_event?.toLowerCase() || 'unknown';
                
                logger.log(`Email ${email.emailId}: Resend status = ${resendStatus}`);
                
                if (resendStatus === 'delivered') {
                  deliveryStatus = 'delivered';
                  successCount++;
                } else if (resendStatus === 'sent') {
                  deliveryStatus = 'sent';
                  successCount++;
                } else if (resendStatus === 'bounced' || resendStatus === 'bounce') {
                  deliveryStatus = 'bounced';
                  bouncedCount++;
                  logger.warn(`⚠️ BOUNCED email detected: ${email.userEmail} (${email.emailId})`);
                } else if (resendStatus === 'complained' || resendStatus === 'complaint') {
                  deliveryStatus = 'complained';
                  bouncedCount++;
                } else if (resendStatus === 'delivery_delayed') {
                  deliveryStatus = 'delivery_delayed';
                } else if (resendStatus === 'queued') {
                  deliveryStatus = 'queued';
                } else {
                  deliveryStatus = 'unknown';
                }
                
                // Update the email in the array
                const index = enrichedEmails.findIndex(e => e.id === email.id);
                if (index !== -1) {
                  enrichedEmails[index] = { ...enrichedEmails[index], deliveryStatus };
                }
              } else {
                failedFetchCount++;
                logger.warn(`No status returned for email ${email.emailId}`);
              }
            } catch (error) {
              failedFetchCount++;
              logger.error(`Error fetching status for ${email.emailId}:`, error);
            }
          })
        );
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < emailsWithIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.log(`✅ Status refresh complete: ${successCount} successful, ${bouncedCount} bounced/complained, ${failedFetchCount} failed to fetch`);

      setEmails(enrichedEmails as EmailLogWithStatus[]);
      
      // Recalculate stats
      const computeStats = (list: EmailLogWithStatus[]) => {
        const isSuccess = (s?: DeliveryStatus) => s === 'delivered' || s === 'sent';
        const isFailed = (s?: DeliveryStatus) => s === 'bounced' || s === 'complained';
        const stats = {
          total: list.length,
          successful: list.filter(e => isSuccess(e.deliveryStatus)).length,
          failed: list.filter(e => isFailed(e.deliveryStatus)).length,
          bounced: list.filter(e => e.deliveryStatus === 'bounced').length,
          byType: {} as Record<string, number>
        };
        list.forEach(email => {
          if (!stats.byType[email.type]) stats.byType[email.type] = 0;
          stats.byType[email.type]++;
        });
        return stats;
      };
      
      const newStats = computeStats(enrichedEmails as EmailLogWithStatus[]);
      setEmailStats(newStats);
      
      alert(`Status updated!\n✅ Successful: ${successCount}\n❌ Bounced: ${bouncedCount}\n⚠️ Failed to fetch: ${failedFetchCount}`);
    } catch (error) {
      logger.error('Error refreshing delivery statuses:', error);
      alert('Failed to refresh delivery statuses. Check console for details.');
    } finally {
      setRefreshingStatuses(false);
    }
  };

  const filterEmails = () => {
    let filtered = [...emails];

    // Filter by event
    if (selectedEvent !== 'all') {
      filtered = filtered.filter(email => email.eventId === selectedEvent);
    }

    // Filter by search term (email or name)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(email => 
        email.userEmail.toLowerCase().includes(term) ||
        email.userName.toLowerCase().includes(term)
      );
    }

    // Filter by email type
    if (selectedEmailType !== 'all') {
      filtered = filtered.filter(email => email.type === selectedEmailType);
    }

    // Filter by status (use deliveryStatus from Resend when available)
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(email => {
        const status = (email as EmailLogWithStatus).deliveryStatus;
        if (selectedStatus === 'success') return status === 'delivered' || status === 'sent';
        if (selectedStatus === 'failed') return status === 'bounced' || status === 'complained';
        if (selectedStatus === 'bounced') return status === 'bounced';
        if (selectedStatus === 'pending') return status === 'unknown' || status === 'queued' || status === 'delivery_delayed';
        return true;
      });
    }

    setFilteredEmails(filtered);
  };

  const handleResendEmail = async (emailLog: EmailLog) => {
    if (resendingEmail) return;

    setResendingEmail(emailLog.id);
    try {
      const result = await EmailService.resendEmail(emailLog);
      
      if (result.success) {
        alert('Email resent successfully!');
        loadData(); // Reload to show new email log
      } else {
        alert(`Failed to resend email: ${result.message}`);
      }
    } catch (error: any) {
      logger.error('Error resending email:', error);
      alert(`Error resending email: ${error.message}`);
    } finally {
      setResendingEmail(null);
    }
  };

  // Open resend modal for a specific email
  const handleOpenResendModal = (email: EmailLogWithStatus) => {
    setResendTarget(email);
    setOverrideEmail(email.userEmail);
    setResendEmailType(email.type); // Default to original email type
    setShowResendModal(true);
  };

  // Close resend modal
  const handleCloseResendModal = () => {
    setShowResendModal(false);
    setResendTarget(null);
    setOverrideEmail('');
    setResendEmailType('');
    setResendingFromModal(false);
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Resend email from modal with optional email override and type change
  const handleResendFromModal = async () => {
    if (!resendTarget || resendingFromModal) return;
    
    if (!isValidEmail(overrideEmail)) {
      alert('Please enter a valid email address');
      return;
    }

    setResendingFromModal(true);
    try {
      const isEmailChanged = overrideEmail !== resendTarget.userEmail;
      const isTypeChanged = resendEmailType !== resendTarget.type;
      
      // Create a modified email log with the new type if changed
      const emailLogToResend: EmailLog = isTypeChanged 
        ? { ...resendTarget, type: resendEmailType as EmailLog['type'] }
        : resendTarget;
      
      const result = await EmailService.resendEmail(
        emailLogToResend, 
        isEmailChanged ? overrideEmail : undefined,
        true
      );
      
      const changes: string[] = [];
      if (isEmailChanged) changes.push(`to ${overrideEmail}`);
      if (isTypeChanged) changes.push(`as ${getEmailTypeLabel(resendEmailType)}`);
      
      if (result.success) {
        alert(`Email resent successfully${changes.length > 0 ? ` (${changes.join(', ')})` : ''}!`);
        handleCloseResendModal();
        loadData();
      } else {
        alert(`Failed to resend email: ${result.message}`);
      }
    } catch (error: any) {
      logger.error('Error resending email from modal:', error);
      alert(`Error resending email: ${error.message}`);
    } finally {
      setResendingFromModal(false);
    }
  };

  // Toggle selection of a single email
  const handleToggleEmailSelection = (emailId: string) => {
    setSelectedEmails(prev => 
      prev.includes(emailId)
        ? prev.filter(id => id !== emailId)
        : [...prev, emailId]
    );
  };

  // Toggle select all emails (visible/filtered)
  const handleToggleSelectAll = () => {
    if (selectedEmails.length === filteredEmails.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(filteredEmails.map(e => e.id));
    }
  };

  // Bulk resend selected emails with throttling
  const handleBulkResend = async () => {
    if (selectedEmails.length === 0 || bulkResending) return;

    const confirmed = confirm(
      `Are you sure you want to resend ${selectedEmails.length} email(s)?\n\n` +
      `This will resend the emails to their original recipients.`
    );
    if (!confirmed) return;

    setBulkResending(true);
    setBulkProgress({ current: 0, total: selectedEmails.length });

    let successCount = 0;
    let failedCount = 0;
    const failedEmails: string[] = [];

    for (let i = 0; i < selectedEmails.length; i++) {
      const emailId = selectedEmails[i];
      const email = emails.find(e => e.id === emailId);
      
      if (!email) {
        failedCount++;
        continue;
      }

      try {
        const result = await EmailService.resendEmail(email, undefined, true);
        
        if (result.success) {
          successCount++;
        } else {
          failedCount++;
          failedEmails.push(`${email.userEmail}: ${result.message}`);
        }
      } catch (error: any) {
        failedCount++;
        failedEmails.push(`${email.userEmail}: ${error.message}`);
      }

      setBulkProgress({ current: i + 1, total: selectedEmails.length });

      // Throttle: 100ms delay between requests
      if (i < selectedEmails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setBulkResending(false);
    setSelectedEmails([]);

    let message = `Bulk resend complete!\n\n✅ Successful: ${successCount}\n❌ Failed: ${failedCount}`;
    if (failedEmails.length > 0 && failedEmails.length <= 5) {
      message += `\n\nFailed emails:\n${failedEmails.join('\n')}`;
    }
    alert(message);
    
    loadData();
  };

  // Select all bounced/failed emails
  const handleSelectAllBounced = () => {
    const bouncedIds = filteredEmails
      .filter(e => e.deliveryStatus === 'bounced' || e.deliveryStatus === 'complained')
      .map(e => e.id);
    setSelectedEmails(bouncedIds);
  };

  const handleBulkSend = async () => {
    // Legacy bulk send - can be removed if not needed
    alert('Use the row selection and "Resend Selected" for bulk operations');
  };

  const handleExportEmails = async () => {
    try {
      const csv = await EmailService.exportEmailLogs(filteredEmails);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-logs-${selectedEvent}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      logger.error('Error exporting emails:', error);
      alert(`Error exporting: ${error.message}`);
    }
  };

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      email_confirmation_sent: 'Registration Confirmation',
      payment_notification_sent: 'Payment Notification',
      event_reminder_sent: 'Event Reminder',
      feedback_request_sent: 'Feedback & Certificate',
      checkin_notification_sent: 'Check-in Confirmation'
    };
    return labels[type] || type;
  };

  const getEmailTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      email_confirmation_sent: 'bg-blue-100 text-blue-800',
      payment_notification_sent: 'bg-green-100 text-green-800',
      event_reminder_sent: 'bg-yellow-100 text-yellow-800',
      feedback_request_sent: 'bg-purple-100 text-purple-800',
      checkin_notification_sent: 'bg-teal-100 text-teal-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const renderDeliveryStatus = (email: EmailLogWithStatus) => {
    const status = email.deliveryStatus;
    if (status === 'delivered') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Delivered
        </span>
      );
    }
    if (status === 'sent' || status === 'queued') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <MailOpen className="h-3 w-3 mr-1" />
          Sent
        </span>
      );
    }
    if (status === 'delivery_delayed') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="h-3 w-3 mr-1" />
          Delayed
        </span>
      );
    }
    if (status === 'bounced') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
          <XCircle className="h-3 w-3 mr-1" />
          BOUNCED
        </span>
      );
    }
    if (status === 'complained') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-300">
          <AlertCircle className="h-3 w-3 mr-1" />
          Complained
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <Clock className="h-3 w-3 mr-1" />
        Unknown
      </span>
    );
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Email Management</h1>
          <p className="text-gray-600">Manage and track all emails sent to attendees</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Emails</p>
                <p className="text-2xl font-bold text-gray-900">{emailStats.total}</p>
              </div>
              <Mail className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Successful</p>
                <p className="text-2xl font-bold text-green-600">{emailStats.successful}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{emailStats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Bounced</p>
                <p className="text-2xl font-bold text-red-600">{emailStats.bounced}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {emailStats.total > 0 ? Math.round((emailStats.successful / emailStats.total) * 100) : 0}%
                </p>
              </div>
              <MailOpen className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3">
              {/* Bulk Resend Selected */}
              <button
                onClick={handleBulkResend}
                disabled={selectedEmails.length === 0 || bulkResending}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4 mr-2" />
                {bulkResending 
                  ? `Resending ${bulkProgress.current}/${bulkProgress.total}...` 
                  : `Resend Selected (${selectedEmails.length})`
                }
              </button>

              {/* Select All Bounced */}
              <button
                onClick={handleSelectAllBounced}
                disabled={filteredEmails.filter(e => e.deliveryStatus === 'bounced' || e.deliveryStatus === 'complained').length === 0}
                className="inline-flex items-center px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Select Bounced
              </button>

              <button
                onClick={loadData}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </button>

              <button
                onClick={fetchBouncedEmailsFromResend}
                disabled={fetchingFromResend}
                className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Fetch ALL emails directly from Resend API"
              >
                <Download className={`h-4 w-4 mr-2 ${fetchingFromResend ? 'animate-spin' : ''}`} />
                Get Bounced from Resend
              </button>

              <button
                onClick={refreshDeliveryStatuses}
                disabled={refreshingStatuses || emails.length === 0}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Update delivery status for current emails"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshingStatuses ? 'animate-spin' : ''}`} />
                Update Delivery Status
              </button>

              <button
                onClick={handleExportEmails}
                disabled={filteredEmails.length === 0}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="h-4 w-4" />
              {filteredEmails.length} of {emails.length} emails
              {selectedEmails.length > 0 && (
                <span className="ml-2 text-blue-600 font-medium">
                  ({selectedEmails.length} selected)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Event Filter */}
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Events</option>
              {events.map(event => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>

            {/* Email Type Filter */}
            <select
              value={selectedEmailType}
              onChange={(e) => setSelectedEmailType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="email_confirmation_sent">Registration Confirmation</option>
              <option value="payment_notification_sent">Payment Notification</option>
              <option value="event_reminder_sent">Event Reminder</option>
              <option value="feedback_request_sent">Feedback & Certificate</option>
              <option value="checkin_notification_sent">Check-in Confirmation</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="success">✅ Successful (Delivered/Sent)</option>
              <option value="failed">❌ Failed (Bounced/Complained)</option>
              <option value="bounced">🚫 Bounced Only</option>
              <option value="pending">⏳ Pending/Unknown</option>
            </select>
          </div>
        </div>

        {/* Email List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          ) : filteredEmails.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No emails found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedEmails.length === filteredEmails.length && filteredEmails.length > 0}
                        onChange={handleToggleSelectAll}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        aria-label="Select all emails"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Event
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredEmails.map((email) => (
                    <tr 
                      key={email.id} 
                      className={`hover:bg-gray-50 ${selectedEmails.includes(email.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedEmails.includes(email.id)}
                          onChange={() => handleToggleEmailSelection(email.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          aria-label={`Select email to ${email.userEmail}`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {email.timestamp.toDate().toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{email.userName}</div>
                        <div className="text-sm text-gray-500">{email.userEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEmailTypeColor(email.type)}`}>
                          {getEmailTypeLabel(email.type)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {email.eventTitle || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {renderDeliveryStatus(email as EmailLogWithStatus)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleOpenResendModal(email)}
                          disabled={resendingEmail === email.id}
                          className="inline-flex items-center px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Resend email (with option to change recipient)"
                          aria-label={`Resend email to ${email.userEmail}`}
                        >
                          {resendingEmail === email.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Edit3 className="h-4 w-4 mr-1" />
                              <span>Resend</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Resend Email Modal */}
        {showResendModal && resendTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Resend Email</h3>
                <button
                  onClick={handleCloseResendModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Original Email Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Original Type:</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getEmailTypeColor(resendTarget.type)}`}>
                        {getEmailTypeLabel(resendTarget.type)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Event:</span>
                      <span className="ml-2 text-gray-900 font-medium">{resendTarget.eventTitle || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Original Recipient:</span>
                      <span className="ml-2 text-gray-900">{resendTarget.userName}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className="ml-2">{renderDeliveryStatus(resendTarget)}</span>
                    </div>
                  </div>
                </div>

                {/* Email Type Selector */}
                <div>
                  <label htmlFor="resend-email-type" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Type to Send
                  </label>
                  <select
                    id="resend-email-type"
                    value={resendEmailType}
                    onChange={(e) => setResendEmailType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="email_confirmation_sent">Registration Confirmation</option>
                    <option value="payment_notification_sent">Payment Notification</option>
                    <option value="event_reminder_sent">Event Reminder</option>
                    <option value="feedback_request_sent">Feedback & Certificate</option>
                    <option value="checkin_notification_sent">Check-in Confirmation</option>
                  </select>
                  {resendEmailType !== resendTarget.type && (
                    <p className="mt-1 text-xs text-blue-600">
                      ℹ️ Will send as <strong>{getEmailTypeLabel(resendEmailType)}</strong> instead of original type
                    </p>
                  )}
                </div>

                {/* Email Address Input */}
                <div>
                  <label htmlFor="override-email" className="block text-sm font-medium text-gray-700 mb-2">
                    Recipient Email Address
                  </label>
                  <input
                    id="override-email"
                    type="email"
                    value={overrideEmail}
                    onChange={(e) => setOverrideEmail(e.target.value)}
                    placeholder="Enter email address"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      overrideEmail && !isValidEmail(overrideEmail) 
                        ? 'border-red-300 bg-red-50' 
                        : 'border-gray-300'
                    }`}
                    aria-describedby="email-help"
                  />
                  <p id="email-help" className="mt-1 text-xs text-gray-500">
                    Change the email address if the original bounced or is incorrect
                  </p>
                  {overrideEmail && !isValidEmail(overrideEmail) && (
                    <p className="mt-1 text-xs text-red-600">Please enter a valid email address</p>
                  )}
                </div>

                {/* Summary of changes */}
                {(overrideEmail !== resendTarget.userEmail || resendEmailType !== resendTarget.type) && isValidEmail(overrideEmail) && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-yellow-800">
                        <strong>Changes to apply:</strong>
                        <ul className="mt-1 list-disc list-inside">
                          {overrideEmail !== resendTarget.userEmail && (
                            <li>Send to <span className="font-medium">{overrideEmail}</span> instead of <span className="line-through">{resendTarget.userEmail}</span></li>
                          )}
                          {resendEmailType !== resendTarget.type && (
                            <li>Send as <span className="font-medium">{getEmailTypeLabel(resendEmailType)}</span> instead of {getEmailTypeLabel(resendTarget.type)}</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={handleCloseResendModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResendFromModal}
                  disabled={resendingFromModal || !isValidEmail(overrideEmail)}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendingFromModal ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Resend Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Progress Overlay */}
        {bulkResending && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
              <div className="text-center">
                <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Resending Emails</h3>
                <p className="text-gray-600 mb-4">
                  Processing {bulkProgress.current} of {bulkProgress.total}...
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminEmailManagementPage;

