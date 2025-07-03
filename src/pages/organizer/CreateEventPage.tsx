import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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

  // Check if we're in admin or organizer context
  const isAdminContext = location.pathname.includes('/admin') || location.pathname.includes('/events/create');
  const isEditMode = location.pathname.includes('/edit/');

  const [currentStep, setCurrentStep] = useState(0);

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
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Save as Draft
            </button>
            <button
              type="button"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Publish Event
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

  // Function to provide step-specific guidance
  const getCurrentStepGuidance = () => {
    const hasPaidTickets = formData.ticketTypes.some(t => t.price > 0);
    const hasQRCode = formData.paymentConfig?.qrCodeUrl;
    const completedFields = [formData.title, formData.description, formData.category].filter(Boolean).length;

    const guidance = {
      0: {
        title: "Start with Event Basics",
        description: "Create a compelling event profile that attracts the right attendees.",
        tips: [
          "Write clear, benefit-focused title",
          "Include compelling description",
          "Choose relevant category",
          completedFields < 3 ? "Fill all required fields" : "✓ Looking good!"
        ]
      },
      1: {
        title: "Schedule & Location Setup",
        description: "Set the perfect time and place for maximum attendance.",
        tips: [
          "Consider your audience's timezone",
          formData.venueType === 'online' ? "Add meeting link later" : "Include full address",
          "Avoid major holidays/conflicts",
          "Set realistic duration"
        ]
      },
      2: {
        title: "Ticketing & Payment Configuration",
        description: hasPaidTickets ? "Configure payment processing for your paid event." : "Set up your ticketing system.",
        tips: [
          hasPaidTickets ? "Upload GCash/payment QR code" : "Free events boost attendance",
          hasPaidTickets && !hasQRCode ? "⚠️ Missing payment QR code" : hasPaidTickets ? "✓ Payment ready" : "Consider early-bird strategy",
          "Set appropriate capacity",
          "Multiple ticket types = more options"
        ]
      },
      3: {
        title: "Promotional Codes (Optional)",
        description: "Boost registrations with strategic discounts and promotional offers.",
        tips: [
          formData.promoCodes.length === 0 ? "Optional - click Continue to skip" : `${formData.promoCodes.length} codes created`,
          "Early bird = 10-20% discount",
          "Student discounts increase reach",
          "Limited quantity creates urgency"
        ]
      },
      4: {
        title: "Registration Form Design",
        description: "Customize the information you collect from attendees.",
        tips: [
          `${formData.registrationForm.length} fields currently`,
          formData.registrationForm.some(field => !['Full Name', 'Email Address', 'Phone Number'].includes(field.label)) || formData.registrationForm.length !== 3 ? "✓ Customized" : "Using defaults",
          "Add event-specific fields if needed",
          "Keep under 8 fields total"
        ]
      },
      5: {
        title: "Post-Event Feedback Setup",
        description: "Customize feedback collection for valuable insights.",
        tips: [
          `${formData.feedbackForm.length} feedback fields`,
          formData.feedbackForm.some(field => !['Overall Event Rating', 'What did you like most?', 'Areas for improvement'].includes(field.label)) || formData.feedbackForm.length !== 3 ? "✓ Customized" : "Using defaults",
          "Customize for your event type",
          "Short forms get more responses"
        ]
      },
      6: {
        title: "Final Review & Launch",
        description: "Everything looks good! Time to publish and start welcoming attendees.",
        tips: [
          hasPaidTickets && hasQRCode ? "✓ Payment configured" : hasPaidTickets ? "⚠️ Check payment setup" : "✓ Free event ready",
          "✓ Forms configured",
          "Double-check all details",
          "Ready to go live!"
        ]
      }
    };

    return guidance[currentStep as keyof typeof guidance] || guidance[0];
  };

  // Function to check if a step is completed
  const isStepCompleted = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Basic Info
        return !!(formData.title && formData.description && formData.category);
      case 1: // Date & Venue
        return !!(formData.startDate && formData.startTime && formData.endDate && formData.endTime);
      case 2: // Tickets & Pricing
        const hasPaidTickets = formData.ticketTypes.some(t => t.price > 0);
        return formData.ticketTypes.length > 0 && (!hasPaidTickets || !!formData.paymentConfig?.qrCodeUrl);
      case 3: // Promo Codes (optional)
        // Optional step - considered complete if user has either added codes or explicitly moved past it
        return currentStep > 3 || formData.promoCodes.length > 0;
      case 4: // Registration Form
        // Check if form has been customized beyond defaults or user has moved past this step
        const defaultRegFields = ['Full Name', 'Email Address', 'Phone Number'];
        const hasCustomRegFields = formData.registrationForm.some(field =>
          !defaultRegFields.includes(field.label)
        ) || formData.registrationForm.length !== 3;
        return currentStep > 4 || hasCustomRegFields;
      case 5: // Feedback Form
        // Check if form has been customized beyond defaults or user has moved past this step
        const defaultFeedbackFields = ['Overall Event Rating', 'What did you like most?', 'Areas for improvement'];
        const hasCustomFeedbackFields = formData.feedbackForm.some(field =>
          !defaultFeedbackFields.includes(field.label)
        ) || formData.feedbackForm.length !== 3;
        return currentStep > 5 || hasCustomFeedbackFields;
      case 6: // Review
        return isStepCompleted(0) && isStepCompleted(1) && isStepCompleted(2) && isStepCompleted(4) && isStepCompleted(5);
      default:
        return false;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Navigation Header */}
      <div className="mb-6">
        {/* Back to Dashboard */}
        <button
          onClick={() => navigate(isAdminContext ? '/dashboard' : '/organizer')}
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors group font-medium"
        >
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{isEditMode ? 'Edit Event' : 'Create New Event'}</h1>
        <p className="text-gray-600 mt-2">
          Set up your event step by step with customizable forms and payment options
        </p>

        {/* Dynamic User Guide */}
        <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                {currentStep + 1}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-900">
                  {getCurrentStepGuidance().title}
                </h3>
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  Step {currentStep + 1} of {steps.length}
                </span>
              </div>
              <p className="text-sm text-blue-800 mb-3">
                {getCurrentStepGuidance().description}
              </p>

              {/* Action Tips */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-blue-900 mb-1">💡 Quick Tips:</div>
                <div className="flex flex-wrap gap-2">
                  {getCurrentStepGuidance().tips.map((tip, index) => (
                    <span key={index} className="inline-flex items-center px-2 py-1 bg-white/80 text-blue-700 text-xs rounded-md border border-blue-200 shadow-sm">
                      {tip}
                    </span>
                  ))}
                </div>
              </div>

              {/* Step-specific alerts/warnings */}
              {currentStep === 2 && formData.ticketTypes.some(t => t.price > 0) && !formData.paymentConfig?.qrCodeUrl && (
                <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">!</span>
                    </div>
                    <span className="text-xs text-amber-800 font-medium">
                      Don't forget to upload your payment QR code for paid tickets!
                    </span>
                  </div>
                </div>
              )}

              {currentStep === 6 && (
                <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center space-x-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-800 font-medium">
                      All set! Your event is ready to publish and start accepting registrations.
                    </span>
                  </div>
                </div>
              )}

              {/* Step Navigation */}
              <div className="mt-4 flex items-center justify-end space-x-2">
                {currentStep > 0 && (
                  <button
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    className="inline-flex items-center space-x-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="mb-8">
        {/* Desktop Step Progress */}
        <div className="hidden md:flex items-center justify-between relative">
          {/* Background line */}
          <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200 z-0"></div>

          {steps.map((step, index) => {
            const stepCompleted = isStepCompleted(step.id);
            const stepActive = currentStep === step.id;
            const stepVisited = currentStep > step.id;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center relative z-10">
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 hover:scale-105 cursor-pointer ${stepVisited || stepCompleted
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg hover:bg-blue-700'
                      : stepActive
                        ? 'bg-white border-blue-600 text-blue-600 ring-4 ring-blue-100 shadow-md'
                        : 'bg-white border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600'
                      }`}
                    title={`Go to ${step.title}`}
                  >
                    {stepVisited || stepCompleted ? (
                      <CheckCircleIcon className="w-6 h-6" />
                    ) : (
                      React.createElement(step.icon, { className: "w-5 h-5" })
                    )}
                  </button>
                  <div className="mt-3 text-center min-w-max">
                    <div
                      className={`text-sm font-medium transition-all duration-300 ${stepActive || stepVisited || stepCompleted
                        ? 'text-blue-600'
                        : 'text-gray-500'
                        }`}
                    >
                      {step.title}
                    </div>
                    <div className="text-xs mt-1">
                      {stepCompleted && !stepVisited ? (
                        <span className="text-green-600 font-medium">✓ Complete</span>
                      ) : (
                        <span className="text-gray-400">Step {step.id + 1}</span>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile Step Progress */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {steps[currentStep].title}
            </h2>
            <span className="text-sm text-gray-500 font-medium">
              {currentStep + 1} of {steps.length}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>

          {/* Current Step Info */}
          <div className="flex items-center">
            <div
              className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${'bg-blue-600 border-blue-600 text-white shadow-md'
                }`}
            >
              {React.createElement(steps[currentStep].icon, {
                className: "w-5 h-5"
              })}
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900">
                {steps[currentStep].title}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Step {currentStep + 1} of {steps.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-8">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>

            {/* Step indicator with progress */}
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Step {currentStep + 1} of {steps.length}
              </div>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                ></div>
              </div>
            </div>

            {currentStep < steps.length - 1 ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-gray-500">Next step:</div>
                  <div className="text-sm font-medium text-gray-700">
                    {steps[currentStep + 1].title}
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Save as draft logic here
                      alert('Draft saved! You can continue editing later.');
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <span>Continue</span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    className="flex items-center space-x-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-lg shadow-lg"
                  >
                    <span>🚀 Publish Event</span>
                  </button>
                </div>
                <div className="flex items-center space-x-4 text-sm">
                  <span className="text-gray-500">or</span>
                  <button
                    type="button"
                    onClick={() => {
                      // Save as draft logic here
                      navigate(isAdminContext ? '/dashboard' : '/organizer');
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(isAdminContext ? '/dashboard' : '/organizer')}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel & Exit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default CreateEventPage; 