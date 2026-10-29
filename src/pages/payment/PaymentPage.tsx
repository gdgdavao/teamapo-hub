import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import {
  CreditCardIcon,
  QrCodeIcon,
  PhotoIcon,
  ExclamationTriangleIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { InformationCircleIcon } from '@heroicons/react/20/solid';
import { EventService } from '../../services/eventService';
import { PaymentService } from '../../services/paymentService';
import { RegistrationService } from '../../services/registrationService';
import { Button, Card, EmptyState, Input, LoadingSpinner, Select, Textarea } from '../../components/UI';
import { Event, Registration, PaymentConfig } from '../../types';
import { toDateSafe } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';
import usePageTitle from '../../hooks/usePageTitle';

const PaymentPage: React.FC = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const location = useLocation();
  
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  usePageTitle({
    title: 'Payment',
    contextTitle: event?.title,
  });
  const [paymentConfigs, setPaymentConfigs] = useState<PaymentConfig[]>([]);
  const [selectedPaymentConfigId, setSelectedPaymentConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formDisabled, setFormDisabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
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
      setErrorMessage(null);
      
      // Check if this is a temporary registration (from session storage)
      if (registrationId!.startsWith('temp_')) {
        const tempData = sessionStorage.getItem(`temp_registration_${registrationId}`);
        if (!tempData) {
          setErrorMessage('Your registration session has expired. Please restart your registration.');
          setLoading(false);
          return;
        }
        
        const tempRegistration = JSON.parse(tempData);
        
        // Check if session is not too old (24 hours)
        const sessionAge = Date.now() - tempRegistration.timestamp;
        if (sessionAge > 24 * 60 * 60 * 1000) {
          sessionStorage.removeItem(`temp_registration_${registrationId}`);
          setErrorMessage('Your registration session has expired. Please restart your registration.');
          setLoading(false);
          return;
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
          setErrorMessage('Event not found or is no longer published.');
          setLoading(false);
          return;
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
      
      // Enforce secure payment token from email link
      const paymentToken = new URLSearchParams(location.search).get('t');
      if (!paymentToken) {
        setErrorMessage('A valid payment authorization token is required to view and submit payment. Please use the secure link sent to your confirmation email.');
        setLoading(false);
        return;
      }

      const registrationData = await RegistrationService.getRegistrationByPaymentToken(registrationId!, paymentToken);
      if (!registrationData) {
        setErrorMessage('Payment registration not found or authorization token is invalid.');
        setLoading(false);
        return;
      }

      // If payment already submitted or completed, block access to payment form
      const status = (registrationData as any).paymentStatus as string | undefined;
      if (status && status !== 'pending') {
        if (status === 'processing' || status === 'paid') {
          toast('This payment link has already been used.', {
            icon: <InformationCircleIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          });
          window.location.replace('/ticket');
          return;
        }
        setErrorMessage('This payment link is no longer available.');
        setLoading(false);
        return;
      }
      setRegistration(registrationData);

      // If a payment proof already exists (pending/approved), block access
      try {
        const latestProof = await PaymentService.getLatestPaymentProofByRegistrationId(registrationData.id, registrationData.eventId);
        if (latestProof && latestProof.verificationStatus !== 'rejected') {
          toast('Payment already submitted for this registration.', {
            icon: <InformationCircleIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          });
          window.location.replace('/ticket');
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
          const expDate = toDateSafe(exp);
          notExpired = expDate ? expDate.getTime() > Date.now() : true;
        } catch { /* ignore */ }
      }
      if (regToken) {
        if (linkStatus && linkStatus !== 'active') {
          toast('This payment link has already been used.', {
            icon: <InformationCircleIcon className="h-5 w-5 text-primary" aria-hidden="true" />
          });
          window.location.replace('/ticket');
          return;
        }
        if (!token || token !== regToken || !notExpired) {
          setErrorMessage('Payment link has expired or is invalid. Please contact the event organizer.');
          setLoading(false);
          return;
        }
      }
      
      // Get event details
      const eventData = await EventService.getEvent(registrationData.eventId);
      if (!eventData) {
        setErrorMessage('Event not found or is no longer published.');
        setLoading(false);
        return;
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
      setErrorMessage('Failed to load payment information. The link may have expired or is invalid.');
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
        toast.error('Invalid image format. Please select a JPG, PNG, GIF, WebP, or HEIC file.');
        e.target.value = ''; // Reset input
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image exceeds file size limit. Please choose an image smaller than 5MB.');
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
      toast.success('Payment proof submitted. Awaiting verification.', {
        duration: 4000,
      });
      
      // Hard redirect to prevent back button access
      setTimeout(() => {
        window.location.replace('/ticket');
      }, 1500);
      
    } catch (error: any) {
      logger.error('Error submitting payment proof:', error);
      
      // Dismiss loading toast
      if (uploadToast) {
        toast.dismiss(uploadToast);
      }
      
      // Show detailed error message with user-friendly text
      let errorMessage = 'Failed to submit payment proof. Please try again.';
      
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
      <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (errorMessage || !registration || !event) {
    return (
      <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Card padding="lg">
          <EmptyState
            icon={<ExclamationTriangleIcon className="h-10 w-10 text-warning" />}
            title="Payment Access Restricted"
            description={errorMessage || "The registration you're looking for doesn't exist or has been removed."}
            action={
              <Button variant="outlined" onClick={() => window.location.href = '/'}>
                Return to Home
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl 2xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-on-surface mb-2">Complete Your Payment</h1>
        <p className="text-on-surface-variant break-words">Event: {event.title}</p>
        <p className="text-base text-on-surface-variant font-mono break-all">Registration ID: {registration.id}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Payment Information */}
        <div className="space-y-6">
          {/* Payment Amount */}
          <Card padding="lg">
            <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
              <BanknotesIcon className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              Payment Summary
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between gap-3">
                <span className="text-on-surface-variant">Ticket Price:</span>
                <span className="shrink-0 font-semibold tabular-nums">₱{registration.originalAmount.toLocaleString()}</span>
              </div>
              {registration.discountAmount > 0 && (
                <div className="flex justify-between gap-3 text-success">
                  <span>Discount:</span>
                  <span className="shrink-0 tabular-nums">-₱{registration.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-outline-variant pt-3">
                <div className="flex justify-between gap-3 text-lg font-bold">
                  <span>Total Amount:</span>
                  <span className="shrink-0 text-primary tabular-nums">₱{registration.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Payment Methods */}
          {selectedConfig && (
            <Card padding="lg">
              <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                Payment Instructions
              </h2>
              {/* Payment Method Selector (multiple configs) */}
              {paymentConfigs.length > 1 && (
                <div className="mb-6">
                  <Select
                    label="Choose a payment method"
                    value={selectedPaymentConfigId || ''}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedPaymentConfigId(id);
                      const cfg = paymentConfigs.find(c => c.id === id);
                      if (cfg) {
                        setPaymentProof(prev => ({ ...prev, paymentMethod: cfg.name || cfg.id }));
                      }
                    }}
                    options={paymentConfigs.map(cfg => ({ value: cfg.id, label: cfg.name }))}
                  />
                </div>
              )}

              {/* Bank Details */}
              <div className="mb-6">
                <h3 className="mb-3 text-lg font-medium text-on-surface">Bank Transfer Details:</h3>
                <div className="rounded-lg bg-surface-container-low p-4 space-y-2">
                  <div className="break-words"><span className="font-medium">Bank:</span> {selectedConfig.bankDetails.bankName}</div>
                  <div className="break-words"><span className="font-medium">Account Name:</span> {selectedConfig.bankDetails.accountName}</div>
                  <div className="break-all font-mono"><span className="font-medium font-sans">Account Number:</span> {selectedConfig.bankDetails.accountNumber}</div>
                  {selectedConfig.bankDetails.swiftCode && (
                    <div className="break-all font-mono"><span className="font-medium font-sans">SWIFT Code:</span> {selectedConfig.bankDetails.swiftCode}</div>
                  )}
                </div>
              </div>

              {/* QR Code */}
              {selectedConfig.qrCodeUrl && (
                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-1 text-lg font-medium text-on-surface">
                    <QrCodeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Scan QR Code:
                  </h3>
                  <div className="flex justify-center">
                    <img
                      src={selectedConfig.qrCodeUrl}
                      alt="Payment QR Code"
                      className="w-64 h-auto border border-outline-variant rounded-lg shadow-elevation-1"
                    />
                  </div>
                </div>
              )}

              {/* Payment Instructions */}
              {selectedConfig.instructions && (
                <div className="mb-6">
                  <h3 className="mb-3 text-lg font-medium text-on-surface">Instructions:</h3>
                  <div className="rounded-lg bg-primary-container p-4">
                    <p className="text-on-primary-container whitespace-pre-line break-words">{selectedConfig.instructions}</p>
                  </div>
                </div>
              )}
            </Card>
          )}
          {!selectedConfig && (
            <div className="rounded-xl border border-outline-variant bg-warning-container p-8">
              <h3 className="font-semibold text-on-warning-container mb-2">Payment method not available</h3>
              <p className="text-on-warning-container">This event has no active payment methods configured. Please contact the organizer.</p>
            </div>
          )}
        </div>

        {/* Payment Proof Submission */}
        <Card padding="lg">
          <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
            <PhotoIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            Submit Payment Proof
          </h2>

          {formDisabled && (
            <div className="mb-4 rounded-lg border border-primary-container bg-primary-container p-3">
              <p className="font-medium text-on-primary-container">Payment proof submitted successfully!</p>
              <p className="text-base text-primary">Redirecting to confirmation page...</p>
            </div>
          )}

          <form onSubmit={handleSubmitPaymentProof} className="space-y-4">
            {/* Transaction ID */}
            {selectedConfig?.requiresTransactionId && (
              <Input
                mono
                label="Transaction ID"
                required={selectedConfig.requiresTransactionId}
                value={paymentProof.transactionId}
                onChange={(e) => setPaymentProof(prev => ({ ...prev, transactionId: e.target.value }))}
                placeholder="Enter your transaction/reference number"
                disabled={formDisabled}
              />
            )}

            {/* Selected Payment Method (auto from config). A read-only value,
                not a control - the attendee did not choose it and must not be
                able to change it here. */}
            {selectedConfig && (
              <div>
                <p className="mb-2xs text-sm font-medium text-on-surface">Payment Method</p>
                <div className="rounded-md border border-outline-variant bg-surface-container-low px-field-x py-field-y text-on-surface break-words">
                  {selectedConfig.name}
                </div>
              </div>
            )}

            {/* Payment Proof Image */}
            {selectedConfig?.requiresProof && (
              <Input
                type="file"
                accept="image/*"
                label="Payment Proof Image"
                required={selectedConfig.requiresProof}
                onChange={handleImageUpload}
                disabled={formDisabled}
              />
            )}

            {/* Preview */}
            {paymentProof.proofImagePreview && (
              <div>
                <p className="mb-2 text-base text-on-surface-variant">Preview:</p>
                <img
                  src={paymentProof.proofImagePreview}
                  alt="Payment proof preview"
                  className="w-full max-w-xs border border-outline-variant rounded-lg"
                />
              </div>
            )}

            {/* Notes */}
            <Textarea
              label="Additional Notes"
              hint="Optional"
              value={paymentProof.notes}
              onChange={(e) => setPaymentProof(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Any additional information about your payment..."
              disabled={formDisabled}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={!selectedConfig || formDisabled}
            >
              {formDisabled ? 'Payment Submitted' : 'Complete Registration'}
            </Button>
          </form>

          {/* Status Info */}
          <div className="mt-6 rounded-lg border border-outline-variant bg-warning-container p-4">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 shrink-0 mt-0.5 text-warning" aria-hidden="true" />
              <div className="min-w-0 text-base text-on-warning-container">
                <p className="font-medium">Important:</p>
                <p>Your payment will be verified by our team. You'll receive a confirmation email once approved. This may take 1-2 business days.</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PaymentPage;
