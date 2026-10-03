import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  CreditCardIcon, 
  QrCodeIcon, 
  PhotoIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { EventService } from '../../services/eventService';
import { PaymentService } from '../../services/paymentService';
import { RegistrationService } from '../../services/registrationService';
import { Event, Registration, PaymentConfig } from '../../types';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

const PaymentPage: React.FC = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  // Multiple payment configurations support
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentConfig[]>([]);
  const [selectedPaymentConfigId, setSelectedPaymentConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formDisabled, setFormDisabled] = useState(false);
  
  // Payment proof form state
  const [paymentProof, setPaymentProof] = useState({
    transactionId: '',
    paymentMethod: 'bank_transfer',
    notes: '',
    proofImageFile: null as File | null,
    proofImagePreview: null as string | null
  });

  // Prevent navigation away after form submission
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (submitting) {
        e.preventDefault();
        e.returnValue = 'Your payment submission is in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [submitting]);

  useEffect(() => {
    if (registrationId) {
      loadRegistrationData();
    }
  }, [registrationId]);

  const loadRegistrationData = async () => {
    try {
      setLoading(true);
      
      // Check if this is a temporary registration (from session storage)
      if (registrationId!.startsWith('temp_')) {
        const tempData = sessionStorage.getItem(`temp_registration_${registrationId}`);
        if (!tempData) {
          throw new Error('Registration session expired. Please start over.');
        }
        
        const tempRegistration = JSON.parse(tempData);
        
        // Check if session is not too old (24 hours)
        const sessionAge = Date.now() - tempRegistration.timestamp;
        if (sessionAge > 24 * 60 * 60 * 1000) {
          sessionStorage.removeItem(`temp_registration_${registrationId}`);
          throw new Error('Registration session expired. Please start over.');
        }
        
        // Create a mock registration object for the UI
        const mockRegistration = {
          id: registrationId!,
          eventId: tempRegistration.eventId,
          userDetails: tempRegistration.userDetails,
          ticketTypeId: tempRegistration.ticketTypeId,
          quantity: tempRegistration.quantity,
          originalAmount: tempRegistration.originalAmount,
          discountAmount: tempRegistration.discountAmount,
          totalAmount: tempRegistration.totalAmount,
          paymentStatus: 'pending',
          attendanceStatus: 'pending',
          customResponses: tempRegistration.customResponses || {}
        };
        
        setRegistration(mockRegistration as any);
        
        // Get event details
        const eventData = await EventService.getEvent(tempRegistration.eventId);
        if (!eventData) {
          throw new Error('Event not found');
        }
        setEvent(eventData);
        
        // Get payment configurations from event data
        const configs: PaymentConfig[] = Array.isArray((eventData as any).paymentConfigs)
          ? ((eventData as any).paymentConfigs as PaymentConfig[])
          : [];
        const activeConfigs = configs.filter(cfg => cfg?.isActive !== false);
        setPaymentConfigs(activeConfigs);
        if (activeConfigs.length > 0) {
          setSelectedPaymentConfigId(activeConfigs[0].id);
          setPaymentProof(prev => ({ ...prev, paymentMethod: activeConfigs[0].name || activeConfigs[0].id }));
        }
        
        return;
      }
      
      // Resolve public payment access through the token-verifying callable.
      const paymentToken = new URLSearchParams(location.search).get('t');
      const registrationData = paymentToken
        ? await RegistrationService.getRegistrationByPaymentToken(registrationId!, paymentToken)
        : await RegistrationService.getRegistrationById(registrationId!);
      if (!registrationData) {
        throw new Error('Registration not found');
      }
      // If payment already submitted or completed, block access to payment form
      const status = (registrationData as any).paymentStatus as string | undefined;
      if (status && status !== 'pending') {
        // If processing or paid, send to success page; otherwise to home with info
        if (status === 'processing' || status === 'paid') {
          toast('This payment link has already been used.', { icon: 'ℹ️' });
          window.location.replace('/payment/success');
          return;
        }
        toast.error('This payment link is no longer available.');
        window.location.replace('/');
        return;
      }
      setRegistration(registrationData);

      // If a payment proof already exists (pending/approved), block access
      try {
        const latestProof = await PaymentService.getLatestPaymentProofByRegistrationId(registrationData.id);
        if (latestProof && latestProof.verificationStatus !== 'rejected') {
          toast('Payment already submitted for this registration.', { icon: 'ℹ️' });
          window.location.replace('/payment/success');
          return;
        }
      } catch (_e) {
        // Non-fatal; continue
      }

      // Token check to enforce expiring, one-time links
       const token = paymentToken;
      const regToken = (registrationData as any).paymentLinkToken as string | undefined;
      const exp = (registrationData as any).paymentLinkExpiresAt as any;
      const linkStatus = (registrationData as any).paymentLinkStatus as string | undefined;
      let notExpired = true;
      if (exp) {
        try {
          const expDate = typeof exp?.toDate === 'function' ? exp.toDate() : new Date(exp.seconds ? exp.seconds * 1000 : exp);
          notExpired = expDate.getTime() > Date.now();
        } catch { /* ignore */ }
      }
      if (regToken) {
        if (linkStatus && linkStatus !== 'active') {
          toast('This payment link has already been used.', { icon: 'ℹ️' });
          window.location.replace('/payment/success');
          return;
        }
        if (!token || token !== regToken || !notExpired) {
          toast.error('Payment link expired or invalid.');
          window.location.replace('/');
          return;
        }
      }
      
      // Get event details
      const eventData = await EventService.getEvent(registrationData.eventId);
      if (!eventData) {
        throw new Error('Event not found');
      }
      setEvent(eventData);
      
      // Get payment configurations from event data (new multi-config model)
      const configs: PaymentConfig[] = Array.isArray((eventData as any).paymentConfigs)
        ? ((eventData as any).paymentConfigs as PaymentConfig[])
        : [];
      const activeConfigs = configs.filter(cfg => cfg?.isActive !== false);
      setPaymentConfigs(activeConfigs);
      // Default to first active config
      if (activeConfigs.length > 0) {
        setSelectedPaymentConfigId(activeConfigs[0].id);
        // Keep paymentMethod in sync for submission/notifications
        setPaymentProof(prev => ({ ...prev, paymentMethod: activeConfigs[0].name || activeConfigs[0].id }));
      }
      
    } catch (error) {
      logger.error('Error loading registration data:', error);
      toast.error('Failed to load payment information');
      window.location.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type - be more lenient for mobile uploads
      const fileName = file.name.toLowerCase();
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
      const hasValidExtension = validExtensions.some(ext => fileName.endsWith(`.${ext}`));
      
      if (!file.type.startsWith('image/') && !hasValidExtension) {
        toast.error('Please select a valid image file (JPG, PNG, GIF, WebP, HEIC)');
        e.target.value = ''; // Reset input
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be smaller than 5MB');
        e.target.value = ''; // Reset input
        return;
      }
      
      // Show success feedback
      toast.success(`Image selected: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
      
      setPaymentProof(prev => ({
        ...prev,
        proofImageFile: file,
        proofImagePreview: URL.createObjectURL(file)
      }));
    }
  };

  // Derive selected payment config
  const selectedConfig = useMemo(() => {
    if (!selectedPaymentConfigId) return null;
    return paymentConfigs.find(c => c.id === selectedPaymentConfigId) || null;
  }, [paymentConfigs, selectedPaymentConfigId]);

  const handleSubmitPaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registration || !event) {
      toast.error('Registration data not found');
      return;
    }

    // Validate required fields
    if (selectedConfig?.requiresProof && !paymentProof.proofImageFile) {
      toast.error('Please upload a payment proof image');
      return;
    }
    
    if (selectedConfig?.requiresTransactionId && !paymentProof.transactionId.trim()) {
      toast.error('Please enter the transaction ID');
      return;
    }

    if (!selectedConfig) {
      toast.error('Please select a payment method');
      return;
    }

    let uploadToast: string | undefined;
    
    try {
      setSubmitting(true);
      setFormDisabled(true); // Disable the entire form
      
      // Create the registration before uploading proof through the trusted function.
      uploadToast = toast.loading('Creating registration...');
      
      // Check if this is a temporary registration that needs to be created in Firestore
      if (registrationId!.startsWith('temp_')) {
        // Get temporary registration data from session storage
        const tempData = sessionStorage.getItem(`temp_registration_${registrationId}`);
        if (!tempData) {
          throw new Error('Registration session expired. Please start over.');
        }
        
        const tempRegistration = JSON.parse(tempData);
        
        // Create the actual registration in Firestore
        const actualRegistration = await RegistrationService.createPendingRegistration({
          eventId: tempRegistration.eventId,
          ticketTypeId: tempRegistration.ticketTypeId,
          quantity: tempRegistration.quantity,
          promoCode: tempRegistration.promoCode,
          userDetails: tempRegistration.userDetails,
          customResponses: tempRegistration.customResponses,
          agreeToTerms: tempRegistration.agreeToTerms,
          subscribeToUpdates: tempRegistration.subscribeToUpdates
        });
        
        // Clean up session storage
        sessionStorage.removeItem(`temp_registration_${registrationId}`);
        
        // Update registration ID for payment proof submission
        const updatedRegistration = {
          ...registration,
          id: actualRegistration.registrationId
        };
        setRegistration(updatedRegistration as any);
        
        toast.dismiss(uploadToast);
        uploadToast = toast.loading('Submitting payment proof...');
        
        // STEP 3: Submit payment proof with the actual registration ID
        await PaymentService.submitPaymentProof({
          registrationId: actualRegistration.registrationId,
          attendeeName: tempRegistration.userDetails.name,
          attendeeEmail: tempRegistration.userDetails.email,
          eventTitle: event.title,
          eventId: event.id,
          ticketPrice: tempRegistration.totalAmount,
           proofImageFile: paymentProof.proofImageFile,
           paymentToken: actualRegistration.paymentLinkToken,
          transactionId: paymentProof.transactionId || undefined,
          paymentMethod: selectedConfig.name || paymentProof.paymentMethod,
          notes: paymentProof.notes
        });

        // Send confirmation email after successful submission
        try {
          await RegistrationService.sendRegistrationConfirmationEmail(
            actualRegistration.registrationId,
            event.id,
            tempRegistration.userDetails.email,
            tempRegistration.userDetails.name,
            true // requiresPayment
          );
        } catch (emailError) {
          logger.warn('Failed to send confirmation email:', emailError);
          // Don't block the flow if email fails
        }
      } else {
        // Handle existing Firestore registrations (legacy flow)
        toast.dismiss(uploadToast);
        uploadToast = toast.loading('Submitting payment proof...');
        
        await PaymentService.submitPaymentProof({
          registrationId: registration.id,
          attendeeName: registration.userDetails.name,
          attendeeEmail: registration.userDetails.email,
          eventTitle: event.title,
          eventId: event.id,
          ticketPrice: registration.totalAmount,
           proofImageFile: paymentProof.proofImageFile,
           paymentToken: new URLSearchParams(location.search).get('t') || undefined,
          transactionId: paymentProof.transactionId || undefined,
          paymentMethod: selectedConfig.name || paymentProof.paymentMethod,
          notes: paymentProof.notes
        });

        // Send confirmation email after successful submission
        try {
          await RegistrationService.sendRegistrationConfirmationEmail(
            registration.id,
            event.id,
            registration.userDetails.email,
            registration.userDetails.name,
            true // requiresPayment
          );
        } catch (emailError) {
          logger.warn('Failed to send confirmation email:', emailError);
          // Don't block the flow if email fails
        }
      }
      
      // Dismiss loading toast
      toast.dismiss(uploadToast);
      
      // Do NOT auto-complete registration. Keep status pending for manual verification.
      toast.success('Payment proof submitted successfully! Awaiting verification.', {
        duration: 4000,
        icon: '✅'
      });
      
      // Hard redirect to prevent back button access
      setTimeout(() => {
        window.location.replace('/payment/success');
      }, 1500);
      
    } catch (error: any) {
      logger.error('Error submitting payment proof:', error);
      
      // Dismiss loading toast
      if (uploadToast) {
        toast.dismiss(uploadToast);
      }
      
      // Show detailed error message with user-friendly text
      let errorMessage = 'Failed to submit payment proof';
      
      if (error.message) {
        if (error.message.includes('permission') || error.message.includes('insufficient')) {
          errorMessage = 'Unable to complete registration. Please try again or contact support.';
        } else if (error.message.includes('expired')) {
          errorMessage = 'Registration session expired. Please start over.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'Event or registration not found. Please verify the link.';
        } else if (error.message.includes('limit exceeded')) {
          errorMessage = 'Ticket quantity limit exceeded. This event is sold out.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage, { duration: 5000 });
      
      setFormDisabled(false); // Re-enable form on error
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!registration || !event) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-red-800 mb-2">Registration Not Found</h2>
          <p className="text-red-600">The registration you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Payment</h1>
        <p className="text-gray-600">Event: {event.title}</p>
        <p className="text-base text-gray-500">Registration ID: {registration.id}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Payment Information */}
        <div className="space-y-6">
          {/* Payment Amount */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <BanknotesIcon className="h-5 w-5 text-green-500 mr-2" />
              Payment Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Ticket Price:</span>
                <span className="font-semibold">₱{registration.originalAmount.toLocaleString()}</span>
              </div>
              {registration.discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount:</span>
                  <span>-₱{registration.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span className="text-blue-600">₱{registration.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Methods */}
          {selectedConfig && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <CreditCardIcon className="h-5 w-5 text-blue-500 mr-2" />
                Payment Instructions
              </h2>
              {/* Payment Method Selector (multiple configs) */}
              {paymentConfigs.length > 1 && (
                <div className="mb-6">
                  <label className="mb-2 block text-base font-medium text-gray-700">Choose a payment method</label>
                  <select
                    value={selectedPaymentConfigId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedPaymentConfigId(id);
                      const cfg = paymentConfigs.find(c => c.id === id);
                      if (cfg) {
                        setPaymentProof(prev => ({ ...prev, paymentMethod: cfg.name || cfg.id }));
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {paymentConfigs.map(cfg => (
                      <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              {/* Bank Details */}
              <div className="mb-6">
                <h3 className="mb-3 text-lg font-medium text-gray-800">Bank Transfer Details:</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div><span className="font-medium">Bank:</span> {selectedConfig.bankDetails.bankName}</div>
                  <div><span className="font-medium">Account Name:</span> {selectedConfig.bankDetails.accountName}</div>
                  <div><span className="font-medium">Account Number:</span> {selectedConfig.bankDetails.accountNumber}</div>
                  {selectedConfig.bankDetails.swiftCode && (
                    <div><span className="font-medium">SWIFT Code:</span> {selectedConfig.bankDetails.swiftCode}</div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              {selectedConfig.qrCodeUrl && (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center text-lg font-medium text-gray-800">
                    <QrCodeIcon className="h-4 w-4 mr-1" />
                    Scan QR Code:
                  </h3>
                  <div className="flex justify-center">
                    <img
                      src={selectedConfig.qrCodeUrl}
                      alt="Payment QR Code"
                      className="w-64 h-128 border border-gray-200 rounded-lg shadow-lg"
                    />
                  </div>
                </div>
              )}

              {/* Payment Instructions */}
              {selectedConfig.instructions && (
                <div className="mb-6">
                  <h3 className="mb-3 text-lg font-medium text-gray-800">Instructions:</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-line">{selectedConfig.instructions}</p>
                  </div>
                </div>
              )}
            </div>
          )}
          {!selectedConfig && (
            <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-6">
              <h3 className="font-semibold text-yellow-800 mb-2">Payment method not available</h3>
              <p className="text-yellow-700">This event has no active payment methods configured. Please contact the organizer.</p>
            </div>
          )}
        </div>

        {/* Payment Proof Submission */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <PhotoIcon className="h-5 w-5 text-purple-500 mr-2" />
            Submit Payment Proof
          </h2>
          
          {formDisabled && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800 font-medium">✓ Payment proof submitted successfully!</p>
              <p className="text-base text-blue-600">Redirecting to confirmation page...</p>
            </div>
          )}
          
          <form onSubmit={handleSubmitPaymentProof} className="space-y-4">
            {/* Transaction ID */}
            {selectedConfig?.requiresTransactionId && (
              <div>
                <label className="mb-2 block text-base font-medium text-gray-700">
                  Transaction ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={paymentProof.transactionId}
                  onChange={(e) => setPaymentProof(prev => ({ ...prev, transactionId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your transaction/reference number"
                  required={selectedConfig.requiresTransactionId}
                  disabled={formDisabled}
                />
              </div>
            )}

            {/* Selected Payment Method (auto from config) */}
            {selectedConfig && (
              <div>
                <label className="mb-1 block text-base font-medium text-gray-700">
                  Payment Method
                </label>
                <div className="px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-800">
                  {selectedConfig.name}
                </div>
              </div>
            )}

            {/* Payment Proof Image */}
            {selectedConfig?.requiresProof && (
              <div>
                <label className="mb-2 block text-base font-medium text-gray-700">
                  Payment Proof Image <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={selectedConfig.requiresProof}
                    disabled={formDisabled}
                  />
                  
                  {paymentProof.proofImagePreview && (
                    <div className="mt-3">
                      <p className="mb-2 text-base text-gray-600">Preview:</p>
                      <img 
                        src={paymentProof.proofImagePreview} 
                        alt="Payment proof preview"
                        className="w-full max-w-xs border border-gray-200 rounded-lg"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="mb-2 block text-base font-medium text-gray-700">
                Additional Notes (Optional)
              </label>
              <textarea
                value={paymentProof.notes}
                onChange={(e) => setPaymentProof(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Any additional information about your payment..."
                disabled={formDisabled}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !selectedConfig || formDisabled}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {submitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Submitting...
                </div>
              ) : formDisabled ? (
                'Payment Submitted ✓'
              ) : (
                'Complete Registration'
              )}
            </button>
          </form>

          {/* Status Info */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" />
              <div className="text-base text-yellow-800">
                <p className="font-medium">Important:</p>
                <p>Your payment will be verified by our team. You'll receive a confirmation email once approved. This may take 1-2 business days.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
