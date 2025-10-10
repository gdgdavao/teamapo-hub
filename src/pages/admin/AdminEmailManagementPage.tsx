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
  ChevronDown,
  Users,
  FileText,
  AlertCircle
} from 'lucide-react';
import { EmailService, EmailLog, EmailTemplate } from '../../services/emailService';
import { EventService } from '../../services/eventService';
import { RegistrationService } from '../../services/registrationService';
import { Event, Registration } from '../../types';
import AdminLayout from '../../components/admin/AdminLayout';

const AdminEmailManagementPage = () => {
  const { eventId } = useParams<{ eventId?: string }>();
  
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [filteredEmails, setFilteredEmails] = useState<EmailLog[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>(eventId || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmailType, setSelectedEmailType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [showBulkSendModal, setShowBulkSendModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [emailStats, setEmailStats] = useState({
    total: 0,
    successful: 0,
    failed: 0,
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
      let emailsData: EmailLog[];
      if (eventId) {
        emailsData = await EmailService.getEventEmails(eventId);
        setSelectedEvent(eventId);
        
        // Load event-specific registrations
        const regsData = await RegistrationService.getEventRegistrations(eventId);
        setRegistrations(regsData);
        
        // Load email stats
        const stats = await EmailService.getEmailStats(eventId);
        setEmailStats(stats);
      } else {
        emailsData = await EmailService.getAllEmails();
        
        // Calculate overall stats
        const stats = {
          total: emailsData.length,
          successful: emailsData.filter(e => e.success).length,
          failed: emailsData.filter(e => !e.success).length,
          byType: {} as Record<string, number>
        };
        emailsData.forEach(email => {
          if (!stats.byType[email.type]) {
            stats.byType[email.type] = 0;
          }
          stats.byType[email.type]++;
        });
        setEmailStats(stats);
      }

      setEmails(emailsData);
    } catch (error) {
      console.error('Error loading email data:', error);
    } finally {
      setLoading(false);
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

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(email => {
        if (selectedStatus === 'success') return email.success;
        if (selectedStatus === 'failed') return !email.success;
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
      console.error('Error resending email:', error);
      alert(`Error resending email: ${error.message}`);
    } finally {
      setResendingEmail(null);
    }
  };

  const handleBulkSend = async () => {
    if (!selectedTemplate || !selectedEvent || selectedEvent === 'all') {
      alert('Please select an event and template');
      return;
    }

    try {
      const event = events.find(e => e.id === selectedEvent);
      if (!event) return;

      const eventRegs = await RegistrationService.getEventRegistrations(selectedEvent);
      const attendees = eventRegs
        .filter(reg => reg.paymentStatus === 'paid' && reg.attendanceStatus !== 'cancelled')
        .map(reg => ({
          email: reg.userDetails.email,
          name: reg.userDetails.name,
          registrationId: reg.id
        }));

      if (attendees.length === 0) {
        alert('No eligible attendees found');
        return;
      }

      const confirmed = confirm(`Send ${selectedTemplate.name} to ${attendees.length} attendees?`);
      if (!confirmed) return;

      const result = await EmailService.sendBulkEmails(
        attendees,
        selectedTemplate,
        {
          eventId: event.id,
          eventTitle: event.title,
          eventDate: event.startDate.toDate().toLocaleDateString(),
          eventLocation: event.venue.type === 'online' ? 'Online' : event.venue.name || 'TBD'
        }
      );

      alert(`Bulk send completed: ${result.success} successful, ${result.failed} failed`);
      setShowBulkSendModal(false);
      loadData();
    } catch (error: any) {
      console.error('Error sending bulk emails:', error);
      alert(`Error: ${error.message}`);
    }
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
      console.error('Error exporting emails:', error);
      alert(`Error exporting: ${error.message}`);
    }
  };

  const getEmailTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      email_confirmation_sent: 'Registration Confirmation',
      payment_notification_sent: 'Payment Notification',
      event_reminder_sent: 'Event Reminder',
      feedback_request_sent: 'Feedback Request',
      certificate_notification_sent: 'Certificate Ready',
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
      certificate_notification_sent: 'bg-indigo-100 text-indigo-800',
      checkin_notification_sent: 'bg-teal-100 text-teal-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
              <button
                onClick={() => setShowBulkSendModal(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Send className="h-4 w-4 mr-2" />
                Bulk Send
              </button>

              <button
                onClick={loadData}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
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
              <option value="feedback_request_sent">Feedback Request</option>
              <option value="certificate_notification_sent">Certificate Ready</option>
              <option value="checkin_notification_sent">Check-in Confirmation</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="success">Successful</option>
              <option value="failed">Failed</option>
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
                    <tr key={email.id} className="hover:bg-gray-50">
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
                        {email.success ? (
                          <span className="inline-flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Sent
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-red-600">
                            <XCircle className="h-4 w-4 mr-1" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleResendEmail(email)}
                          disabled={resendingEmail === email.id}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resendingEmail === email.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
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

        {/* Bulk Send Modal */}
        {showBulkSendModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Send Bulk Emails</h3>
              
              <div className="space-y-4">
                {/* Event Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Event
                  </label>
                  <select
                    value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">Select an event...</option>
                    {events.map(event => (
                      <option key={event.id} value={event.id}>{event.title}</option>
                    ))}
                  </select>
                </div>

                {/* Template Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Email Template
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {EmailService.getEmailTemplates().map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className={`text-left p-4 border-2 rounded-lg transition-colors ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{template.name}</div>
                        <div className="text-sm text-gray-600 mt-1">{template.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info */}
                {selectedEvent !== 'all' && selectedTemplate && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        This will send <strong>{selectedTemplate.name}</strong> to all paid and registered attendees for the selected event.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowBulkSendModal(false);
                    setSelectedTemplate(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSend}
                  disabled={!selectedEvent || selectedEvent === 'all' || !selectedTemplate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send Emails
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminEmailManagementPage;

