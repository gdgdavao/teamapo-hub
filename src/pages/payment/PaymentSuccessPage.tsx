import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  CheckCircleIcon,
  EnvelopeIcon,
  TicketIcon
} from '@heroicons/react/24/outline';
import { Card } from '../../components/UI';

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
  const isFreeRegistrationSuccess = location.pathname === '/registration/success';

  const steps = STEPS.map((step, index) => ({
    ...step,
    title: isFreeRegistrationSuccess ? step.free : step.paid,
    body: isFreeRegistrationSuccess ? step.freeBody : step.paidBody,
    number: index + 1
  }));

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