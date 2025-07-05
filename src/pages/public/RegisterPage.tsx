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
import TicketSelector from '../../components/TicketSelector/TicketSelector';
import { Event, TicketType, PromoCode } from '../../types';
import { TicketSelection } from '../../components/TicketSelector/TicketSelector';

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

const RegisterPage: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [registrationData, setRegistrationData] = useState<Record<string, any>>({});
  const [ticketSelection, setTicketSelection] = useState<TicketSelection[]>([]);
  const [appliedPromoCode, setAppliedPromoCode] = useState<PromoCode | null>(null);
  const [paymentData, setPaymentData] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Simple total calculation helper
  const calculateTotal = (selections: TicketSelection[]): number => {
    return selections.reduce((total, selection) => total + selection.totalAmount, 0);
  };

  // Helper function to create MockTimestamp
  const createMockTimestamp = (date: Date) => ({
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date
  });

  // TODO: Replace with actual API call to fetch event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        // TODO: Implement actual API call
        // const eventData = await EventService.getEventById(eventId);
        // setEvent(eventData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching event:', error);
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    } else {
      setLoading(false);
    }
  }, [eventId]);

  const steps = event && event.ticketTypes.length > 0 && event.ticketTypes.some(t => t.price > 0)
    ? ['Ticket Selection', 'Registration', 'Payment', 'Confirmation']
    : ['Registration', 'Confirmation'];

  const handleTicketSelection = (selection: TicketSelection) => {
    setTicketSelection([selection]); // Convert single selection to array for consistency
    setCurrentStep(1); // Go to registration step
  };

  const handleRegistrationSubmit = (data: Record<string, any>) => {
    setRegistrationData(data);
    const hasPaidTickets = ticketSelection.some(ts => {
      const ticket = event?.ticketTypes.find(t => t.id === ts.ticketTypeId);
      return ticket && ticket.price > 0;
    });
    
    if (hasPaidTickets) {
      setCurrentStep(2); // Go to payment step
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
      const hasPaidTickets = ticketSelection.some(ts => {
        const ticket = event?.ticketTypes.find(t => t.id === ts.ticketTypeId);
        return ticket && ticket.price > 0;
      });
      setCurrentStep(hasPaidTickets ? 3 : 1); // Go to confirmation step
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

    const hasPayment = event.ticketTypes.some(t => t.price > 0);

    switch (currentStep) {
      case 0: // Ticket Selection
        if (!hasPayment) {
          // Skip ticket selection for free events, go straight to registration
          return renderRegistrationStep();
        }
        
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Select Your Tickets</h2>
              <p className="text-gray-600 mt-2">
                Choose your ticket type and quantity
              </p>
            </div>
            
            <TicketSelector
              ticketTypes={event.ticketTypes}
              promoCodes={event.promoCodes || []}
              onSelectionChange={handleTicketSelection}
            />
          </div>
        );
      
      case 1: // Registration Form
        return renderRegistrationStep();
      
      case 2: // Payment Step (only for paid tickets)
        return renderPaymentStep();

      case 3: // Confirmation Step
        return renderConfirmationStep();

      default:
        return null;
    }
  };

  const renderRegistrationStep = () => {
    if (!event) return null;
    
    const defaultFields: FormField[] = [
      { id: '1', type: 'text' as const, label: 'Full Name', required: true, gridSize: 'full' },
      { id: '2', type: 'email' as const, label: 'Email Address', required: true, gridSize: 'half' },
      { id: '3', type: 'phone' as const, label: 'Phone Number', required: true, gridSize: 'half' },
      { id: '4', type: 'text' as const, label: 'Organization/Company', required: false, gridSize: 'full' },
      { id: '5', type: 'select' as const, label: 'Experience Level', required: true, options: ['Beginner', 'Intermediate', 'Advanced'], gridSize: 'half' },
      { id: '6', type: 'multiselect' as const, label: 'Interests', required: false, options: ['Frontend', 'Backend', 'DevOps', 'Mobile'], gridSize: 'half' },
      { id: '7', type: 'select' as const, label: 'T-Shirt Size', required: true, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], gridSize: 'half' },
      { id: '8', type: 'textarea' as const, label: 'Dietary Restrictions', required: false, gridSize: 'full', placeholder: 'Please mention any dietary restrictions or allergies' },
      { id: '9', type: 'textarea' as const, label: 'Why do you want to attend this workshop?', required: false, gridSize: 'full' },
      { id: '10', type: 'checkbox' as const, label: 'I agree to receive updates about future GDG Davao events', required: false, gridSize: 'full' }
    ];

    const hasPayment = event.ticketTypes.some(t => t.price > 0);
    const hasPaidTickets = ticketSelection.some(ts => {
      const ticket = event.ticketTypes.find(t => t.id === ts.ticketTypeId);
      return ticket && ticket.price > 0;
    });
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Registration Information</h2>
          <p className="text-gray-600 mt-2">
            Please fill out the registration form below
          </p>
        </div>

        {/* Show ticket selection summary if tickets were selected */}
        {ticketSelection.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Selected Tickets</h3>
            {ticketSelection.map((selection) => {
              const ticket = event.ticketTypes.find(t => t.id === selection.ticketTypeId);
              if (!ticket) return null;
              return (
                <div key={selection.ticketTypeId} className="flex justify-between items-center">
                  <span className="text-blue-800">
                    {ticket.name} × {selection.quantity}
                  </span>
                  <span className="font-medium text-blue-900">
                    {ticket.currency} {(ticket.price * selection.quantity).toLocaleString()}
                  </span>
                </div>
              );
            })}
            {appliedPromoCode && (
              <div className="mt-2 pt-2 border-t border-blue-200">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-700">Promo Code: {appliedPromoCode.code}</span>
                  <span className="text-green-600 font-medium">
                    {appliedPromoCode.discountType === 'percentage' 
                      ? `-${appliedPromoCode.discountValue}%`
                      : `-${appliedPromoCode.currency || 'PHP'} ${appliedPromoCode.discountValue}`
                    }
                  </span>
                </div>
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-blue-200">
              <div className="flex justify-between items-center font-semibold">
                <span className="text-blue-900">Total:</span>
                <span className="text-blue-900">
                  {event.ticketTypes[0]?.currency || 'PHP'} {calculateTotal(ticketSelection).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
        
        <FormRenderer
          fields={defaultFields}
          onSubmit={handleRegistrationSubmit}
          submitButtonText={hasPayment && hasPaidTickets ? "Proceed to Payment" : "Complete Registration"}
          className="bg-white"
        />

        {hasPayment && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => setCurrentStep(0)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back to Ticket Selection
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderPaymentStep = () => {
    if (!event) return null;
    
    const totalAmount = calculateTotal(ticketSelection);
    const currency = event.ticketTypes[0]?.currency || 'PHP';

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
                {currency} {totalAmount.toLocaleString()}
              </div>
              <div className="text-sm text-blue-700">Total Amount</div>
            </div>
          </div>
        </div>

        {/* Payment Instructions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Payment Instructions</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* QR Code */}
            <div className="text-center">
              <h5 className="font-medium text-gray-700 mb-3">Scan QR Code</h5>
              <div className="inline-block p-4 bg-white border-2 border-gray-300 rounded-lg">
                <img
                  src="https://via.placeholder.com/300x300"
                  alt="Payment QR Code"
                  className="w-48 h-48 object-contain mx-auto"
                />
              </div>
            </div>

            {/* Bank Details */}
            <div>
              <h5 className="font-medium text-gray-700 mb-3">Bank Details</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bank:</span>
                  <span className="font-medium">GCash</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Name:</span>
                  <span className="font-medium">GDG Davao</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Account Number:</span>
                  <span className="font-medium font-mono">09171234567</span>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              Please scan the QR code or send payment to the GCash number above. After payment, upload a screenshot of your payment confirmation and enter the transaction reference number.
            </p>
          </div>
        </div>

        {/* Payment Verification Form */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Payment Verification</h4>
          <FormRenderer
            fields={[
              {
                id: 'payment_proof',
                type: 'file' as const,
                label: 'Payment Proof Screenshot',
                required: true,
                gridSize: 'full',
                description: 'Upload a screenshot of your payment transaction'
              },
              {
                id: 'transaction_id',
                type: 'text' as const,
                label: 'Transaction ID / Reference Number',
                required: true,
                gridSize: 'full',
                placeholder: 'Enter transaction reference number',
                description: 'Provide the transaction ID for faster verification'
              }
            ]}
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
      </div>
    );
  };

  const renderConfirmationStep = () => {
    if (!event) return null;
    
    const hasPayment = ticketSelection.some(ts => {
      const ticket = event.ticketTypes.find(t => t.id === ts.ticketTypeId);
      return ticket && ticket.price > 0;
    });

    return (
      <div className="text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircleIcon className="w-10 h-10 text-green-600" />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {hasPayment ? 'Payment Submitted!' : 'Registration Complete!'}
          </h2>
          <p className="text-gray-600 mt-2">
            {hasPayment
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
                {event.startDate.toDate().toLocaleDateString()}
              </span>
            </div>
            {hasPayment && ticketSelection.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">
                  {event.ticketTypes[0]?.currency || 'PHP'} {calculateTotal(ticketSelection).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${hasPayment ? 'text-yellow-600' : 'text-green-600'}`}>
                {hasPayment ? 'Pending Verification' : 'Confirmed'}
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
              Thank you for registering for <strong>{event?.title}</strong>.
            </p>
            {ticketSelection.some(ts => {
              const ticket = event?.ticketTypes.find(t => t.id === ts.ticketTypeId);
              return ticket && ticket.price > 0;
            }) ? (
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
                    {event.startDate.toDate().toLocaleDateString()}
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
                  {event.ticketTypes.length > 0 && event.ticketTypes.some(t => t.price > 0) ? 
                    `${event.ticketTypes[0].currency} ${Math.min(...event.ticketTypes.map(t => t.price)).toLocaleString()}+` : 
                    'FREE'
                  }
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