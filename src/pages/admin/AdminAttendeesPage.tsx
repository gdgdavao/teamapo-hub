import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  CheckIcon,
  XMarkIcon,
  CalendarDaysIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  UserIcon,
  EyeIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  DocumentTextIcon,
  FunnelIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon, XCircleIcon, ClockIcon, CurrencyDollarIcon } from '@heroicons/react/20/solid';
import AdminLayout from '../../components/AdminLayout';

// Utility function to format dates
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface Registration {
  id: string;
  attendee: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    profilePicture?: string;
    experience?: string;
    interests?: string[];
    bio?: string;
  };
  event: {
    id: string;
    title: string;
    date: string;
    venue: string;
    ticketPrice: number;
  };
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'attended' | 'cancelled';
  registrationDate: string;
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';
  notes?: string;
  requirements?: string[];
  formSubmission?: Record<string, any>;
  priority?: 'low' | 'medium' | 'high';
}

const AdminAttendeesPage: React.FC = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedRegistrations, setSelectedRegistrations] = useState<string[]>([]);
  const [viewingRegistration, setViewingRegistration] = useState<Registration | null>(null);

  // Mock data
  useEffect(() => {
    setTimeout(() => {
      setRegistrations([
        {
          id: '1',
          attendee: {
            id: 'user1',
            name: 'John Doe',
            email: 'john.doe@email.com',
            phone: '+63 912 345 6789',
            organization: 'Tech Solutions Inc.',
            experience: 'Intermediate',
            interests: ['Frontend Development', 'React', 'TypeScript'],
            bio: 'Full-stack developer with 3 years of experience in web development.'
          },
          event: {
            id: 'event1',
            title: 'Web Development Workshop',
            date: '2025-01-25T09:00:00Z',
            venue: 'GDG Davao Hub',
            ticketPrice: 500
          },
          status: 'pending',
          registrationDate: '2025-01-15T14:30:00Z',
          priority: 'high',
          formSubmission: {
            'Why do you want to attend?': 'To improve my React skills and learn TypeScript',
            'Current skill level': 'Intermediate',
            'What do you hope to learn?': 'Advanced React patterns and TypeScript best practices'
          }
        },
        {
          id: '2',
          attendee: {
            id: 'user2',
            name: 'Jane Smith',
            email: 'jane.smith@company.com',
            phone: '+63 918 765 4321',
            organization: 'Digital Innovations',
            experience: 'Advanced',
            interests: ['Backend Development', 'Node.js', 'Databases'],
            bio: 'Senior backend developer with expertise in Node.js and cloud architecture.'
          },
          event: {
            id: 'event2',
            title: 'AI/ML Fundamentals',
            date: '2025-02-10T14:00:00Z',
            venue: 'Online',
            ticketPrice: 0
          },
          status: 'pending',
          registrationDate: '2025-01-16T09:15:00Z',
          priority: 'medium',
          formSubmission: {
            'Previous AI/ML experience': 'None, but interested in learning',
            'Programming languages': 'JavaScript, Python',
            'Expected outcomes': 'Understanding ML concepts and practical applications'
          }
        },
        {
          id: '3',
          attendee: {
            id: 'user3',
            name: 'Mike Johnson',
            email: 'mike.j@startup.ph',
            phone: '+63 920 123 4567',
            organization: 'StartupPH',
            experience: 'Beginner',
            interests: ['Mobile Development', 'Flutter', 'UI/UX'],
            bio: 'Aspiring mobile developer transitioning from design to development.'
          },
          event: {
            id: 'event3',
            title: 'Mobile App Development',
            date: '2025-02-15T10:00:00Z',
            venue: 'Innovation Hub',
            ticketPrice: 750
          },
          status: 'approved',
          registrationDate: '2025-01-17T11:45:00Z',
          paymentStatus: 'pending',
          priority: 'medium'
        },
        {
          id: '4',
          attendee: {
            id: 'user4',
            name: 'Sarah Wilson',
            email: 'sarah.wilson@freelance.com',
            organization: 'Freelancer',
            experience: 'Advanced',
            interests: ['DevOps', 'Cloud Computing', 'Docker'],
            bio: 'DevOps engineer specializing in cloud infrastructure and automation.'
          },
          event: {
            id: 'event1',
            title: 'Web Development Workshop',
            date: '2025-01-25T09:00:00Z',
            venue: 'GDG Davao Hub',
            ticketPrice: 500
          },
          status: 'rejected',
          registrationDate: '2025-01-18T16:45:00Z',
          notes: 'Workshop focus doesn\'t match attendee background',
          priority: 'low'
        },
        {
          id: '5',
          attendee: {
            id: 'user5',
            name: 'David Lee',
            email: 'david.lee@student.edu',
            organization: 'University of Davao',
            experience: 'Beginner',
            interests: ['Full Stack', 'Python', 'Web Development'],
            bio: 'Computer Science student eager to learn industry practices.'
          },
          event: {
            id: 'event4',
            title: 'DevOps Essentials',
            date: '2025-02-20T08:00:00Z',
            venue: 'Innovation Center',
            ticketPrice: 1000
          },
          status: 'paid',
          registrationDate: '2025-01-19T11:30:00Z',
          paymentStatus: 'paid',
          priority: 'high'
        },
        {
          id: '6',
          attendee: {
            id: 'user6',
            name: 'Lisa Chen',
            email: 'lisa.chen@techcorp.com',
            phone: '+63 917 888 9999',
            organization: 'TechCorp Solutions',
            experience: 'Intermediate',
            interests: ['Frontend', 'Vue.js', 'Progressive Web Apps'],
            bio: 'Frontend developer specializing in Vue.js and modern web technologies.'
          },
          event: {
            id: 'event1',
            title: 'Web Development Workshop',
            date: '2025-01-25T09:00:00Z',
            venue: 'GDG Davao Hub',
            ticketPrice: 500
          },
          status: 'pending',
          registrationDate: '2025-01-20T08:20:00Z',
          priority: 'high',
          formSubmission: {
            'Current role': 'Frontend Developer',
            'Years of experience': '2 years',
            'Specific topics of interest': 'React hooks, state management, testing'
          }
        }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleStatusChange = (registrationId: string, newStatus: Registration['status'], notes?: string) => {
    setRegistrations(prev => 
      prev.map(reg => 
        reg.id === registrationId 
          ? { ...reg, status: newStatus, notes: notes || reg.notes }
          : reg
      )
    );

    // Simulate email notification
    const registration = registrations.find(r => r.id === registrationId);
    if (registration) {
      console.log(`Email notification sent to ${registration.attendee.email} - Status: ${newStatus}`);
    }
  };

  const handleBulkAction = (action: 'approve' | 'reject') => {
    if (selectedRegistrations.length === 0) return;

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    setRegistrations(prev => 
      prev.map(reg => 
        selectedRegistrations.includes(reg.id)
          ? { ...reg, status: newStatus as Registration['status'] }
          : reg
      )
    );

    setSelectedRegistrations([]);
  };

  const toggleRegistrationSelection = (registrationId: string) => {
    setSelectedRegistrations(prev => 
      prev.includes(registrationId)
        ? prev.filter(id => id !== registrationId)
        : [...prev, registrationId]
    );
  };

  const selectAllVisible = () => {
    const visibleIds = filteredRegistrations.map(reg => reg.id);
    setSelectedRegistrations(visibleIds);
  };

  const clearSelection = () => {
    setSelectedRegistrations([]);
  };

  const filteredRegistrations = registrations.filter(registration => {
    const matchesSearch = 
      registration.attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.attendee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      registration.attendee.organization?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || registration.status === statusFilter;
    const matchesEvent = eventFilter === 'all' || registration.event.id === eventFilter;
    const matchesPriority = priorityFilter === 'all' || registration.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesEvent && matchesPriority;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-success-500" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-secondary-500" />;
      case 'paid':
        return <CurrencyDollarIcon className="h-5 w-5 text-accent-500" />;
      case 'attended':
        return <CheckCircleIcon className="h-5 w-5 text-purple-500" />;
      case 'cancelled':
        return <XCircleIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-accent-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success-100 text-success-800';
      case 'rejected':
        return 'bg-secondary-100 text-secondary-800';
      case 'paid':
        return 'bg-accent-100 text-accent-800';
      case 'attended':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-accent-100 text-accent-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-secondary-100 text-secondary-800';
      case 'medium':
        return 'bg-accent-100 text-accent-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Attendees" subtitle="Loading attendee registrations...">
        <div className="animate-pulse space-y-6">
          <div className="h-20 bg-gray-200 rounded-xl"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  const headerActions = (
    <div className="flex items-center space-x-3">
      <button className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">
        <CheckIcon className="w-4 h-4 mr-2" />
        Bulk Approve
      </button>
      <button className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
        <FunnelIcon className="w-4 h-4 mr-2" />
        Export Data
      </button>
    </div>
  );

  return (
    <AdminLayout 
      title="Attendee Management" 
      subtitle="Review and approve event registrations efficiently."
      actions={headerActions}
    >
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <ClockIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {registrations.filter(r => r.status === 'pending').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-gray-900">
                  {registrations.filter(r => r.status === 'approved').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <CurrencyDollarIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Paid</p>
                <p className="text-2xl font-bold text-gray-900">
                  {registrations.filter(r => r.status === 'paid').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <UserGroupIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{registrations.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search attendees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pending">Pending Review</option>
                <option value="all">All Status</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
                <option value="attended">Attended</option>
              </select>

              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Events</option>
                <option value="event1">Web Development Workshop</option>
                <option value="event2">AI/ML Fundamentals</option>
                <option value="event3">Flutter Development</option>
                <option value="event4">DevOps Essentials</option>
              </select>
            </div>

            <div className="text-sm text-gray-600">
              {filteredRegistrations.length} registration{filteredRegistrations.length !== 1 ? 's' : ''} found
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedRegistrations.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-blue-900">
                  {selectedRegistrations.length} registration{selectedRegistrations.length !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={clearSelection}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Clear Selection
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleBulkAction('approve')}
                  className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                >
                  <CheckIcon className="w-4 h-4 mr-1" />
                  Approve All
                </button>
                <button
                  onClick={() => handleBulkAction('reject')}
                  className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors"
                >
                  <XMarkIcon className="w-4 h-4 mr-1" />
                  Reject All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex space-x-2">
            <button
              onClick={selectAllVisible}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Select All Visible ({filteredRegistrations.length})
            </button>
          </div>
          
          <div className="text-sm text-gray-500">
            Showing {filteredRegistrations.length} of {registrations.length} registrations
          </div>
        </div>

        {/* Registrations List */}
        <div className="dashboard-card">
          {filteredRegistrations.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No registrations found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || statusFilter !== 'all' || eventFilter !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Attendee registrations will appear here once people start signing up for events.'
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredRegistrations.map((registration) => (
                <div key={registration.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start space-x-4">
                    {/* Selection Checkbox */}
                    <div className="flex items-center pt-1">
                      <input
                        type="checkbox"
                        checked={selectedRegistrations.includes(registration.id)}
                        onChange={() => toggleRegistrationSelection(registration.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {registration.attendee.profilePicture ? (
                        <img
                          src={registration.attendee.profilePicture}
                          alt={registration.attendee.name}
                          className="h-12 w-12 rounded-full"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-gray-600" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {registration.attendee.name}
                        </h3>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(registration.status)}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(registration.status)}`}>
                            {registration.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <EnvelopeIcon className="h-4 w-4" />
                            <span>{registration.attendee.email}</span>
                          </div>
                          {registration.attendee.phone && (
                            <div className="flex items-center space-x-2">
                              <PhoneIcon className="h-4 w-4" />
                              <span>{registration.attendee.phone}</span>
                            </div>
                          )}
                          {registration.attendee.organization && (
                            <div className="flex items-center space-x-2">
                              <BuildingOfficeIcon className="h-4 w-4" />
                              <span>{registration.attendee.organization}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <CalendarDaysIcon className="h-4 w-4" />
                            <span>{registration.event.title}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <DocumentTextIcon className="h-4 w-4" />
                            <span>Registered: {formatDate(registration.registrationDate)}</span>
                          </div>
                          {registration.event.ticketPrice > 0 && (
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-green-600">
                                ₱{registration.event.ticketPrice.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons for Pending */}
                  {registration.status === 'pending' && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleStatusChange(registration.id, 'approved')}
                          className="btn-primary text-sm px-4 py-2"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(registration.id, 'rejected')}
                          className="btn-danger text-sm px-4 py-2"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registration Details Modal */}
        {viewingRegistration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  Registration Details
                </h2>
                <button
                  onClick={() => setViewingRegistration(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              {/* Content */}
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Attendee Info */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Name</span>
                      <div className="text-lg font-semibold text-gray-900">
                        {viewingRegistration.attendee.name}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Email</span>
                      <div className="text-gray-900">
                        {viewingRegistration.attendee.email}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Phone</span>
                      <div className="text-gray-900">
                        {viewingRegistration.attendee.phone || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Organization</span>
                      <div className="text-gray-900">
                        {viewingRegistration.attendee.organization || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Status</span>
                      <div className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(viewingRegistration.status)}`}>
                        {viewingRegistration.status}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Priority</span>
                      <div className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(viewingRegistration.priority || 'low')}`}>
                        {viewingRegistration.priority || 'low'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Event Info */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Event Title</span>
                      <div className="text-lg font-semibold text-gray-900">
                        {viewingRegistration.event.title}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Date & Time</span>
                      <div className="text-gray-900">
                        {formatDate(viewingRegistration.event.date)}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Venue</span>
                      <div className="text-gray-900">
                        {viewingRegistration.event.venue}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Ticket Price</span>
                      <div className="text-gray-900">
                        ₱{viewingRegistration.event.ticketPrice.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Registration Date</span>
                      <div className="text-gray-900">
                        {formatDate(viewingRegistration.registrationDate)}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Notes and Requirements */}
                <div className="mt-4">
                  {viewingRegistration.notes && (
                    <div className="mb-4 p-3 bg-gray-100 rounded-md">
                      <p className="text-sm text-gray-700">
                        <strong>Notes:</strong> {viewingRegistration.notes}
                      </p>
                    </div>
                  )}
                  
                  {viewingRegistration.requirements && viewingRegistration.requirements.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">Requirements:</p>
                      <ul className="text-sm text-gray-600 list-disc list-inside">
                        {viewingRegistration.requirements.map((req, index) => (
                          <li key={index}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Footer */}
              <div className="flex justify-end p-4 border-t">
                <button
                  onClick={() => setViewingRegistration(null)}
                  className="btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAttendeesPage;
