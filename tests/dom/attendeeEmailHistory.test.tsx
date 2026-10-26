import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AbilityProvider } from '@casl/react';
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { RegistrationDetailsModal } from '@/pages/events/workspace/tabs/RegistrationDetailsModal';
import { defineAbilityFor } from '@/auth/ability';

const ADMIN = defineAbilityFor({ uid: 'admin-1', role: 'admin', isActive: true });

const getAttendeeEmails = vi.fn();
const resendEmail = vi.fn();

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
}));

vi.mock('@/services/emailService', () => ({
  EmailService: {
    getAttendeeEmails: (...args: unknown[]) => getAttendeeEmails(...args),
    resendEmail: (...args: unknown[]) => resendEmail(...args),
  },
}));

vi.mock('@/services/registrationService', () => ({
  RegistrationService: {
    updateAttendeeDetails: vi.fn().mockResolvedValue(undefined),
    updateRegistrationFormResponses: vi.fn().mockResolvedValue(undefined),
  },
}));

const noop = vi.fn();

const REGISTRATION = {
  id: 'reg_1',
  attendee: {
    id: 'att_1',
    name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    phone: '+63 900 000 0000',
  },
  event: {
    id: 'evt_1',
    title: 'DevFest Davao',
    date: '2026-03-01',
    venue: 'Davao City',
    ticketPrice: 500,
  },
  status: 'approved' as const,
  registrationDate: '2026-02-01',
  paymentStatus: 'pending' as const,
  paymentProof: {
    id: 'proof_1',
    registrationId: 'reg_1',
    verificationStatus: 'pending' as const,
    submittedAt: '2026-02-02T10:00:00.000Z',
    transactionId: 'GCASH-123',
  },
};

const LOG = {
  id: 'log_1',
  type: 'email_confirmation_sent' as const,
  registrationId: 'reg_1',
  eventId: 'evt_1',
  eventTitle: 'DevFest Davao',
  userEmail: 'juan@example.com',
  userName: 'Juan Dela Cruz',
  success: false,
  timestamp: { toDate: () => new Date('2026-02-02T10:00:00.000Z') },
};

const renderModal = () =>
  render(
    <AbilityProvider value={ADMIN}>
      <RegistrationDetailsModal
        isOpen
        onClose={noop}
        registration={REGISTRATION}
        events={[] as never[]}
        onUpdateRegistration={noop}
        onStatusChange={noop}
        onPaymentVerification={noop}
        onDeleteRegistration={noop}
      />
    </AbilityProvider>
  );

describe('RegistrationDetailsModal email history', () => {
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal ??= function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function close() {
      this.open = false;
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getAttendeeEmails.mockResolvedValue([LOG]);
    resendEmail.mockResolvedValue({ success: true, message: 'sent' });
  });

  it('does not query email history until the section is expanded', async () => {
    renderModal();

    expect(screen.getByText('Email History')).toBeInTheDocument();
    expect(screen.queryByText('Registration Confirmation')).not.toBeInTheDocument();
    expect(getAttendeeEmails).not.toHaveBeenCalled();
  });

  it('scopes the query to the event and the registration', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /email history/i }));

    await waitFor(() => expect(getAttendeeEmails).toHaveBeenCalledWith('evt_1', 'reg_1'));
  });

  it('fetches once and reuses the cache on re-expand', async () => {
    renderModal();

    const toggle = screen.getByRole('button', { name: /email history/i });
    await userEvent.click(toggle);
    await waitFor(() => expect(getAttendeeEmails).toHaveBeenCalledTimes(1));

    await userEvent.click(toggle);
    await userEvent.click(toggle);

    await waitFor(() =>
      expect(screen.getByText('Registration Confirmation')).toBeInTheDocument()
    );
    expect(getAttendeeEmails).toHaveBeenCalledTimes(1);
  });

  it('surfaces the send outcome and the friendly type label', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /email history/i }));

    expect(await screen.findByText('Registration Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    // The recipient address also appears on the attendee card, so scope to the
    // history list rather than asserting a global single match.
    expect(
      within(screen.getByRole('list')).getByText(/juan@example\.com/)
    ).toBeInTheDocument();
  });

  it('resends in one click to the attendee\u2019s current email without an override prompt', async () => {
    renderModal();

    await userEvent.click(screen.getByRole('button', { name: /email history/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^resend$/i }));

    await waitFor(() => expect(resendEmail).toHaveBeenCalled());
    const [log, override] = resendEmail.mock.calls[0];
    expect(log.id).toBe('log_1');
    // The log recipient already matches the attendee's current email, so no
    // override is passed and the log is not double-counted as a correction.
    expect(override).toBeUndefined();
  });

  it('refetches history when the modal switches to a different attendee', async () => {
    const OTHER_REGISTRATION = {
      ...REGISTRATION,
      id: 'reg_2',
      attendee: {
        ...REGISTRATION.attendee,
        name: 'Maria Santos',
        email: 'maria@example.com',
      },
    };
    const OTHER_LOG = {
      ...LOG,
      id: 'log_2',
      registrationId: 'reg_2',
      userEmail: 'maria@example.com',
      userName: 'Maria Santos',
    };

    const { rerender } = renderModal();
    await userEvent.click(screen.getByRole('button', { name: /email history/i }));
    expect(await screen.findByText('Registration Confirmation')).toBeInTheDocument();
    expect(getAttendeeEmails).toHaveBeenCalledTimes(1);

    // Switching attendees must discard the previous attendee's cached history:
    // the fetch-once guard would otherwise show reg_1's emails under reg_2.
    getAttendeeEmails.mockResolvedValue([OTHER_LOG]);
    rerender(
      <AbilityProvider value={ADMIN}>
        <RegistrationDetailsModal
          isOpen
          onClose={noop}
          registration={OTHER_REGISTRATION}
          events={[] as never[]}
          onUpdateRegistration={noop}
          onStatusChange={noop}
          onPaymentVerification={noop}
          onDeleteRegistration={noop}
        />
      </AbilityProvider>
    );

    expect(screen.queryByText('Registration Confirmation')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /email history/i }));

    await waitFor(() => expect(getAttendeeEmails).toHaveBeenCalledTimes(2));
    expect(getAttendeeEmails).toHaveBeenLastCalledWith('evt_1', 'reg_2');
    expect(
      await within(screen.getByRole('list')).findByText(/maria@example\.com/)
    ).toBeInTheDocument();
  });

  it('reports an empty history rather than showing a dead list', async () => {
    getAttendeeEmails.mockResolvedValue([]);

    renderModal();
    await userEvent.click(screen.getByRole('button', { name: /email history/i }));

    expect(
      await screen.findByText(/No emails have been sent to juan@example\.com yet/i)
    ).toBeInTheDocument();
  });

  it('no longer offers verification notes on a payment decision', async () => {
    renderModal();

    expect(screen.queryByText(/verification notes/i)).not.toBeInTheDocument();
  });
});