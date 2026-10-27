import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  EnvelopeIcon,
  TicketIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { Badge, Button, Card } from '../../components/UI';
import { WalletPassService } from '../../services/walletPassService';
import { RegistrationService } from '../../services/registrationService';
import TicketCard from '../../components/TicketCard';
import { downloadTicketAsPng } from '../../utils/ticketCanvas';
import { isIOSDevice } from '../../utils/passArtwork';
import usePageTitle from '../../hooks/usePageTitle';

/**
 * Opens the Google Wallet Save URL in a new tab, falling back to same-tab navigation
 * if WebKit (Safari) or Firefox blocks window.open after an async await.
 */
function openWalletSaveUrl(url: string): void {
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win && typeof window !== 'undefined') {
    const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '');
    const isAssignMocked = typeof (window.location?.assign as any)?.mock === 'object';
    if (!isJsdom || isAssignMocked) {
      window.location.assign(url);
    }
  }
}

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
    confirmed: 'Ticket Issued',
    free: 'Registration Recorded',
    paid: 'Manual Review',
    confirmedBody: 'Your ticket is confirmed and ready for entry.',
    freeBody: 'Your registration details were received successfully.',
    paidBody: 'The organizers will review your payment proof shortly.'
  },
  {
    key: 'email',
    confirmed: 'Digital Pass Ready',
    free: 'Email Notification',
    paid: 'Email Notification',
    confirmedBody: 'Save your pass to Google Wallet, download it as an image, or keep this page bookmarked.',
    freeBody: "We'll send a confirmation email with your event details.",
    paidBody: "You'll receive an email once your payment is approved or if we need more info."
  },
  {
    key: 'next',
    confirmed: 'Event Day Check-In',
    free: 'Next Steps',
    paid: 'Next Steps',
    confirmedBody: 'Present your QR code at the registration desk upon arrival at the venue.',
    freeBody: 'Watch your inbox for updates and event reminders before the event date.',
    paidBody: "After approval, you'll receive your confirmation and digital ticket for check-in."
  }
];

const TicketPage: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const regId = searchParams.get('reg') || searchParams.get('registrationId');
  const token = searchParams.get('token') || searchParams.get('walletPassToken');
  const isFreeMode = searchParams.get('mode') === 'free' || location.pathname === '/registration/success';

  usePageTitle({ title: 'Your Ticket | TeamApo Hub' });

  useEffect(() => {
    // Attendees access tickets via private secret tokens. Protect against indexing.
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');
  }, []);

  const locationState = location.state as {
    registration?: any;
    event?: any;
  } | null;

  const isIOS = isIOSDevice();

  const [ticketData, setTicketData] = useState<{
    registration: any;
    event: any;
  } | null>(
    locationState?.registration
      ? { registration: locationState.registration, event: locationState.event }
      : null
  );
  const [isLoadingTicket, setIsLoadingTicket] = useState<boolean>(
    Boolean(!locationState?.registration && regId && token)
  );
  const [ticketLoadError, setTicketLoadError] = useState<
    'not-approved' | 'not-found' | 'error' | null
  >(null);
  const [isSavingWallet, setIsSavingWallet] = useState(false);
  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [walletStatus, setWalletStatus] = useState<'idle' | 'not-configured' | 'success'>('idle');
  const [cachedWalletPass, setCachedWalletPass] = useState<{
    saveUrl: string;
    expiryAtMs: number;
  } | null>(null);

  const loadTicketPass = useCallback(async () => {
    if (!regId || !token) return;
    setIsLoadingTicket(true);
    setTicketLoadError(null);
    try {
      const res = await RegistrationService.getTicketPass(regId, token);
      if (res && res.registration && res.event) {
        setTicketData({ registration: res.registration, event: res.event });
        setTicketLoadError(null);
      } else {
        setTicketData(null);
        setTicketLoadError(res?.error || 'not-found');
      }
    } catch {
      setTicketData(null);
      setTicketLoadError('error');
    } finally {
      setIsLoadingTicket(false);
    }
  }, [regId, token]);

  useEffect(() => {
    if (!ticketData && regId && token) {
      void loadTicketPass();
    }
  }, [regId, token, ticketData, loadTicketPass]);

  const handleSaveToWallet = async () => {
    if (isIOS || !regId || !token) return;

    // If a valid non-expired Save URL is already cached, open it synchronously on the user gesture
    if (cachedWalletPass && Date.now() < cachedWalletPass.expiryAtMs - 60_000) {
      setWalletStatus('success');
      openWalletSaveUrl(cachedWalletPass.saveUrl);
      return;
    }

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

      const parsedExpiry = response.expiryAt ? Date.parse(response.expiryAt) : NaN;
      const expiryAtMs = Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + 14 * 60_000;
      setCachedWalletPass({
        saveUrl: response.saveUrl,
        expiryAtMs
      });
      setWalletStatus('success');
      openWalletSaveUrl(response.saveUrl);
    } catch {
      toast.error('An unexpected error occurred while saving pass.');
    } finally {
      setIsSavingWallet(false);
    }
  };

  const handleSaveAsImage = async () => {
    const reg = ticketData?.registration;
    const evt = ticketData?.event;
    const currentRegId = regId || reg?.id;
    if (!currentRegId) {
      toast.error('Unable to export ticket: registration ID is missing.');
      return;
    }

    setIsDownloadingImage(true);
    try {
      const attendeeName =
        reg?.userDetails?.name ||
        reg?.attendeeName ||
        (reg?.userDetails?.firstName
          ? `${reg.userDetails.firstName} ${reg.userDetails.lastName || ''}`.trim()
          : undefined);

      let venueStr = 'Davao City, Philippines';
      if (evt?.venue) {
        if (typeof evt.venue === 'string') {
          venueStr = evt.venue;
        } else if (evt.venue.type === 'online') {
          venueStr = 'Online Event';
        } else {
          const parts: string[] = [];
          if (evt.venue.name?.trim()) parts.push(evt.venue.name.trim());
          if (evt.venue.address?.trim()) parts.push(evt.venue.address.trim());
          if (evt.venue.city?.trim()) parts.push(evt.venue.city.trim());
          if (parts.length > 0) venueStr = parts.join(', ');
        }
      }

      let roleStr = 'Participant';
      if (reg?.ticketType) {
        roleStr = typeof reg.ticketType === 'string' ? reg.ticketType : reg.ticketType.name || 'Participant';
      } else if (reg?.ticketTypeId && evt?.ticketTypes) {
        const matched = evt.ticketTypes.find((t: any) => t.id === reg.ticketTypeId);
        if (matched?.name) roleStr = matched.name;
      }

      await downloadTicketAsPng({
        registrationId: currentRegId,
        attendeeName,
        role: roleStr,
        eventTitle: evt?.title || 'GDG Davao Event',
        eventDate: evt?.startDate,
        timezone: evt?.timezone || 'Asia/Manila',
        venue: venueStr,
        bannerUrl: evt?.bannerUrl || evt?.imageUrl,
        qrCode: reg?.qrCode || (currentRegId ? `registration:${currentRegId}` : undefined)
      });
      toast.success('Ticket image downloaded successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Could not download ticket image.');
    } finally {
      setIsDownloadingImage(false);
    }
  };

  const isApproved =
    ticketData?.registration?.registrationStatus === 'approved' ||
    ticketData?.registration?.registrationStatus === 'confirmed' ||
    ticketData?.registration?.paymentStatus === 'paid';

  const hasVerifiedTicket = Boolean(ticketData?.registration && isApproved);
  const canOfferGoogleWallet = Boolean(!isIOS && regId && token && hasVerifiedTicket);

  let headerTitle = 'Registration Submitted';
  let headerSubtitle = 'Your registration is pending manual verification by our team.';

  if (ticketLoadError === 'not-found') {
    headerTitle = 'Ticket Link Unavailable';
    headerSubtitle =
      'This ticket link is invalid, expired, or the registration has been cancelled.';
  } else if (ticketLoadError === 'not-approved') {
    headerTitle = 'Ticket Pending Verification';
    headerSubtitle =
      'Your registration is awaiting organizer approval. Your QR ticket will unlock once verified.';
  } else if (ticketLoadError === 'error') {
    headerTitle = 'Unable to Load Ticket';
    headerSubtitle =
      'We could not verify your ticket right now due to a connection issue. Please try again.';
  } else if (isApproved) {
    headerTitle = 'Registration Confirmed';
    headerSubtitle = 'Your ticket is confirmed. Present your QR code at the venue door.';
  } else if (isFreeMode) {
    headerTitle = 'Registration Complete';
    headerSubtitle = "You're officially registered. No payment is required for this event.";
  }

  const steps = STEPS.map((step, index) => {
    let title = step.paid;
    let body = step.paidBody;
    if (isApproved) {
      title = step.confirmed;
      body =
        step.key === 'email' && isIOS
          ? 'Download your ticket as an image or keep this page bookmarked for venue check-in.'
          : step.confirmedBody;
    } else if (isFreeMode) {
      title = step.free;
      body = step.freeBody;
    }
    return {
      ...step,
      title,
      body,
      number: index + 1
    };
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Ticket Header */}
      <div className="text-center mb-8">
        {ticketLoadError === 'not-found' || ticketLoadError === 'error' ? (
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-error-container">
            <ExclamationTriangleIcon className="h-12 w-12 text-error" aria-hidden="true" />
          </div>
        ) : ticketLoadError === 'not-approved' ? (
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-warning-container">
            <ClockIcon className="h-12 w-12 text-on-warning-container" aria-hidden="true" />
          </div>
        ) : (
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-success-container">
            <CheckCircleIcon className="h-12 w-12 text-success" aria-hidden="true" />
          </div>
        )}
        <h1 className="text-3xl font-bold text-on-surface mb-2">{headerTitle}</h1>
        <p className="text-lg text-on-surface-variant">{headerSubtitle}</p>
      </div>

      {/* Loading Skeleton State while verifying token */}
      {isLoadingTicket && !hasVerifiedTicket && (
        <section aria-label="Loading Digital Event Ticket" className="mb-10">
          <TicketCard registration={null} event={null} loading={true} className="mb-6" />
        </section>
      )}

      {/* Unverified / Failed Ticket Status Panel (Strict Gate: Never renders QR or actions) */}
      {!isLoadingTicket && ticketLoadError && (
        <section aria-label="Ticket Status Notice" className="mb-10 max-w-[26.25rem] mx-auto">
          <Card padding="lg" className="text-center space-y-4">
            <div className="flex justify-center">
              <Badge
                tone={
                  ticketLoadError === 'not-approved'
                    ? 'warning'
                    : ticketLoadError === 'error'
                    ? 'neutral'
                    : 'danger'
                }
              >
                <span>
                  {ticketLoadError === 'not-approved'
                    ? 'Pending Organizer Approval'
                    : ticketLoadError === 'error'
                    ? 'Connection Interrupted'
                    : 'Invalid or Cancelled Pass'}
                </span>
              </Badge>
            </div>
            <p className="text-sm text-on-surface-variant">
              {ticketLoadError === 'not-approved'
                ? 'Your digital QR pass and ticket download options will become active automatically once your registration is approved. Watch your inbox for your confirmation email.'
                : ticketLoadError === 'error'
                ? 'Please check your internet connection and retry loading your ticket.'
                : 'We could not find an active approved ticket matching this link. Please check the latest confirmation email in your inbox or contact support below.'}
            </p>
            {ticketLoadError === 'error' && (
              <Button
                variant="filled"
                size="md"
                onClick={loadTicketPass}
                className="w-full min-h-[48px] px-6 text-base font-semibold"
                icon={<ArrowPathIcon className="h-5 w-5" aria-hidden="true" />}
              >
                Retry Loading Ticket
              </Button>
            )}
          </Card>
        </section>
      )}

      {/* Canonical In-App Ticket Card & Actions (Strictly Gated on Verified Approval) */}
      {hasVerifiedTicket && (
        <section aria-label="Digital Event Ticket" className="mb-10">
          <TicketCard
            registration={ticketData?.registration || null}
            event={ticketData?.event || null}
            loading={false}
            className="mb-6"
          />

          {/* Action Area Below the Card */}
          <div className="max-w-[26.25rem] mx-auto text-center space-y-3">
            {canOfferGoogleWallet && (
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

            {canOfferGoogleWallet && cachedWalletPass?.saveUrl && (
              <div className="pt-0.5">
                <a
                  href={cachedWalletPass.saveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-4 py-2 text-sm font-medium text-primary hover:text-primary-hover underline underline-offset-4"
                >
                  <span>Open Google Wallet Pass</span>
                  <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                </a>
              </div>
            )}

            <Button
              variant={canOfferGoogleWallet ? 'outlined' : 'filled'}
              size="md"
              loading={isDownloadingImage}
              onClick={handleSaveAsImage}
              className="w-full min-h-[48px] px-6 text-base font-semibold"
              icon={<ArrowDownTrayIcon className="h-5 w-5" aria-hidden="true" />}
              aria-label="Save your ticket as an image"
            >
              Save as Image
            </Button>

            {canOfferGoogleWallet && walletStatus === 'not-configured' && (
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
              {canOfferGoogleWallet
                ? 'The QR code on this ticket is your primary door credential. Google Wallet pass installation is optional.'
                : 'The QR code on this ticket is your primary door credential. Save it as an image for offline access.'}
            </p>
          </div>
        </section>
      )}

      {/* What Happens Next? */}
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
          {isApproved ? (
            <>
              <li>• Keep your ticket QR code accessible on event day for door check-in</li>
              <li>
                {isIOS
                  ? '• Download your ticket as an image to your photo library for instant offline access at the venue'
                  : '• You can save this pass to Google Wallet or download it as an image'}
              </li>
              <li>• A copy of your confirmation and ticket details has been sent to your email</li>
              <li>• If you have questions about the venue or schedule, contact our support team below</li>
            </>
          ) : isFreeMode ? (
            <>
              <li>• Check your email (including spam folder) for your registration confirmation</li>
              <li>• Keep your registration ID safe - you may need it for support</li>
              <li>• If you don't receive confirmation details within 24 hours, contact support</li>
            </>
          ) : (
            <>
              <li>• Check your email (including spam folder) for verification updates</li>
              <li>• Keep your registration ID safe - you may need it for support</li>
              <li>• If you don't receive an update within 1-2 business days, contact support</li>
              <li>• Your payment proof is securely stored for our records</li>
            </>
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

export default TicketPage;
