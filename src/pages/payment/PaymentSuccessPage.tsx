import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CheckCircleIcon,
  EnvelopeIcon,
  TicketIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { Badge, Button, Card } from '../../components/UI';
import { WalletPassService } from '../../services/walletPassService';
import { RegistrationService } from '../../services/registrationService';
import TicketCard from '../../components/TicketCard';

/** SVG icon representing Google Wallet pass */
const GoogleWalletIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
    <circle cx="16" cy="14" r="1" fill="currentColor" />
  </svg>
);

/** The three numbered steps, so the same copy is not written out three times. */
const STEPS = [
  {
    key: 'recorded',
    free: 'Registration Recorded',
    paid: 'Manual Review',
    freeBody: 'Your registration details were received successfully.',
    paidBody: 'The organizers will review your payment proof shortly.'
  },
  {
    key: 'email',
    free: 'Email Notification',
    paid: 'Email Notification',
    freeBody: "We'll send a confirmation email with your event details.",
    paidBody: "You'll receive an email once your payment is approved or if we need more info."
  },
  {
    key: 'next',
    free: 'Next Steps',
    paid: 'Next Steps',
    freeBody: 'Watch your inbox for updates and event reminders before the event date.',
    paidBody: "After approval, you'll receive your confirmation and QR code for check-in."
  }
];

const PaymentSuccessPage: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const regId = searchParams.get('reg') || searchParams.get('registrationId');
  const token = searchParams.get('token') || searchParams.get('walletPassToken');

  const locationState = location.state as {
    registration?: any;
    event?: any;
  } | null;

  const [ticketData, setTicketData] = useState<{
    registration: any;
    event: any;
  } | null>(
    locationState?.registration
      ? { registration: locationState.registration, event: locationState.event }
      : null
  );
  const [isLoadingTicket, setIsLoadingTicket] = useState(false);
  const [isSavingWallet, setIsSavingWallet] = useState(false);
  const [walletStatus, setWalletStatus] = useState<'idle' | 'not-configured' | 'success'>('idle');

  const isFreeRegistrationSuccess = location.pathname === '/registration/success';

  useEffect(() => {
    if (!ticketData && regId && token) {
      setIsLoadingTicket(true);
      RegistrationService.getTicketPass(regId, token)
        .then((res) => {
          if (res) {
            setTicketData(res);
          }
        })
        .finally(() => {
          setIsLoadingTicket(false);
        });
    }
  }, [regId, token, ticketData]);

  const handleSaveToWallet = async () => {
    if (!regId || !token) return;
    setIsSavingWallet(true);
    try {
      const response = await WalletPassService.createWalletPassUrl({
        registrationId: regId,
        walletPassToken: token
      });

      if (response.error === 'wallet-not-configured') {
        setWalletStatus('not-configured');
        toast('Google Wallet is not yet configured on this instance.', {
          icon: <InformationCircleIcon className="h-5 w-5 text-primary" aria-hidden="true" />
        });
        return;
      }

      if (response.error || !response.saveUrl) {
        toast.error(response.message || 'Could not generate Google Wallet pass.');
        return;
      }

      setWalletStatus('success');
      window.open(response.saveUrl, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('An unexpected error occurred while saving pass.');
    } finally {
      setIsSavingWallet(false);
    }
  };

  const steps = STEPS.map((step, index) => ({
    ...step,
    title: isFreeRegistrationSuccess ? step.free : step.paid,
    body: isFreeRegistrationSuccess ? step.freeBody : step.paidBody,
    number: index + 1
  }));

  const hasTicket = Boolean(ticketData || (regId && token));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Success Header */}
      <div className="text-center mb-8">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-container">
          <CheckCircleIcon className="h-12 w-12 text-success" aria-hidden="true" />
        </div>
        <h1 className="text-3xl font-bold text-on-surface mb-2">
          {isFreeRegistrationSuccess ? 'Registration Complete' : 'Registration Submitted'}
        </h1>
        <p className="text-lg text-on-surface-variant">
          {isFreeRegistrationSuccess
            ? "You're officially registered. No payment is required for this event."
            : 'Your registration is pending manual verification by our team.'}
        </p>
      </div>

      {/* Canonical In-App Ticket Card & Wallet Action per docs/PassUI.md §4 */}
      {hasTicket && (
        <section aria-label="Digital Event Ticket" className="mb-10">
          <TicketCard
            registration={ticketData?.registration || (regId ? { id: regId } : null)}
            event={ticketData?.event || null}
            loading={isLoadingTicket}
            className="mb-6"
          />

          {/* Action Area Below the Card */}
          <div className="max-w-[26.25rem] mx-auto text-center space-y-3">
            {regId && token && (
              <Button
                variant="filled"
                size="md"
                loading={isSavingWallet}
                onClick={handleSaveToWallet}
                className="w-full min-h-[48px] px-6 text-base font-semibold shadow-sm hover:shadow"
                icon={<GoogleWalletIcon className="h-5 w-5" />}
              >
                Save to Google Wallet
              </Button>
            )}

            {walletStatus === 'not-configured' && (
              <div className="p-3 rounded-lg border border-outline-variant bg-surface-container-low flex flex-col items-center gap-1.5 text-center">
                <Badge tone="neutral">
                  <span>Wallet not yet available</span>
                </Badge>
                <p className="text-xs text-on-surface-variant">
                  Google Wallet is not yet activated on this server. The QR code on your card above is valid for door check-in.
                </p>
              </div>
            )}

            <p className="text-xs text-on-surface-variant">
              The QR code on this ticket is your primary door credential. Google Wallet pass installation is optional.
            </p>
          </div>
        </section>
      )}

      {/* Success Details */}
      <Card padding="lg" className="mb-8">
        <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-on-surface">
          <TicketIcon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          What Happens Next?
        </h2>

        <ol className="space-y-md">
          {steps.map((step) => (
            <li key={step.key} className="flex items-start gap-4">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-sm font-semibold text-primary"
                aria-hidden="true"
              >
                {step.number}
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-on-surface">{step.title}</h3>
                <p className="text-on-surface-variant">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* Important Information */}
      <div className="mb-8 rounded-xl border border-primary-container bg-primary-container p-8">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-on-primary-container">
          <EnvelopeIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          Important Information
        </h3>
        <ul className="space-y-2 text-on-primary-container">
          <li>
            • {isFreeRegistrationSuccess
              ? 'Check your email (including spam folder) for your registration confirmation'
              : 'Check your email (including spam folder) for verification updates'}
          </li>
          <li>• Keep your registration ID safe - you may need it for support</li>
          <li>
            • {isFreeRegistrationSuccess
              ? "If you don't receive confirmation details within 24 hours, contact support"
              : "If you don't receive an update within 1-2 business days, contact support"}
          </li>
          {!isFreeRegistrationSuccess && (
            <li>• Your payment proof is securely stored for our records</li>
          )}
        </ul>
      </div>

      {/* Support Information */}
      <div className="mt-12 text-center">
        <p className="text-sm text-on-surface-variant">
          Need help? Contact our support team at{' '}
          <a href="mailto:support@gdgdavao.org" className="text-primary hover:text-primary-hover">
            support@gdgdavao.org
          </a>
        </p>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;
