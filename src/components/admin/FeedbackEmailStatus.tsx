import React, { useState, useEffect, useCallback } from 'react';
import {
  EnvelopeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PaperAirplaneIcon
} from '@heroicons/react/24/outline';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase';
import { RegistrationService } from '../../services/registrationService';
import { Registration, Event } from '../../types';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

interface FeedbackEmailStatusProps {
  event: Event;
  onEmailsSent?: () => void;
}

interface EmailStatusData {
  checkedInCount: number;
  emailSentCount: number;
  missingEmailCount: number;
  feedbackSubmittedCount: number;
  missingRecipients: Array<{
    registrationId: string;
    name: string;
    email: string;
    checkedInAt?: Date;
  }>;
}

const FeedbackEmailStatus: React.FC<FeedbackEmailStatusProps> = ({ event, onEmailsSent }) => {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [statusData, setStatusData] = useState<EmailStatusData | null>(null);
  const [showMissing, setShowMissing] = useState(false);

  const fetchEmailStatus = useCallback(async () => {
    try {
      setLoading(true);
      const registrations = await RegistrationService.getEventRegistrations(event.id);
      
      // Filter checked-in attendees
      const checkedInRegistrations = registrations.filter(
        (r: Registration) => r.attendanceStatus === 'checked-in'
      );
      
      // Count those who received feedback request
      const emailSentRegistrations = checkedInRegistrations.filter(
        (r: Registration) => r.feedbackRequestSent === true
      );
      
      // Count those who submitted feedback
      const feedbackSubmittedRegistrations = checkedInRegistrations.filter(
        (r: Registration) => r.feedbackSubmitted === true
      );
      
      // Find missing recipients (checked-in but no email sent and no feedback submitted)
      const missingRecipients = checkedInRegistrations
        .filter((r: Registration) => !r.feedbackRequestSent && !r.feedbackSubmitted)
        .map((r: Registration) => ({
          registrationId: r.id || '',
          name: r.userDetails?.name || 'Unknown',
          email: r.userDetails?.email || 'No email',
          checkedInAt: r.checkedInAt instanceof Date 
            ? r.checkedInAt 
            : r.checkedInAt?.toDate?.() || undefined
        }));
      
      setStatusData({
        checkedInCount: checkedInRegistrations.length,
        emailSentCount: emailSentRegistrations.length,
        missingEmailCount: missingRecipients.length,
        feedbackSubmittedCount: feedbackSubmittedRegistrations.length,
        missingRecipients
      });
    } catch (error) {
      logger.error('Error fetching email status:', error);
      toast.error('Failed to load email status');
    } finally {
      setLoading(false);
    }
  }, [event.id]);

  useEffect(() => {
    fetchEmailStatus();
  }, [fetchEmailStatus]);

  const handleResendEmails = async () => {
    if (sending) return;
    
    const confirmed = window.confirm(
      `Send feedback request emails to ${statusData?.missingEmailCount || 0} attendees who haven't received them yet?\n\nThis will send emails to checked-in attendees who are missing the feedback email.`
    );
    
    if (!confirmed) return;
    
    setSending(true);
    
    try {
      const resendFeedback = httpsCallable(functions, 'resendEventFeedbackRequests');
      const result = await resendFeedback({ eventId: event.id, force: true }) as any;
      
      if (result.data.success) {
        toast.success(`${result.data.message}`, {
          duration: 5000,
          icon: '✉️'
        });
        
        // Refresh status
        await fetchEmailStatus();
        
        // Notify parent
        onEmailsSent?.();
      } else {
        toast.error(result.data.message || 'Failed to send feedback requests');
      }
    } catch (error: any) {
      logger.error('Error sending feedback emails:', error);
      toast.error(error.message || 'Failed to send feedback requests');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-center py-4">
          <ArrowPathIcon className="h-5 w-5 text-gray-400 animate-spin mr-2" />
          <span className="text-gray-500">Loading email status...</span>
        </div>
      </div>
    );
  }

  if (!statusData) return null;

  const { checkedInCount, emailSentCount, missingEmailCount, feedbackSubmittedCount, missingRecipients } = statusData;
  const emailPercentage = checkedInCount > 0 ? Math.round((emailSentCount / checkedInCount) * 100) : 0;
  const hasMissing = missingEmailCount > 0;

  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 mb-6 border-l-4 ${
      hasMissing ? 'border-amber-500' : 'border-green-500'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${hasMissing ? 'bg-amber-100' : 'bg-green-100'}`}>
            <EnvelopeIcon className={`h-6 w-6 ${hasMissing ? 'text-amber-600' : 'text-green-600'}`} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Feedback Email Status</h3>
            <p className="text-sm text-gray-500">
              Track feedback email delivery to checked-in attendees
            </p>
          </div>
        </div>
        
        <button
          onClick={fetchEmailStatus}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Refresh status"
        >
          <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">{checkedInCount}</div>
          <div className="text-sm text-gray-500">Checked-in</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-green-700">{emailSentCount}</span>
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          </div>
          <div className="text-sm text-green-600">Emails Sent</div>
        </div>
        
        <div className={`rounded-lg p-4 ${hasMissing ? 'bg-amber-50' : 'bg-gray-50'}`}>
          <div className="flex items-center space-x-2">
            <span className={`text-2xl font-bold ${hasMissing ? 'text-amber-700' : 'text-gray-700'}`}>
              {missingEmailCount}
            </span>
            {hasMissing && <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />}
          </div>
          <div className={`text-sm ${hasMissing ? 'text-amber-600' : 'text-gray-500'}`}>Missing Emails</div>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-700">{feedbackSubmittedCount}</div>
          <div className="text-sm text-blue-600">Feedback Received</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Email delivery progress</span>
          <span>{emailPercentage}% ({emailSentCount}/{checkedInCount})</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full ${hasMissing ? 'bg-amber-500' : 'bg-green-500'}`}
            style={{ width: `${emailPercentage}%` }}
          />
        </div>
      </div>

      {/* Missing Recipients Alert */}
      {hasMissing && (
        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">
                  {missingEmailCount} attendee{missingEmailCount !== 1 ? 's' : ''} missing feedback email
                </h4>
                <p className="text-sm text-amber-700 mt-1">
                  These checked-in attendees haven't received the feedback request email yet.
                </p>
              </div>
            </div>
            
            <button
              onClick={handleResendEmails}
              disabled={sending}
              className="inline-flex items-center px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                  Send Missing Emails
                </>
              )}
            </button>
          </div>
          
          {/* Expandable Missing Recipients List */}
          <div className="mt-4">
            <button
              onClick={() => setShowMissing(!showMissing)}
              className="flex items-center text-sm text-amber-700 hover:text-amber-800"
            >
              {showMissing ? (
                <>
                  <ChevronUpIcon className="h-4 w-4 mr-1" />
                  Hide details
                </>
              ) : (
                <>
                  <ChevronDownIcon className="h-4 w-4 mr-1" />
                  Show {missingEmailCount} missing recipient{missingEmailCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
            
            {showMissing && (
              <div className="mt-3 max-h-60 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-amber-800">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-200">
                    {missingRecipients.map((recipient, index) => (
                      <tr key={recipient.registrationId || index} className="text-amber-700">
                        <td className="py-2 pr-4">{recipient.name}</td>
                        <td className="py-2">{recipient.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* All Sent Success Message */}
      {!hasMissing && emailSentCount > 0 && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
            <div>
              <h4 className="font-medium text-green-800">All emails sent successfully!</h4>
              <p className="text-sm text-green-700 mt-1">
                All {emailSentCount} checked-in attendees have received the feedback request email.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackEmailStatus;
