import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  CalendarDaysIcon, 
  MapPinIcon, 
  UserGroupIcon, 
  CurrencyDollarIcon,
  PhotoIcon,
  QrCodeIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import FormRenderer from '../../components/FormRenderer/FormRenderer';
import { FormField } from '../../components/FormBuilder/FormBuilder';

interface PaymentConfig {
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
  paymentFields?: FormField[];
}

interface Event {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  startDate: string;
  endDate: string;
  venue: {
    type: 'online' | 'offline' | 'hybrid';
    name?: string;
    address?: string;
    city: string;
  };
  isPaid: boolean;
  ticketPrice: number;
  currency: string;
  maxAttendees?: number;
  currentAttendees: number;
  registrationForm: FormField[];
  paymentConfig?: PaymentConfig;
  category: string;
  organizer: string;
  imageUrl?: string;
}

const RegisterPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [registrationData, setRegistrationData] = useState<Record<string, any>>({});
  const [paymentData, setPaymentData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Mock event data - replace with API call
  useEffect(() => {
    setTimeout(() => {
      setEvent({
        id: eventId || '1',
        title: 'Web Development Workshop',
        description: 'Learn modern web development with React, TypeScript, and best practices. This comprehensive workshop covers everything from basic concepts to advanced techniques.',
        shortDescription: 'Learn modern web development with React and TypeScript',
        startDate: '2025-02-15T09:00:00Z',
        endDate: '2025-02-15T17:00:00Z',
        venue: {
          type: 'offline',
          name: 'GDG Davao Hub',
          address: '123 Tech Street, IT Park',
          city: 'Davao City'
        },
        isPaid: true,
        ticketPrice: 750,
        currency: 'PHP',
        maxAttendees: 50,
        currentAttendees: 23,
        category: 'workshop',
        organizer: 'GDG Davao',
        imageUrl: 'https://via.placeholder.com/600x300',
        registrationForm: [
          { id: '1', type: 'text', label: 'Full Name', required: true, gridSize: 'full' },
          { id: '2', type: 'email', label: 'Email Address', required: true, gridSize: 'half' },
          { id: '3', type: 'phone', label: 'Phone Number', required: true, gridSize: 'half' },
          { id: '4', type: 'text', label: 'Organization/Company', required: false, gridSize: 'full' },
          { id: '5', type: 'select', label: 'Experience Level', required: true, options: ['Beginner', 'Intermediate', 'Advanced'], gridSize: 'half' },
          { id: '6', type: 'multiselect', label: 'Interests', required: false, options: ['Frontend', 'Backend', 'DevOps', 'Mobile'], gridSize: 'half' },
          { id: '7', type: 'select', label: 'T-Shirt Size', required: true, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], gridSize: 'half' },
          { id: '8', type: 'textarea', label: 'Dietary Restrictions', required: false, gridSize: 'full', placeholder: 'Please mention any dietary restrictions or allergies' },
          { id: '9', type: 'textarea', label: 'Why do you want to attend this workshop?', required: false, gridSize: 'full' },
          { id: '10', type: 'checkbox', label: 'I agree to receive updates about future GDG Davao events', required: false, gridSize: 'full' }
        ],
        paymentConfig: {
          qrCodeUrl: 'https://via.placeholder.com/300x300',
          bankDetails: {
            bankName: 'GCash',
            accountName: 'GDG Davao',
            accountNumber: '09171234567'
          },
          instructions: 'Please scan the QR code or send payment to the GCash number above. After payment, upload a screenshot of your payment confirmation and enter the transaction reference number.',
          requiresProof: true,
          requiresTransactionId: true,
          paymentFields: [
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
              required: true,
              gridSize: 'full',
              placeholder: 'Enter transaction reference number',
              description: 'Provide the transaction ID for faster verification'
            }
          ]
        }
      });
      setLoading(false);
    }, 1000);
  }, [eventId]);

  const steps = event?.isPaid 
    ? ['Registration', 'Payment', 'Confirmation']
    : ['Registration', 'Confirmation'];

  const handleRegistrationSubmit = (data: Record<string, any>) => {
    setRegistrationData(data);
    if (event?.isPaid) {
      setCurrentStep(1); // Go to payment step
    } else {
      handleFinalSubmit(data);
    }
  };

  const handlePaymentSubmit = (data: Record<string, any>) => {
    setPaymentData(data);
    handleFinalSubmit({ ...registrationData, ...data });
  };

  const handleFinalSubmit = async (allData: Record<string, any>) => {
    setSubmitting(true);
    
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setSubmitted(true);
      setCurrentStep(event?.isPaid ? 2 : 1); // Go to confirmation step
    } catch (error) {
      console.error('Registration failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => prev - 1);
  };

  const renderStepContent = () => {
    if (!event) return null;

    switch (currentStep) {
      case 0: // Registration Form
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Register for Event</h2>
              <p className="text-gray-600 mt-2">
                Please fill out the registration form below
              </p>
            </div>
            
            <FormRenderer
              fields={event.registrationForm}
              onSubmit={handleRegistrationSubmit}
              submitButtonText={event.isPaid ? "Proceed to Payment" : "Complete Registration"}
              className="bg-white"
            />
          </div>
        );
      
      case 1: // Payment Step (only for paid events)
        if (!event.isPaid || !event.paymentConfig) return null;
        
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Payment</h2>
              <p className="text-gray-600 mt-2">
                Please complete your payment to secure your spot
              </p>
            </div>

            {/* Payment Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-blue-900">Payment Details</h3>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-900">
                    {event.currency} {event.ticketPrice}
                  </div>
                  <div className="text-sm text-blue-700">Event Registration Fee</div>
                </div>
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Payment Instructions</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* QR Code */}
                {event.paymentConfig.qrCodeUrl && (
                  <div className="text-center">
                    <h5 className="font-medium text-gray-700 mb-3">Scan QR Code</h5>
                    <div className="inline-block p-4 bg-white border-2 border-gray-300 rounded-lg">
                      <img
                        src={event.paymentConfig.qrCodeUrl}
                        alt="Payment QR Code"
                        className="w-48 h-48 object-contain mx-auto"
                      />
                    </div>
                  </div>
                )}

                {/* Bank Details */}
                <div>
                  <h5 className="font-medium text-gray-700 mb-3">Bank Details</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bank:</span>
                      <span className="font-medium">{event.paymentConfig.bankDetails.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Name:</span>
                      <span className="font-medium">{event.paymentConfig.bankDetails.accountName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Account Number:</span>
                      <span className="font-medium font-mono">{event.paymentConfig.bankDetails.accountNumber}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  {event.paymentConfig.instructions}
                </p>
              </div>
            </div>

            {/* Payment Verification Form */}
            {event.paymentConfig.paymentFields && event.paymentConfig.paymentFields.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Payment Verification</h4>
                <FormRenderer
                  fields={event.paymentConfig.paymentFields}
                  onSubmit={handlePaymentSubmit}
                  submitButtonText="Submit Payment Verification"
                  className="bg-white"
                />
                
                <div className="mt-4 flex justify-start">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    ← Back to Registration
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      case 2: // Confirmation Step (step 1 for free events, step 2 for paid events)
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircleIcon className="w-10 h-10 text-green-600" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {event.isPaid ? 'Payment Submitted!' : 'Registration Complete!'}
              </h2>
              <p className="text-gray-600 mt-2">
                {event.isPaid 
                  ? 'Your payment verification has been submitted. You will receive a confirmation email once your payment is verified.'
                  : 'Thank you for registering! You will receive a confirmation email shortly.'
                }
              </p>
            </div>

            {/* Registration Summary */}
            <div className="bg-gray-50 rounded-lg p-6 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-gray-900 mb-4">Registration Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Event:</span>
                  <span className="font-medium">{event.title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">
                    {new Date(event.startDate).toLocaleDateString()}
                  </span>
                </div>
                {event.isPaid && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">{event.currency} {event.ticketPrice}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${event.isPaid ? 'text-yellow-600' : 'text-green-600'}`}>
                    {event.isPaid ? 'Pending Verification' : 'Confirmed'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => navigate(`/events/${event.id}`)}
                className="w-full max-w-md px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                View Event Details
              </button>
              <button
                onClick={() => navigate('/events')}
                className="w-full max-w-md px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Browse More Events
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h2>
          <p className="text-gray-600 mb-4">The event you're looking for doesn't exist or has been removed.</p>
          <button
            onClick={() => navigate('/events')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Browse Events
          </button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Registration Submitted!</h2>
          <div className="space-y-4 text-gray-600 max-w-md mx-auto">
            <p>
              Thank you for registering for <strong>{event.title}</strong>.
            </p>
            {event.isPaid ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  <strong>Payment Pending:</strong> Your registration is pending payment verification. 
                  You'll receive a confirmation email once your payment is approved.
                </p>
              </div>
            ) : (
              <p>
                You'll receive a confirmation email shortly with event details and instructions.
              </p>
            )}
            <div className="pt-4">
              <button
                onClick={() => navigate('/events')}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mr-3"
              >
                Browse More Events
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                View My Events
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Event Header */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {event.imageUrl && (
            <img
              src={event.imageUrl}
              alt={event.title}
              className="w-full h-48 object-cover"
            />
          )}
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
                <p className="text-gray-600 mb-4">{event.shortDescription}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center text-gray-600">
                    <CalendarDaysIcon className="w-4 h-4 mr-2" />
                    {new Date(event.startDate).toLocaleDateString()}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <MapPinIcon className="w-4 h-4 mr-2" />
                    {event.venue.type === 'online' ? 'Online Event' : event.venue.name}
                  </div>
                  <div className="flex items-center text-gray-600">
                    <UserGroupIcon className="w-4 h-4 mr-2" />
                    {event.currentAttendees}/{event.maxAttendees || '∞'} attendees
                  </div>
                </div>
              </div>
              
              <div className="ml-6 text-right">
                <div className="text-2xl font-bold text-green-600">
                  {event.isPaid ? `₱${event.ticketPrice}` : 'FREE'}
                </div>
                <div className="text-sm text-gray-500 capitalize">{event.category}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-center">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  currentStep >= index
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {index + 1}
              </div>
              <div className="ml-2 text-sm font-medium text-gray-700">
                {step}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 h-0.5 mx-4 ${
                    currentStep > index ? 'bg-blue-600' : 'bg-gray-300'
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
      </div>
    </div>
  );
};

export default RegisterPage; 