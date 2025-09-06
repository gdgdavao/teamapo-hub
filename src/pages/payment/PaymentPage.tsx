import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import toast from 'react-hot-toast';

const PaymentPage: React.FC = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const navigate = useNavigate();
  
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Payment proof form state
  const [paymentProof, setPaymentProof] = useState({
    transactionId: '',
    paymentMethod: 'bank_transfer',
    notes: '',
    proofImageFile: null as File | null,
    proofImagePreview: null as string | null
  });

  useEffect(() => {
    if (registrationId) {
      loadRegistrationData();
    }
  }, [registrationId]);

  const loadRegistrationData = async () => {
    try {
      setLoading(true);
      
      // Get registration details
      const registrationData = await RegistrationService.getRegistrationById(registrationId!);
      if (!registrationData) {
        throw new Error('Registration not found');
      }
      setRegistration(registrationData);
      
      // Get event details
      const eventData = await EventService.getEvent(registrationData.eventId);
      if (!eventData) {
        throw new Error('Event not found');
      }
      setEvent(eventData);
      
      // Get payment configuration from event data
      if ((eventData as any).paymentConfig) {
        setPaymentConfig((eventData as any).paymentConfig);
      }
      
    } catch (error) {
      console.error('Error loading registration data:', error);
      toast.error('Failed to load payment information');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be smaller than 5MB');
        return;
      }
      
      setPaymentProof(prev => ({
        ...prev,
        proofImageFile: file,
        proofImagePreview: URL.createObjectURL(file)
      }));
    }
  };

  const handleSubmitPaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registration || !event) {
      toast.error('Registration data not found');
      return;
    }

    // Validate required fields
    if (paymentConfig?.requiresProof && !paymentProof.proofImageFile) {
      toast.error('Please upload a payment proof image');
      return;
    }
    
    if (paymentConfig?.requiresTransactionId && !paymentProof.transactionId.trim()) {
      toast.error('Please enter the transaction ID');
      return;
    }

    try {
      setSubmitting(true);
      
      await PaymentService.submitPaymentProof({
        registrationId: registration.id,
        attendeeName: registration.userDetails.name,
        attendeeEmail: registration.userDetails.email,
        eventTitle: event.title,
        eventId: event.id,
        ticketPrice: registration.totalAmount,
        proofImageFile: paymentProof.proofImageFile || undefined,
        transactionId: paymentProof.transactionId || undefined,
        paymentMethod: paymentProof.paymentMethod,
        notes: paymentProof.notes
      });
      
      // Do NOT auto-complete registration. Keep status pending for manual verification.
      toast.success('Payment proof submitted. Your registration is pending manual verification.');
      navigate('/payment/success');
      
    } catch (error: any) {
      console.error('Error submitting payment proof:', error);
      toast.error(error.message || 'Failed to submit payment proof');
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
        <p className="text-sm text-gray-500">Registration ID: {registration.id}</p>
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
          {paymentConfig && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <CreditCardIcon className="h-5 w-5 text-blue-500 mr-2" />
                Payment Instructions
              </h2>
              
              {/* Bank Details */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-3">Bank Transfer Details:</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div><span className="font-medium">Bank:</span> {paymentConfig.bankDetails.bankName}</div>
                  <div><span className="font-medium">Account Name:</span> {paymentConfig.bankDetails.accountName}</div>
                  <div><span className="font-medium">Account Number:</span> {paymentConfig.bankDetails.accountNumber}</div>
                  {paymentConfig.bankDetails.swiftCode && (
                    <div><span className="font-medium">SWIFT Code:</span> {paymentConfig.bankDetails.swiftCode}</div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              {paymentConfig.qrCodeUrl && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <QrCodeIcon className="h-4 w-4 mr-1" />
                    Scan QR Code:
                  </h3>
                  <div className="flex justify-center">
                    <img 
                      src={paymentConfig.qrCodeUrl} 
                      alt="Payment QR Code"
                      className="w-48 h-48 border border-gray-200 rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Payment Instructions */}
              {paymentConfig.instructions && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-800 mb-3">Instructions:</h3>
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-line">{paymentConfig.instructions}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Payment Proof Submission */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <PhotoIcon className="h-5 w-5 text-purple-500 mr-2" />
            Submit Payment Proof
          </h2>
          
          <form onSubmit={handleSubmitPaymentProof} className="space-y-4">
            {/* Transaction ID */}
            {paymentConfig?.requiresTransactionId && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Transaction ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={paymentProof.transactionId}
                  onChange={(e) => setPaymentProof(prev => ({ ...prev, transactionId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your transaction/reference number"
                  required={paymentConfig.requiresTransactionId}
                />
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                value={paymentProof.paymentMethod}
                onChange={(e) => setPaymentProof(prev => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="gcash">GCash</option>
                <option value="paymaya">Maya</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Payment Proof Image */}
            {paymentConfig?.requiresProof && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Payment Proof Image <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required={paymentConfig.requiresProof}
                  />
                  
                  {paymentProof.proofImagePreview && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600 mb-2">Preview:</p>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={paymentProof.notes}
                onChange={(e) => setPaymentProof(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={3}
                placeholder="Any additional information about your payment..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {submitting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Submitting...
                </div>
              ) : (
                'Complete Registration'
              )}
            </button>
          </form>

          {/* Status Info */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" />
              <div className="text-sm text-yellow-800">
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