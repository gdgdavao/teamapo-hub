import React, { useState, useEffect } from 'react';
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
  XCircleIcon
} from '@heroicons/react/24/outline';
import { FormBuilder, FormField } from '../../components/FormBuilder';

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
  
  // Pricing
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
    { id: 2, title: 'Pricing & Payment', icon: CurrencyDollarIcon },
    { id: 3, title: 'Registration Form', icon: UserGroupIcon },
    { id: 4, title: 'Feedback Form', icon: ChatBubbleLeftRightIcon },
    { id: 5, title: 'Review & Publish', icon: CheckCircleIcon }
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
        return renderPricingPaymentStep();
      case 3:
        return renderFormBuilderStep('registration');
      case 4:
        return renderFormBuilderStep('feedback');
      case 5:
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
          {['online', 'offline', 'hybrid'].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, venueType: type as any }))}
              className={`p-4 border-2 rounded-lg text-center ${
                formData.venueType === type
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <div className="font-medium capitalize">{type}</div>
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
            className={`p-4 border-2 rounded-lg text-center ${
              !formData.isPaid
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
            className={`p-4 border-2 rounded-lg text-center ${
              formData.isPaid
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
            <span className="font-medium text-gray-700">Price:</span>
            <span className="ml-2 text-gray-900">
              {formData.isPaid ? `₱${formData.ticketPrice}` : 'Free'}
            </span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Max Attendees:</span>
            <span className="ml-2 text-gray-900">{formData.maxAttendees || 'Unlimited'}</span>
          </div>
        </div>
      </div>

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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Event</h1>
        <p className="text-gray-600 mt-2">
          Set up your event with streamlined registration and feedback forms
        </p>
        
        {/* Workflow Information */}
        <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-900 mb-2">📋 Streamlined Event Creation Workflow</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">1</span>
              <div>
                <span className="font-medium">Registration Form</span>
                <p className="text-xs">Custom form with payment verification for paid events</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">2</span>
              <div>
                <span className="font-medium">Payment Process</span>
                <p className="text-xs">QR code, bank details, and automated proof collection</p>
              </div>
            </div>
            <div className="flex items-start space-x-2">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">3</span>
              <div>
                <span className="font-medium">Feedback Form</span>
                <p className="text-xs">Post-event feedback collection and analytics</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 text-gray-400'
                }`}
              >
                <step.icon className="w-5 h-5" />
              </div>
              <div className="ml-3 hidden md:block">
                <div
                  className={`text-sm font-medium ${
                    currentStep >= step.id ? 'text-blue-600' : 'text-gray-400'
                  }`}
                >
                  {step.title}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 h-0.5 mx-4 ${
                    currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-8">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-8 py-4 bg-gray-50 border-t border-gray-200">
          <button
            type="button"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>

          <div className="text-sm text-gray-500">
            Step {currentStep + 1} of {steps.length}
          </div>

          <button
            type="button"
            onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
            disabled={currentStep === steps.length - 1}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentStep === steps.length - 1 ? 'Publish Event' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateEventPage; 