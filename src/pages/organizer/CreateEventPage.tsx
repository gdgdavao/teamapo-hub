import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { functions } from '../../config/firebase';
import EventService from '../../services/eventService';
import {
  CalendarDaysIcon,
  MapPinIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  ChatBubbleLeftRightIcon,
  PlusIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PhotoIcon,
  QrCodeIcon,
  BanknotesIcon,
  CheckCircleIcon,
  XCircleIcon,
  TicketIcon,
  TagIcon,
  ArrowLeftIcon,
  HomeIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { FormBuilder, FormField } from '../../components/FormBuilder';
import { TicketType, PromoCode } from '../../types';
import PromoCodeManager from '../../components/PromoCodeManager';

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
  paymentFields?: FormField[]; // Additional form fields for payment verification
}

interface EventFormData {
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

const CreateEventPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile, loading: authLoading } = useAuth();

  // Check if we're in admin or organizer context
  // Since we're using unified routes, we need to determine context from user role
  const isAdminContext = userProfile?.role === 'admin';
  const isEditMode = location.pathname.includes('/edit/');

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);

  const [formData, setFormData] = useState<EventFormData>({
    title: '',
    description: '',
    shortDescription: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timezone: 'Asia/Manila',
    venueType: 'offline',
    city: 'Davao City',

    // New ticket system
    ticketTypes: [],
    promoCodes: [],

    // Legacy pricing (for backward compatibility)
    isPaid: false,
    ticketPrice: 0,
    currency: 'PHP',
    registrationForm: [
      { id: '1', type: 'text', label: 'Full Name', required: true, gridSize: 'full' },
      { id: '2', type: 'email', label: 'Email Address', required: true, gridSize: 'half' },
      { id: '3', type: 'phone', label: 'Phone Number', required: true, gridSize: 'half' }
    ],
    feedbackForm: [
      { id: '1', type: 'rating', label: 'Overall Event Rating', required: true, gridSize: 'full' },
      { id: '2', type: 'textarea', label: 'What did you like most?', required: false, gridSize: 'full' },
      { id: '3', type: 'textarea', label: 'Areas for improvement', required: false, gridSize: 'full' }
    ],
    category: 'workshop',
    tags: [],
    requirements: []
  });

  const [activeFormType, setActiveFormType] = useState<'registration' | 'feedback'>('registration');

  // Load event data if editing
  useEffect(() => {
    if (isEditMode) {
      const eventIdFromUrl = location.pathname.split('/').pop();
      if (eventIdFromUrl) {
        loadEventData(eventIdFromUrl);
      }
    }
  }, [isEditMode, location.pathname]);

  // Helper function to safely convert Firestore timestamps to Date objects
  const convertTimestampToDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    
    if (timestamp?.toDate && typeof timestamp.toDate === 'function') {
      // Firestore Timestamp object
      return timestamp.toDate();
    } else if (timestamp?.seconds && typeof timestamp.seconds === 'number') {
      // Firestore timestamp as plain object (from Firestore emulator or client)
      return new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      // Regular Date object
      return timestamp;
    } else if (typeof timestamp === 'string') {
      // Date string
      return new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      // Unix timestamp
      return new Date(timestamp);
    } else {
      // Try to create a Date object
      return new Date(timestamp);
    }
  };

  const loadEventData = async (eventId: string) => {
    try {
      setLoading(true);
      const event = await EventService.getEvent(eventId);
      if (event) {
        setEventId(eventId);
        
        // Safely convert dates
        const startDate = convertTimestampToDate(event.startDate);
        const endDate = convertTimestampToDate(event.endDate);
        const registrationDeadline = event.registrationDeadline ? convertTimestampToDate(event.registrationDeadline) : null;
        
        // Load forms separately
        const [registrationForm, feedbackForm] = await Promise.all([
          EventService.getEventRegistrationForm(eventId),
          EventService.getEventFeedbackForm(eventId)
        ]);
        
        // Convert Event to EventFormData
        const eventFormData: EventFormData = {
          title: event.title,
          description: event.description,
          shortDescription: event.shortDescription,
          imageUrl: event.imageUrl || undefined, // Ensure it's either string or undefined, not null
          startDate: startDate.toISOString().split('T')[0],
          startTime: startDate.toTimeString().slice(0, 5),
          endDate: endDate.toISOString().split('T')[0],
          endTime: endDate.toTimeString().slice(0, 5),
          timezone: event.timezone,
          venueType: event.venue.type,
          venueName: event.venue.name,
          venueAddress: event.venue.address,
          city: event.venue.city,
          ticketTypes: event.ticketTypes,
          promoCodes: event.promoCodes || [],
          isPaid: event.ticketTypes.some(ticket => ticket.price > 0),
          ticketPrice: event.ticketTypes[0]?.price || 0,
          currency: event.ticketTypes[0]?.currency || 'PHP',
          maxAttendees: event.maxAttendees,
          registrationForm: registrationForm,
          feedbackForm: feedbackForm,
          category: event.category,
          tags: event.tags,
          requirements: event.requirements || [],
          registrationDeadline: registrationDeadline?.toISOString().split('T')[0]
        };
        setFormData(eventFormData);
      }
    } catch (error) {
      console.error('Error loading event data:', error);
      toast.error('Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async (publish: boolean = false) => {
    // Wait for auth to be fully initialized
    if (authLoading) {
      toast.error('Please wait for authentication to complete');
      return;
    }
    
    if (!currentUser) {
      toast.error('You must be logged in to create an event');
      return;
    }

    try {
      setLoading(true);

      // Client-side validation first
      if (!formData.title || !formData.description || !formData.startDate || !formData.startTime) {
        toast.error('Please fill in all required fields');
        setLoading(false);
        return;
      }

      // Ensure auth token is fresh before making function calls
      try {
        await currentUser.getIdToken(true); // Force token refresh
      } catch (authError) {
        console.error('Auth token refresh failed:', authError);
        toast.error('Authentication expired. Please sign in again.');
        setLoading(false);
        return;
      }

      // TODO: Re-enable Firebase function validation once CORS is resolved
      // For now, skip server-side validation to test core functionality
      console.log('Skipping server-side validation temporarily');
      
      // Basic client-side validation (keeping it simple for now)
      if (!formData.title.trim()) {
        toast.error('Event title is required');
        setLoading(false);
        return;
      }
      
      if (!formData.description.trim()) {
        toast.error('Event description is required');
        setLoading(false);
        return;
      }

      // Validate dates
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      
      if (startDateTime < new Date()) {
        toast.error('Event start date must be in the future');
        setLoading(false);
        return;
      }
      
      if (endDateTime <= startDateTime) {
        toast.error('Event end date must be after start date');
        setLoading(false);
        return;
      }

      let savedEventId: string;

      if (isEditMode && eventId) {
        // Update existing event
        await EventService.updateEvent(eventId, formData);
        savedEventId = eventId;
        toast.success(publish ? 'Event updated and published successfully!' : 'Event updated successfully!');
      } else {
        // Create new event
        savedEventId = await EventService.createEvent(formData, currentUser.uid);
        setEventId(savedEventId);
        toast.success(publish ? 'Event created and published successfully!' : 'Event created successfully!');
      }

      // Upload event image if provided
      if (formData.imageUrl && formData.imageUrl.startsWith('data:')) {
        try {
          // Convert data URL to blob and then to file
          const response = await fetch(formData.imageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'event-image.jpg', { type: 'image/jpeg' });
          await EventService.uploadEventImage(savedEventId, file);
          toast.success('Event image uploaded successfully!');
        } catch (error) {
          console.error('Error uploading event image:', error);
          toast.error('Failed to upload event image, but event was saved');
        }
      }

      // Upload payment QR code if provided
      if (formData.paymentConfig?.qrCodeImage) {
        try {
          const qrCodeUrl = await EventService.uploadPaymentQR(savedEventId, formData.paymentConfig.qrCodeImage);
          // Update payment config with QR code URL
          await EventService.updateEvent(savedEventId, {
            paymentConfig: {
              ...formData.paymentConfig,
              qrCodeUrl
            }
          });
          toast.success('Payment QR code uploaded successfully!');
        } catch (error) {
          console.error('Error uploading payment QR code:', error);
          toast.error('Failed to upload payment QR code, but event was saved');
        }
      }

      // Publish event if requested
      if (publish) {
        try {
          await EventService.publishEvent(savedEventId);
          // Don't show separate publish message since we already show it in the create/update message
        } catch (error) {
          console.error('Error publishing event:', error);
          toast.error('Failed to publish event, but event was saved');
        }
      }

      // TODO: Re-enable statistics call once function issues are resolved
      if (isEditMode) {
        console.log('Skipping statistics call temporarily due to function issues');
      }

      // Navigate to the appropriate page based on context and publish status
      // Add a small delay to ensure the user sees the success message
      setTimeout(() => {
        // Both admin and organizer now use the same unified routes
        navigate('/events');
      }, 1500); // 1.5 second delay to show success message

    } catch (error) {
      console.error('Error saving event:', error);
      if (error instanceof Error) {
        toast.error(`Failed to save event: ${error.message}`);
      } else {
        toast.error('Failed to save event. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateEvent = async () => {
    // Wait for auth to be fully initialized
    if (authLoading) {
      toast.error('Please wait for authentication to complete');
      return;
    }
    
    if (!currentUser || !eventId) {
      toast.error('Unable to duplicate event');
      return;
    }

    try {
      setLoading(true);
      
      // Ensure auth token is fresh
      try {
        await currentUser.getIdToken(true);
      } catch (authError) {
        console.error('Auth token refresh failed:', authError);
        toast.error('Authentication expired. Please sign in again.');
        setLoading(false);
        return;
      }
      
      // TODO: Re-enable duplicate function once function issues are resolved
      toast.error('Event duplication temporarily disabled due to function issues. Please copy the event manually.');
      console.log('Skipping duplicate function call temporarily');
    } catch (error: any) {
      console.error('Error duplicating event:', error);
      if (error.code === 'unauthenticated' || error.message?.includes('unauthenticated')) {
        toast.error('Authentication error. Please sign out and sign in again.');
      } else {
      toast.error('Failed to duplicate event');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          imageUrl: e.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper function to create default payment verification fields
  const createDefaultPaymentFields = (): FormField[] => [
    {
      id: 'payment_proof',
      type: 'file',
      label: 'Payment Proof Screenshot',
      required: true,
      gridSize: 'full',
      description: 'Upload a screenshot of your payment transaction'
    },
    {
      id: 'transaction_id',
      type: 'text',
      label: 'Transaction ID / Reference Number',
      required: false,
      gridSize: 'full',
      placeholder: 'Enter transaction reference number (optional)',
      description: 'Provide the transaction ID if available for faster verification'
    }
  ];

  const steps = [
    { id: 0, title: 'Basic Information', icon: DocumentTextIcon },
    { id: 1, title: 'Date & Venue', icon: CalendarDaysIcon },
    { id: 2, title: 'Tickets & Pricing', icon: TicketIcon },
    { id: 3, title: 'Promo Codes', icon: TagIcon },
    { id: 4, title: 'Registration Form', icon: UserGroupIcon },
    { id: 5, title: 'Feedback Form', icon: ChatBubbleLeftRightIcon },
    { id: 6, title: 'Review & Publish', icon: CheckCircleIcon }
  ];

  const handleQRCodeUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          paymentConfig: {
            ...prev.paymentConfig!,
            qrCodeImage: file,
            qrCodeUrl: e.target?.result as string
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderBasicInfoStep();
      case 1:
        return renderDateVenueStep();
      case 2:
        return renderTicketManagementStep();
      case 3:
        return renderPromoCodeStep();
      case 4:
        return renderFormBuilderStep('registration');
      case 5:
        return renderFormBuilderStep('feedback');
      case 6:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const renderBasicInfoStep = () => (
    <div className="space-y-6">

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Event Title</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter event title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Short Description</label>
        <input
          type="text"
          value={formData.shortDescription}
          onChange={(e) => setFormData(prev => ({ ...prev, shortDescription: e.target.value }))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Brief description for event cards"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Full Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Detailed event description"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Event Image</label>
        <div className="flex items-center space-x-4">
          {formData.imageUrl ? (
            <div className="relative">
              <img
                src={formData.imageUrl}
                alt="Event preview"
                className="w-32 h-32 object-cover rounded-lg border border-gray-300"
              />
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, imageUrl: undefined }))}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-32 h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
              <PhotoIcon className="w-8 h-8 text-gray-400" />
              <span className="mt-2 text-sm text-gray-500">Upload Image</span>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </label>
          )}
          <div className="flex-1">
            <p className="text-sm text-gray-600">
              Upload an attractive event image to help draw attendees. 
              Recommended size: 1200x630 pixels (16:9 ratio).
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="workshop">Workshop</option>
            <option value="meetup">Meetup</option>
            <option value="conference">Conference</option>
            <option value="hackathon">Hackathon</option>
            <option value="networking">Networking</option>
            <option value="webinar">Webinar</option>
            <option value="study-jam">Study Jam</option>
            <option value="code-lab">Code Lab</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Max Attendees</label>
          <input
            type="number"
            value={formData.maxAttendees || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, maxAttendees: e.target.value ? parseInt(e.target.value) : undefined }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Leave empty for unlimited"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Event Requirements</label>
        <div className="space-y-2">
          {formData.requirements.map((requirement, index) => (
            <div key={index} className="flex items-center space-x-2">
              <input
                type="text"
                value={requirement}
                onChange={(e) => {
                  const newRequirements = [...formData.requirements];
                  newRequirements[index] = e.target.value;
                  setFormData(prev => ({ ...prev, requirements: newRequirements }));
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter requirement (e.g., Laptop required, Basic Python knowledge)"
              />
              <button
                type="button"
                onClick={() => {
                  const newRequirements = formData.requirements.filter((_, i) => i !== index);
                  setFormData(prev => ({ ...prev, requirements: newRequirements }));
                }}
                className="px-3 py-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, requirements: [...prev.requirements, ''] }))}
            className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors"
          >
            + Add Requirement
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          List any requirements or prerequisites for attendees (e.g., "Laptop required", "Basic Python knowledge")
        </p>
      </div>
    </div>
  );

  const renderDateVenueStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <input
            type="date"
            value={formData.startDate}
            onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
          <input
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
          <input
            type="date"
            value={formData.endDate}
            onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
          <input
            type="time"
            value={formData.endTime}
            onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Venue Type</label>
        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'On-Site' },
            { value: 'hybrid', label: 'Hybrid' }
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, venueType: value as any }))}
              className={`p-4 border-2 rounded-lg text-center ${formData.venueType === value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 hover:border-gray-400'
                }`}
            >
              <div className="font-medium">{label}</div>
            </button>
          ))}
        </div>
      </div>

      {formData.venueType !== 'online' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Venue Name</label>
            <input
              type="text"
              value={formData.venueName || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, venueName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter venue name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter city"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
            <input
              type="text"
              value={formData.venueAddress || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, venueAddress: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter full address"
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderPricingPaymentStep = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-4">Event Pricing</label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, isPaid: false, paymentConfig: undefined }))}
            className={`p-4 border-2 rounded-lg text-center ${!formData.isPaid
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            <div className="font-medium">Free Event</div>
            <div className="text-sm text-gray-500">No payment required</div>
          </button>

          <button
            type="button"
            onClick={() => setFormData(prev => ({
              ...prev,
              isPaid: true,
              paymentConfig: {
                bankDetails: { bankName: '', accountName: '', accountNumber: '' },
                instructions: 'Please follow the payment instructions below and upload your payment proof.',
                requiresProof: true,
                requiresTransactionId: false,
                paymentFields: createDefaultPaymentFields()
              }
            }))}
            className={`p-4 border-2 rounded-lg text-center ${formData.isPaid
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 hover:border-gray-400'
              }`}
          >
            <div className="font-medium">Paid Event</div>
            <div className="text-sm text-gray-500">Requires payment</div>
          </button>
        </div>
      </div>

      {formData.isPaid && (
        <div className="space-y-6 p-6 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ticket Price</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">₱</span>
                <input
                  type="number"
                  value={formData.ticketPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, ticketPrice: parseFloat(e.target.value) || 0 }))}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="PHP">PHP (Philippine Peso)</option>
                <option value="USD">USD (US Dollar)</option>
              </select>
            </div>
          </div>

          {/* Payment Configuration */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <QrCodeIcon className="w-5 h-5 mr-2" />
              Payment Configuration
            </h3>

            {/* QR Code Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment QR Code</label>
              <div className="flex items-center space-x-4">
                <label className="flex-1 flex flex-col items-center justify-center w-32 h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                  {formData.paymentConfig?.qrCodeUrl ? (
                    <img
                      src={formData.paymentConfig.qrCodeUrl}
                      alt="Payment QR Code"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <>
                      <QrCodeIcon className="w-8 h-8 text-gray-400" />
                      <span className="mt-2 text-sm text-gray-500">Upload QR</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleQRCodeUpload}
                  />
                </label>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    Upload your GCash, PayMongo, or bank QR code for payments.
                    This will be shown to attendees during registration.
                  </p>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                <input
                  type="text"
                  value={formData.paymentConfig?.bankDetails.bankName || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    paymentConfig: {
                      ...prev.paymentConfig!,
                      bankDetails: { ...prev.paymentConfig!.bankDetails, bankName: e.target.value }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., BPI, BDO, GCash"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                <input
                  type="text"
                  value={formData.paymentConfig?.bankDetails.accountName || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    paymentConfig: {
                      ...prev.paymentConfig!,
                      bankDetails: { ...prev.paymentConfig!.bankDetails, accountName: e.target.value }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Account holder name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                <input
                  type="text"
                  value={formData.paymentConfig?.bankDetails.accountNumber || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    paymentConfig: {
                      ...prev.paymentConfig!,
                      bankDetails: { ...prev.paymentConfig!.bankDetails, accountNumber: e.target.value }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Account or mobile number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SWIFT Code (Optional)</label>
                <input
                  type="text"
                  value={formData.paymentConfig?.bankDetails.swiftCode || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    paymentConfig: {
                      ...prev.paymentConfig!,
                      bankDetails: { ...prev.paymentConfig!.bankDetails, swiftCode: e.target.value }
                    }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="For international transfers"
                />
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Instructions</label>
              <textarea
                value={formData.paymentConfig?.instructions || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  paymentConfig: {
                    ...prev.paymentConfig!,
                    instructions: e.target.value
                  }
                }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter specific payment instructions for attendees..."
              />
            </div>

            {/* Payment Verification Options */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Payment Verification Settings</h4>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requiresProof"
                  checked={formData.paymentConfig?.requiresProof || false}
                  onChange={(e) => {
                    const requiresProof = e.target.checked;
                    setFormData(prev => ({
                      ...prev,
                      paymentConfig: {
                        ...prev.paymentConfig!,
                        requiresProof,
                        paymentFields: requiresProof ?
                          (prev.paymentConfig?.paymentFields || createDefaultPaymentFields()) :
                          []
                      }
                    }));
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requiresProof" className="ml-2 text-sm text-gray-700">
                  Require payment proof screenshot
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requiresTransactionId"
                  checked={formData.paymentConfig?.requiresTransactionId || false}
                  onChange={(e) => {
                    const requiresTransactionId = e.target.checked;
                    setFormData(prev => {
                      const currentFields = prev.paymentConfig?.paymentFields || [];
                      let updatedFields = [...currentFields];

                      // Update transaction ID field requirement
                      const transactionFieldIndex = updatedFields.findIndex(f => f.id === 'transaction_id');
                      if (transactionFieldIndex >= 0) {
                        updatedFields[transactionFieldIndex] = {
                          ...updatedFields[transactionFieldIndex],
                          required: requiresTransactionId
                        };
                      }

                      return {
                        ...prev,
                        paymentConfig: {
                          ...prev.paymentConfig!,
                          requiresTransactionId,
                          paymentFields: updatedFields
                        }
                      };
                    });
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requiresTransactionId" className="ml-2 text-sm text-gray-700">
                  Require transaction ID/reference number
                </label>
              </div>
            </div>

            {/* Payment Form Fields Configuration */}
            {formData.paymentConfig?.requiresProof && (
              <div className="border-t pt-6">
                <h4 className="font-medium text-gray-900 mb-4">Payment Verification Form</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-4">
                    These fields will be added to the registration form for attendees to submit payment verification.
                  </p>
                  <FormBuilder
                    fields={formData.paymentConfig?.paymentFields || []}
                    onChange={(fields) => setFormData(prev => ({
                      ...prev,
                      paymentConfig: {
                        ...prev.paymentConfig!,
                        paymentFields: fields
                      }
                    }))}
                    title="Payment Verification Fields"
                    description="Customize the payment verification form"
                    showPreview={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderTicketManagementStep = () => {
    const addTicketType = () => {
      const newTicket: TicketType = {
        id: `ticket_${Date.now()}`,
        name: 'General Admission',
        description: '',
        price: 0,
        currency: 'PHP',
        maxQuantity: undefined,
        currentSold: 0,
        isActive: true,
        benefits: [],
        sortOrder: formData.ticketTypes.length,
        isEarlyBird: false
      };
      setFormData(prev => ({
        ...prev,
        ticketTypes: [...prev.ticketTypes, newTicket]
      }));
    };

    const updateTicketType = (index: number, updates: Partial<TicketType>) => {
      setFormData(prev => ({
        ...prev,
        ticketTypes: prev.ticketTypes.map((ticket, i) =>
          i === index ? { ...ticket, ...updates } : ticket
        )
      }));
    };

    const removeTicketType = (index: number) => {
      setFormData(prev => ({
        ...prev,
        ticketTypes: prev.ticketTypes.filter((_, i) => i !== index)
      }));
    };

    const moveTicketType = (index: number, direction: 'up' | 'down') => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= formData.ticketTypes.length) return;

      setFormData(prev => {
        const newTicketTypes = [...prev.ticketTypes];
        [newTicketTypes[index], newTicketTypes[newIndex]] = [newTicketTypes[newIndex], newTicketTypes[index]];

        // Update sort order
        newTicketTypes.forEach((ticket, i) => {
          ticket.sortOrder = i;
        });

        return { ...prev, ticketTypes: newTicketTypes };
      });
    };

    return (
      <div className="space-y-6">
        {/* Step-specific guidance box */}
        <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TicketIcon className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                Design your ticketing strategy
              </h3>
              <div className="mt-1 text-sm text-green-700">
                <p>Create ticket types that match your audience. Free events get more registrations, but paid events often have higher engagement!</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Ticket Types</h3>
            <p className="text-gray-600">Configure different ticket types and pricing for your event</p>
          </div>
          <button
            type="button"
            onClick={addTicketType}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Ticket Type</span>
          </button>
        </div>

        {formData.ticketTypes.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <TicketIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No ticket types yet</h3>
            <p className="text-gray-600 mb-4">Create your first ticket type to get started</p>
            <button
              type="button"
              onClick={addTicketType}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Ticket Type
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {formData.ticketTypes.map((ticket, index) => (
              <div key={ticket.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium text-gray-900">Ticket Type {index + 1}</h4>
                  <div className="flex items-center space-x-2">
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => moveTicketType(index, 'up')}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <ArrowUpIcon className="w-4 h-4" />
                      </button>
                    )}
                    {index < formData.ticketTypes.length - 1 && (
                      <button
                        type="button"
                        onClick={() => moveTicketType(index, 'down')}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <ArrowDownIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeTicketType(index)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      type="text"
                      value={ticket.name}
                      onChange={(e) => updateTicketType(index, { name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="e.g., General Admission, VIP, Student"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₱) *</label>
                    <input
                      type="number"
                      value={ticket.price}
                      onChange={(e) => updateTicketType(index, { price: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={ticket.description || ''}
                      onChange={(e) => updateTicketType(index, { description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={2}
                      placeholder="Brief description of this ticket type"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Quantity</label>
                    <input
                      type="number"
                      value={ticket.maxQuantity || ''}
                      onChange={(e) => updateTicketType(index, {
                        maxQuantity: e.target.value ? parseInt(e.target.value) : undefined
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                      placeholder="Unlimited"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`active_${ticket.id}`}
                      checked={ticket.isActive}
                      onChange={(e) => updateTicketType(index, { isActive: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`active_${ticket.id}`} className="ml-2 text-sm text-gray-700">
                      Active (available for purchase)
                    </label>
                  </div>
                </div>

                {/* Early Bird Settings */}
                <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center mb-3">
                    <input
                      type="checkbox"
                      id={`earlybird_${ticket.id}`}
                      checked={ticket.isEarlyBird}
                      onChange={(e) => updateTicketType(index, {
                        isEarlyBird: e.target.checked,
                        earlyBirdPrice: e.target.checked ? ticket.price * 0.8 : undefined,
                        earlyBirdDeadline: e.target.checked ?
                          { toDate: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } as any : undefined
                      })}
                      className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor={`earlybird_${ticket.id}`} className="ml-2 text-sm font-medium text-orange-800">
                      Enable Early Bird Pricing
                    </label>
                  </div>

                  {ticket.isEarlyBird && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-orange-700 mb-1">Early Bird Price (₱)</label>
                        <input
                          type="number"
                          value={ticket.earlyBirdPrice || 0}
                          onChange={(e) => updateTicketType(index, {
                            earlyBirdPrice: parseFloat(e.target.value) || 0
                          })}
                          className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-orange-700 mb-1">Early Bird Deadline</label>
                        <input
                          type="datetime-local"
                          value={ticket.earlyBirdDeadline ?
                            new Date(ticket.earlyBirdDeadline.toDate()).toISOString().slice(0, 16) :
                            ''
                          }
                          onChange={(e) => updateTicketType(index, {
                            earlyBirdDeadline: e.target.value ?
                              { toDate: () => new Date(e.target.value) } as any : undefined
                          })}
                          className="w-full px-3 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Benefits */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Benefits (one per line)</label>
                  <textarea
                    value={ticket.benefits?.join('\n') || ''}
                    onChange={(e) => updateTicketType(index, {
                      benefits: e.target.value.split('\n').filter(b => b.trim())
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="e.g.,&#10;Access to all sessions&#10;Lunch included&#10;Certificate of attendance"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Payment Configuration Section */}
        {(formData.ticketTypes.some(ticket => ticket.price > 0) || formData.isPaid) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <QrCodeIcon className="w-5 h-5 mr-2" />
              Payment Configuration
            </h3>

            {/* QR Code Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment QR Code</label>
              <div className="flex items-center space-x-4">
                <label className="flex-1 flex flex-col items-center justify-center w-32 h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
                  {formData.paymentConfig?.qrCodeUrl ? (
                    <img
                      src={formData.paymentConfig.qrCodeUrl}
                      alt="Payment QR Code"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <>
                      <QrCodeIcon className="w-8 h-8 text-gray-400" />
                      <span className="mt-2 text-sm text-gray-500">Upload QR</span>
                    </>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleQRCodeUpload}
                  />
                </label>
                <div className="flex-1">
                  <p className="text-sm text-gray-600">
                    Upload your GCash, PayMongo, or bank QR code for payments.
                    This will be shown to attendees during registration.
                  </p>
                </div>
              </div>
            </div>

            {/* Bank Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                <input
                  type="text"
                  value={formData.paymentConfig?.bankDetails.bankName || ''}
                  onChange={(e) => {
                    if (!formData.paymentConfig) {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          bankDetails: { bankName: e.target.value, accountName: '', accountNumber: '' },
                          instructions: 'Please follow the payment instructions below and upload your payment proof.',
                          requiresProof: true,
                          requiresTransactionId: false,
                          paymentFields: createDefaultPaymentFields()
                        }
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          ...prev.paymentConfig!,
                          bankDetails: { ...prev.paymentConfig!.bankDetails, bankName: e.target.value }
                        }
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., BPI, BDO, GCash"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                <input
                  type="text"
                  value={formData.paymentConfig?.bankDetails.accountName || ''}
                  onChange={(e) => {
                    if (!formData.paymentConfig) {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          bankDetails: { bankName: '', accountName: e.target.value, accountNumber: '' },
                          instructions: 'Please follow the payment instructions below and upload your payment proof.',
                          requiresProof: true,
                          requiresTransactionId: false,
                          paymentFields: createDefaultPaymentFields()
                        }
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          ...prev.paymentConfig!,
                          bankDetails: { ...prev.paymentConfig!.bankDetails, accountName: e.target.value }
                        }
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Account holder name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                <input
                  type="text"
                  value={formData.paymentConfig?.bankDetails.accountNumber || ''}
                  onChange={(e) => {
                    if (!formData.paymentConfig) {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          bankDetails: { bankName: '', accountName: '', accountNumber: e.target.value },
                          instructions: 'Please follow the payment instructions below and upload your payment proof.',
                          requiresProof: true,
                          requiresTransactionId: false,
                          paymentFields: createDefaultPaymentFields()
                        }
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          ...prev.paymentConfig!,
                          bankDetails: { ...prev.paymentConfig!.bankDetails, accountNumber: e.target.value }
                        }
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Account or mobile number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">SWIFT Code (Optional)</label>
                <input
                  type="text"
                  value={formData.paymentConfig?.bankDetails.swiftCode || ''}
                  onChange={(e) => {
                    if (!formData.paymentConfig) {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          bankDetails: { bankName: '', accountName: '', accountNumber: '', swiftCode: e.target.value },
                          instructions: 'Please follow the payment instructions below and upload your payment proof.',
                          requiresProof: true,
                          requiresTransactionId: false,
                          paymentFields: createDefaultPaymentFields()
                        }
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          ...prev.paymentConfig!,
                          bankDetails: { ...prev.paymentConfig!.bankDetails, swiftCode: e.target.value }
                        }
                      }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="For international transfers"
                />
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Payment Instructions</label>
              <textarea
                value={formData.paymentConfig?.instructions || ''}
                onChange={(e) => {
                  if (!formData.paymentConfig) {
                    setFormData(prev => ({
                      ...prev,
                      paymentConfig: {
                        bankDetails: { bankName: '', accountName: '', accountNumber: '' },
                        instructions: e.target.value,
                        requiresProof: true,
                        requiresTransactionId: false,
                        paymentFields: createDefaultPaymentFields()
                      }
                    }));
                  } else {
                    setFormData(prev => ({
                      ...prev,
                      paymentConfig: {
                        ...prev.paymentConfig!,
                        instructions: e.target.value
                      }
                    }));
                  }
                }}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter specific payment instructions for attendees..."
              />
            </div>

            {/* Payment Verification Options */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Payment Verification Settings</h4>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requiresProof"
                  checked={formData.paymentConfig?.requiresProof || false}
                  onChange={(e) => {
                    const requiresProof = e.target.checked;
                    if (!formData.paymentConfig) {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          bankDetails: { bankName: '', accountName: '', accountNumber: '' },
                          instructions: 'Please follow the payment instructions below and upload your payment proof.',
                          requiresProof,
                          requiresTransactionId: false,
                          paymentFields: requiresProof ? createDefaultPaymentFields() : []
                        }
                      }));
                    } else {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          ...prev.paymentConfig!,
                          requiresProof,
                          paymentFields: requiresProof ?
                            (prev.paymentConfig?.paymentFields || createDefaultPaymentFields()) :
                            []
                        }
                      }));
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requiresProof" className="ml-2 text-sm text-gray-700">
                  Require payment proof screenshot
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requiresTransactionId"
                  checked={formData.paymentConfig?.requiresTransactionId || false}
                  onChange={(e) => {
                    const requiresTransactionId = e.target.checked;
                    if (!formData.paymentConfig) {
                      setFormData(prev => ({
                        ...prev,
                        paymentConfig: {
                          bankDetails: { bankName: '', accountName: '', accountNumber: '' },
                          instructions: 'Please follow the payment instructions below and upload your payment proof.',
                          requiresProof: true,
                          requiresTransactionId,
                          paymentFields: createDefaultPaymentFields().map(field =>
                            field.id === 'transaction_id' ? { ...field, required: requiresTransactionId } : field
                          )
                        }
                      }));
                    } else {
                      setFormData(prev => {
                        const currentFields = prev.paymentConfig?.paymentFields || [];
                        let updatedFields = [...currentFields];

                        // Update transaction ID field requirement
                        const transactionFieldIndex = updatedFields.findIndex(f => f.id === 'transaction_id');
                        if (transactionFieldIndex >= 0) {
                          updatedFields[transactionFieldIndex] = {
                            ...updatedFields[transactionFieldIndex],
                            required: requiresTransactionId
                          };
                        }

                        return {
                          ...prev,
                          paymentConfig: {
                            ...prev.paymentConfig!,
                            requiresTransactionId,
                            paymentFields: updatedFields
                          }
                        };
                      });
                    }
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requiresTransactionId" className="ml-2 text-sm text-gray-700">
                  Require transaction ID/reference number
                </label>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Payment Configuration:</strong> This setup will be used for all paid ticket types. Attendees will see the QR code and bank details during checkout, and can upload payment proof for verification.
              </p>
            </div>
          </div>
        )}

        {/* Migration from Legacy Pricing */}
        {formData.isPaid && formData.ticketTypes.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Migrate from Simple Pricing</h4>
            <p className="text-blue-700 text-sm mb-3">
              You have a simple paid event setup. Convert it to a ticket type to use advanced features.
            </p>
            <button
              type="button"
              onClick={() => {
                const legacyTicket: TicketType = {
                  id: `ticket_${Date.now()}`,
                  name: 'General Admission',
                  description: 'Standard event ticket',
                  price: formData.ticketPrice,
                  currency: formData.currency,
                  maxQuantity: formData.maxAttendees,
                  currentSold: 0,
                  isActive: true,
                  benefits: [],
                  sortOrder: 0,
                  isEarlyBird: false
                };
                setFormData(prev => ({
                  ...prev,
                  ticketTypes: [legacyTicket],
                  isPaid: false // Disable legacy mode
                }));
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Convert to Ticket Type
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderPromoCodeStep = () => {
    const handleCreatePromoCode = (promoCodeData: Omit<PromoCode, 'id' | 'currentUses' | 'createdAt' | 'updatedAt'>) => {
      const newPromoCode: PromoCode = {
        ...promoCodeData,
        id: `promo_${Date.now()}`,
        currentUses: 0,
        createdAt: { toDate: () => new Date() } as any,
        updatedAt: { toDate: () => new Date() } as any
      };

      setFormData(prev => ({
        ...prev,
        promoCodes: [...prev.promoCodes, newPromoCode]
      }));
    };

    const handleUpdatePromoCode = (id: string, updates: Partial<PromoCode>) => {
      setFormData(prev => ({
        ...prev,
        promoCodes: prev.promoCodes.map(promo =>
          promo.id === id ? { ...promo, ...updates, updatedAt: { toDate: () => new Date() } as any } : promo
        )
      }));
    };

    const handleDeletePromoCode = (id: string) => {
      setFormData(prev => ({
        ...prev,
        promoCodes: prev.promoCodes.filter(promo => promo.id !== id)
      }));
    };

    return (
      <div className="space-y-6">
        {/* Step-specific guidance box */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TagIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                This step is completely optional
              </h3>
              <div className="mt-1 text-sm text-yellow-700">
                <p>Promo codes can boost registrations but aren't required. You can always add them later from your event dashboard.</p>
              </div>
            </div>
          </div>
        </div>

        <PromoCodeManager
          eventId="new-event" // This will be replaced with actual event ID after creation
          promoCodes={formData.promoCodes}
          ticketTypes={formData.ticketTypes}
          onCreatePromoCode={handleCreatePromoCode}
          onUpdatePromoCode={handleUpdatePromoCode}
          onDeletePromoCode={handleDeletePromoCode}
        />

        {formData.ticketTypes.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              💡 <strong>Tip:</strong> Create ticket types first before adding promo codes.
              Promo codes can be configured to apply to specific ticket types.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderFormBuilderStep = (formType: 'registration' | 'feedback') => {
    const fields = formType === 'registration' ? formData.registrationForm : formData.feedbackForm;
    const title = formType === 'registration' ? 'Registration Form Builder' : 'Feedback Form Builder';
    const description = `Design the ${formType} form that attendees will fill out`;

    const handleFormChange = (newFields: FormField[]) => {
      setFormData(prev => ({
        ...prev,
        [formType === 'registration' ? 'registrationForm' : 'feedbackForm']: newFields
      }));
    };

    return (
      <div className="space-y-6">
        {/* Step-specific guidance box */}
        <div className={`${formType === 'registration' ? 'bg-purple-50 border-l-4 border-purple-400' : 'bg-orange-50 border-l-4 border-orange-400'} p-4 rounded-r-lg`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {formType === 'registration' ? (
                <UserGroupIcon className="h-5 w-5 text-purple-400" />
              ) : (
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-orange-400" />
              )}
            </div>
            <div className="ml-3">
              <h3 className={`text-sm font-medium ${formType === 'registration' ? 'text-purple-800' : 'text-orange-800'}`}>
                {formType === 'registration' ? 'Default form is ready to use!' : 'Feedback form is set up with essentials!'}
              </h3>
              <div className={`mt-1 text-sm ${formType === 'registration' ? 'text-purple-700' : 'text-orange-700'}`}>
                <p>
                  {formType === 'registration'
                    ? 'We\'ve included name, email, and phone. You can customize or add more fields as needed.'
                    : 'Basic feedback fields are included. Feel free to customize for your specific event needs.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        <FormBuilder
          fields={fields}
          onChange={handleFormChange}
          title={title}
          description={description}
          showPreview={true}
        />

        {/* Additional guidance for form creation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">
            💡 {formType === 'registration' ? 'Registration' : 'Feedback'} Form Tips
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {formType === 'registration' ? (
              <>
                <li>• Keep required fields minimal to increase registration rates</li>
                <li>• Consider adding fields specific to your event (e.g., dietary restrictions, t-shirt size)</li>
                <li>• Use conditional fields to gather relevant information without overwhelming users</li>
                {formData.isPaid && <li>• Payment verification fields will be automatically added during registration</li>}
              </>
            ) : (
              <>
                <li>• Include both rating and open-ended questions for comprehensive feedback</li>
                <li>• Ask about specific aspects like content, speakers, venue, and organization</li>
                <li>• Keep the form concise - attendees are more likely to complete shorter forms</li>
                <li>• Consider adding fields for suggestions and future event topics</li>
              </>
            )}
          </ul>
        </div>

        {/* Workflow Preview for Paid Events */}
        {formType === 'registration' && formData.isPaid && formData.paymentConfig && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-3">
              🔄 Registration Workflow for Paid Events
            </h4>
            <div className="space-y-3 text-sm text-green-800">
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
                <span>Attendee fills out registration form</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
                <span>Payment instructions and QR code are displayed</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">3</span>
                <span>Attendee makes payment and uploads proof</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">4</span>
                <span>Organizer verifies payment and confirms registration</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white rounded-full flex items-center justify-center text-xs">5</span>
                <span>Attendee receives confirmation and event details</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderReviewStep = () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Your Event</h3>
        <p className="text-gray-600">Please review all information before publishing your event.</p>
      </div>

      {/* Event Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Event Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-700">Title:</span>
            <span className="ml-2 text-gray-900">{formData.title}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Category:</span>
            <span className="ml-2 text-gray-900 capitalize">{formData.category}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Date:</span>
            <span className="ml-2 text-gray-900">{formData.startDate} at {formData.startTime}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Venue:</span>
            <span className="ml-2 text-gray-900 capitalize">{formData.venueType}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Ticket Types:</span>
            <span className="ml-2 text-gray-900">
              {formData.ticketTypes.length > 0 ?
                `${formData.ticketTypes.length} type${formData.ticketTypes.length > 1 ? 's' : ''}` :
                (formData.isPaid ? `₱${formData.ticketPrice}` : 'Free Event')
              }
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Promo Codes:</span>
            <span className="ml-2 text-gray-900">{formData.promoCodes.length} active</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Requirements:</span>
            <span className="ml-2 text-gray-900">
              {formData.requirements.length > 0 ? 
                `${formData.requirements.length} requirement${formData.requirements.length > 1 ? 's' : ''}` : 
                'None specified'
              }
            </span>
          </div>
        </div>
      </div>

      {/* Ticket Types Summary */}
      {formData.ticketTypes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Ticket Types</h4>
          <div className="space-y-4">
            {formData.ticketTypes.map((ticket, index) => (
              <div key={ticket.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-900">{ticket.name}</h5>
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="font-medium text-gray-900">₱{ticket.price.toLocaleString()}</span>
                    {ticket.isEarlyBird && ticket.earlyBirdPrice && (
                      <span className="text-orange-600 font-medium">
                        Early Bird: ₱{ticket.earlyBirdPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                {ticket.description && (
                  <p className="text-gray-600 text-sm mb-2">{ticket.description}</p>
                )}
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  <span>Max: {ticket.maxQuantity || 'Unlimited'}</span>
                  <span>{ticket.isActive ? 'Active' : 'Inactive'}</span>
                  {ticket.benefits && ticket.benefits.length > 0 && (
                    <span>{ticket.benefits.length} benefit{ticket.benefits.length > 1 ? 's' : ''}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requirements Summary */}
      {formData.requirements.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Event Requirements</h4>
          <div className="space-y-2">
            {formData.requirements.map((requirement, index) => (
              <div key={index} className="flex items-center text-sm">
                <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-600 text-xs flex items-center justify-center mr-2">
                  {index + 1}
                </span>
                <span className="text-gray-900">{requirement}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promo Codes Summary */}
      {formData.promoCodes.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Promo Codes</h4>
          <div className="space-y-3">
            {formData.promoCodes.map((promo) => (
              <div key={promo.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-medium text-blue-600">{promo.code}</span>
                    <span className="ml-2 text-gray-900">{promo.name}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {promo.discountType === 'percentage'
                      ? `${promo.discountValue}% off`
                      : `₱${promo.discountValue} off`
                    }
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                  <span>Valid: {promo.validFrom.toDate().toLocaleDateString()} - {promo.validUntil.toDate().toLocaleDateString()}</span>
                  <span>Max uses: {promo.maxUses || 'Unlimited'}</span>
                  <span>{promo.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forms Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Registration Form</h4>
          <div className="space-y-2">
            {formData.registrationForm.map((field, index) => (
              <div key={field.id} className="flex items-center text-sm">
                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center mr-2">
                  {index + 1}
                </span>
                <span className="text-gray-900">{field.label}</span>
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Feedback Form</h4>
          <div className="space-y-2">
            {formData.feedbackForm.map((field, index) => (
              <div key={field.id} className="flex items-center text-sm">
                <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 text-xs flex items-center justify-center mr-2">
                  {index + 1}
                </span>
                <span className="text-gray-900">{field.label}</span>
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Configuration Summary */}
      {formData.isPaid && formData.paymentConfig && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Payment Configuration</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Bank Details</h5>
              <div className="space-y-1 text-sm text-gray-600">
                <div>Bank: {formData.paymentConfig.bankDetails.bankName}</div>
                <div>Account: {formData.paymentConfig.bankDetails.accountName}</div>
                <div>Number: {formData.paymentConfig.bankDetails.accountNumber}</div>
              </div>
            </div>
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Verification Settings</h5>
              <div className="space-y-1 text-sm text-gray-600">
                <div>Screenshot Required: {formData.paymentConfig.requiresProof ? 'Yes' : 'No'}</div>
                <div>Transaction ID: {formData.paymentConfig.requiresTransactionId ? 'Required' : 'Optional'}</div>
                <div>Additional Fields: {formData.paymentConfig.paymentFields?.length || 0}</div>
              </div>
            </div>
          </div>

          {/* Payment Form Fields Summary */}
          {formData.paymentConfig.paymentFields && formData.paymentConfig.paymentFields.length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium text-gray-700 mb-2">Payment Verification Fields</h5>
              <div className="space-y-1">
                {formData.paymentConfig.paymentFields.map((field, index) => (
                  <div key={field.id} className="flex items-center text-sm text-gray-600">
                    <span className="w-4 h-4 rounded-full bg-orange-100 text-orange-600 text-xs flex items-center justify-center mr-2">
                      {index + 1}
                    </span>
                    <span>{field.label}</span>
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {formData.paymentConfig.qrCodeUrl && (
            <div className="mt-4">
              <h5 className="font-medium text-gray-700 mb-2">QR Code</h5>
              <img
                src={formData.paymentConfig.qrCodeUrl}
                alt="Payment QR Code"
                className="w-32 h-32 object-cover border border-gray-200 rounded"
              />
            </div>
          )}
        </div>
      )}

      {/* Publish Actions */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">Ready to Publish?</h4>
            <p className="text-gray-600 mt-1">
              Your event will be published and visible to attendees immediately.
            </p>
            {formData.isPaid && (
              <p className="text-sm text-blue-600 mt-2 font-medium">
                📋 Registration will require payment verification before confirmation
              </p>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => handleSaveEvent(false)}
              disabled={loading || authLoading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {authLoading ? 'Authenticating...' : loading ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="button"
              onClick={() => handleSaveEvent(true)}
              disabled={loading || authLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {authLoading ? 'Authenticating...' : loading ? 'Publishing...' : 'Publish Event'}
            </button>
          </div>
        </div>

        {/* Final Workflow Summary */}
        {formData.isPaid && (
          <div className="mt-4 pt-4 border-t border-blue-200">
            <h5 className="font-medium text-gray-900 mb-2">Event Registration Flow</h5>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">1</span>
                <span>Attendee Registration ({formData.registrationForm.length} fields)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs">2</span>
                <span>Payment & Verification ({formData.paymentConfig?.paymentFields?.length || 0} fields)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-xs">3</span>
                <span>Post-Event Feedback ({formData.feedbackForm.length} fields)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Main component render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/events')}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="w-5 h-5 mr-2" />
                Back to Events
              </button>
              <div className="h-6 border-l border-gray-300" />
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <HomeIcon className="w-4 h-4" />
                <span>{isAdminContext ? 'Admin' : 'Organizer'}</span>
                <ChevronRightIcon className="w-4 h-4" />
                <span>Events</span>
                <ChevronRightIcon className="w-4 h-4" />
                <span className="text-gray-900 font-medium">
                  {isEditMode ? 'Edit Event' : 'Create Event'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isEditMode && (
                <button
                  onClick={handleDuplicateEvent}
                  disabled={loading || authLoading}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {authLoading ? 'Authenticating...' : loading ? 'Duplicating...' : 'Duplicate Event'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Sidebar - Step Navigation */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {isEditMode ? 'Edit Event' : 'Create Event'}
              </h3>
              <nav className="space-y-2">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = index < currentStep;
                  const isCurrent = index === currentStep;
                  
                  return (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(index)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        isCurrent
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : isCompleted
                          ? 'text-green-700 hover:bg-green-50'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        isCurrent
                          ? 'bg-blue-600 text-white'
                          : isCompleted
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                      }`}>
                        {isCompleted ? (
                          <CheckCircleIcon className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${
                          isCurrent ? 'text-blue-900' : isCompleted ? 'text-green-900' : 'text-gray-900'
                        }`}>
                          {step.title}
                        </div>
                      </div>
                      <Icon className={`w-4 h-4 ${
                        isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                      }`} />
                    </button>
                  );
                })}
              </nav>

              {/* Progress */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{currentStep + 1} of {steps.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9 mt-8 lg:mt-0">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {steps[currentStep].title}
                    </h2>
                    <p className="text-gray-600 mt-1">
                      Step {currentStep + 1} of {steps.length}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                      disabled={currentStep === 0}
                      className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                      disabled={currentStep === steps.length - 1}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6">
                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2 text-gray-600">Loading event data...</span>
                  </div>
                )}
                
                {!loading && renderStepContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateEventPage;

