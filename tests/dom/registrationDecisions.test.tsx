import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityProvider } from '@casl/react';
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { RegistrationDetailsModal } from '@/pages/events/workspace/tabs/RegistrationDetailsModal';
import { defineAbilityFor } from '@/auth/ability';

const ADMIN = defineAbilityFor({ uid: 'admin-1', role: 'admin', isActive: true });

const updateRegistrationStatus = vi.fn();
const getLatestPaymentProofByRegistrationId = vi.fn();

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    updateRegistrationStatus: (...args: unknown[]) => updateRegistrationStatus(...args),
    updateAttendeeDetails: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/emailService', () => ({
  EmailService: {
    getAttendeeEmails: vi.fn().mockResolvedValue([]),
    resendEmail: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  },
}));

const noop = vi.fn();

const onStatusChange = vi.fn();
const onPaymentVerification = vi.fn();
const onClose = vi.fn();
const onDeleteRegistration = vi.fn();

const PAID_PROOF = {
  id: 'proof_1',
  registrationId: 'reg_1',
  verificationStatus: 'pending' as const,
  submittedAt: '2026-02-02T10:00:00.000Z',
  transactionId: 'GCASH-123',
};

/** `totalAmount` drives the free/paid split, via getRegistrationTotalAmount. */
const base = {
  id: 'reg_1',
  attendee: { id: 'att_1', name: 'Juan Dela Cruz', email: 'juan@example.com' },
  event: {
    id: 'evt_1',
    title: 'DevFest Davao',
    date: '2026-03-01',
    venue: 'Davao City',
    ticketPrice: 500,
  },
  status: 'pending' as const,
  registrationDate: '2026-02-01',
};

const renderModal = (registration: object) =>
  render(
    <AbilityProvider value={ADMIN}>
      <RegistrationDetailsModal
        isOpen
        onClose={onClose}
        registration={registration as never}
        events={[] as never[]}
        onUpdateRegistration={noop}
        onStatusChange={onStatusChange}
        onPaymentVerification={onPaymentVerification}
        onDeleteRegistration={onDeleteRegistration}
      />
    </AbilityProvider>
  );

describe('RegistrationDetailsModal accept / reject', () => {
  beforeAll(() => {
    // jsdom does not implement the native <dialog> methods Modal drives.
    HTMLDialogElement.prototype.showModal ??= function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function close() {
      this.open = false;
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('paid registration', () => {
    const paidPendingProof = {
      ...base,
      totalAmount: 500,
      paymentStatus: 'pending' as const,
      paymentProof: PAID_PROOF,
    };

    it('accepts registration and payment together', async () => {
      renderModal(paidPendingProof);

      await userEvent.click(screen.getByRole('button', { name: /^accept$/i }));

      await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('reg_1', 'approved'));
      expect(onPaymentVerification).toHaveBeenCalledWith('reg_1', 'approved');
      expect(onClose).toHaveBeenCalled();
    });

    it('rejects registration and payment together', async () => {
      renderModal(paidPendingProof);

      await userEvent.click(screen.getByRole('button', { name: /^reject$/i }));

      await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('reg_1', 'rejected'));
      // Rejecting only the registration would leave an approved record with a
      // failed payment, and the attendee stuck in the awaiting-payment queue.
      expect(onPaymentVerification).toHaveBeenCalledWith('reg_1', 'rejected');
    });

    it('renders the same three buttons as a free registration', () => {
      renderModal(paidPendingProof);

      expect(screen.getByRole('button', { name: /^accept$/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /^reject$/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /delete registration/i })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /approve payment/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /reject payment/i })).not.toBeInTheDocument();
    });
  });

  describe('free registration', () => {
    const freePending = { ...base, totalAmount: 0, paymentStatus: 'pending' as const };

    it('accepts without touching payment verification', async () => {
      renderModal(freePending);

      await userEvent.click(screen.getByRole('button', { name: /^accept$/i }));

      await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('reg_1', 'approved'));
      // RegistrationService already flips paymentStatus to 'paid' for totalAmount 0.
      expect(onPaymentVerification).not.toHaveBeenCalled();
    });

    it('rejects without touching payment verification', async () => {
      renderModal(freePending);

      await userEvent.click(screen.getByRole('button', { name: /^reject$/i }));

      await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('reg_1', 'rejected'));
      expect(onPaymentVerification).not.toHaveBeenCalled();
    });

    it('shows no payment badge at all', () => {
      renderModal(freePending);

      expect(screen.queryByText(/^Payment:/)).not.toBeInTheDocument();
      expect(screen.getByText('NOT REQUIRED')).toBeInTheDocument();
    });
  });

  describe('paid registration with no proof submitted', () => {
    const paidNoProof = { ...base, totalAmount: 500, paymentStatus: 'pending' as const };

    it('still offers Accept, Reject and Delete', () => {
      renderModal(paidNoProof);

      // Payment is a prerequisite for registration, so every registration in the
      // system has proof. Accept is always available.
      expect(screen.getByRole('button', { name: /^accept$/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /^reject$/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /delete registration/i })).toBeEnabled();
    });
  });

  describe('idempotency', () => {
    it('does not re-accept an already accepted registration', async () => {
      renderModal({
        ...base,
        status: 'approved',
        totalAmount: 500,
        paymentStatus: 'paid',
        paymentProof: { ...PAID_PROOF, verificationStatus: 'approved' },
      });

      await userEvent.click(screen.getByRole('button', { name: /^accept$/i }));

      await waitFor(() => expect(onClose).not.toHaveBeenCalled());
      expect(onStatusChange).not.toHaveBeenCalled();
      expect(onPaymentVerification).not.toHaveBeenCalled();
    });

    it('does not re-reject an already rejected registration', async () => {
      renderModal({ ...base, status: 'rejected', totalAmount: 500, paymentStatus: 'failed' });

      await userEvent.click(screen.getByRole('button', { name: /^reject$/i }));

      await waitFor(() => expect(onClose).not.toHaveBeenCalled());
      expect(onStatusChange).not.toHaveBeenCalled();
      expect(onPaymentVerification).not.toHaveBeenCalled();
    });

    it('lets a rejected registration be accepted again once a proof exists', async () => {
      renderModal({
        ...base,
        status: 'rejected',
        totalAmount: 500,
        paymentStatus: 'failed',
        paymentProof: PAID_PROOF,
      });

      await userEvent.click(screen.getByRole('button', { name: /^accept$/i }));

      await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('reg_1', 'approved'));
      expect(onPaymentVerification).toHaveBeenCalledWith('reg_1', 'approved');
    });

    it('still offers Accept on a rejected registration', async () => {
      renderModal({ ...base, status: 'rejected', totalAmount: 500, paymentStatus: 'failed' });

      expect(screen.getByRole('button', { name: /^accept$/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /^reject$/i })).toBeEnabled();
    });
  });

  describe('payment state is derived once', () => {
    it('shows PAID in a success tone for an accepted paid registration', () => {
      renderModal({
        ...base,
        status: 'approved',
        totalAmount: 500,
        paymentStatus: 'paid',
        paymentProof: { ...PAID_PROOF, verificationStatus: 'approved' },
      });

      const pills = screen.getAllByText('PAID');
      expect(pills.length).toBeGreaterThan(0);
      pills.forEach((pill) => expect(pill).toHaveClass('bg-success-container'));
    });

    it('shows a rejected free registration with no payment badge at all', () => {
      // paymentStatus stays 'pending' because rejecting never clears it, but a
      // free registration has no payment to report — so the stale value must
      // not surface as an amber "awaiting payment" warning.
      renderModal({ ...base, status: 'rejected', totalAmount: 0, paymentStatus: 'pending' });

      expect(screen.queryByText(/awaiting proof/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^Payment:/)).not.toBeInTheDocument();
      expect(screen.getByText('Status: REJECTED')).toBeInTheDocument();
    });

    it('shows a rejected paid registration with no proof as REJECTED, not pending', () => {
      renderModal({ ...base, status: 'rejected', totalAmount: 500, paymentStatus: 'pending' });

      expect(screen.queryByText(/awaiting proof/i)).not.toBeInTheDocument();
      expect(screen.getAllByText('REJECTED').length).toBeGreaterThan(0);
    });

    it('shows PAID for a registration marked as paid even if proof is not yet loaded', () => {
      renderModal({
        ...base,
        status: 'pending',
        totalAmount: 500,
        paymentStatus: 'paid',
      });

      const pills = screen.getAllByText('PAID');
      expect(pills.length).toBeGreaterThan(0);
      expect(screen.queryByText(/awaiting proof/i)).not.toBeInTheDocument();
    });

    it('shows AWAITING VERIFICATION for pending proof, never awaiting proof', () => {
      renderModal({
        ...base,
        status: 'pending',
        totalAmount: 500,
        paymentStatus: 'pending',
        paymentProof: PAID_PROOF,
      });

      expect(screen.getByText('AWAITING VERIFICATION')).toBeInTheDocument();
      expect(screen.queryByText(/awaiting proof/i)).not.toBeInTheDocument();
    });
  });

  describe('confirmed registration deletion protection', () => {
    it('disables Delete Registration for confirmed registrations', () => {
      renderModal({
        ...base,
        status: 'confirmed',
        totalAmount: 500,
        paymentStatus: 'paid',
      });

      const deleteBtn = screen.getByRole('button', { name: /delete registration/i });
      expect(deleteBtn).toBeDisabled();
      expect(deleteBtn).toHaveAttribute('title', 'Confirmed registrations cannot be deleted');
    });

    it('disables Delete Registration for attended registrations', () => {
      renderModal({
        ...base,
        status: 'attended',
        totalAmount: 0,
      });

      const deleteBtn = screen.getByRole('button', { name: /delete registration/i });
      expect(deleteBtn).toBeDisabled();
      expect(deleteBtn).toHaveAttribute('title', 'Confirmed registrations cannot be deleted');
    });

    it('disables Delete Registration for paid registrations', () => {
      renderModal({
        ...base,
        status: 'pending',
        paymentStatus: 'paid',
        totalAmount: 500,
      });

      const deleteBtn = screen.getByRole('button', { name: /delete registration/i });
      expect(deleteBtn).toBeDisabled();
      expect(deleteBtn).toHaveAttribute('title', 'Confirmed registrations cannot be deleted');
    });

    it('enables Delete Registration for pending registrations', () => {
      renderModal({
        ...base,
        status: 'pending',
        totalAmount: 0,
      });

      const deleteBtn = screen.getByRole('button', { name: /delete registration/i });
      expect(deleteBtn).toBeEnabled();
    });
  });
});