import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  docMock,
  getDocMock,
  updateDocMock,
  serverTimestampMock,
  httpsCallableMock,
  sendPaymentNotificationFnMock,
  sendEmailNotificationMock,
} = vi.hoisted(() => {
  const sendPaymentNotificationFn = vi.fn().mockResolvedValue({ data: { success: true } });
  return {
    docMock: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
    getDocMock: vi.fn(),
    updateDocMock: vi.fn().mockResolvedValue(undefined),
    serverTimestampMock: vi.fn(() => ({ seconds: 1234567890 })),
    httpsCallableMock: vi.fn(() => sendPaymentNotificationFn),
    sendPaymentNotificationFnMock: sendPaymentNotificationFn,
    sendEmailNotificationMock: vi.fn().mockResolvedValue({ success: true }),
  };
});

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<Record<string, any>>('firebase/firestore');
  return {
    ...actual,
    doc: docMock,
    getDoc: getDocMock,
    updateDoc: updateDocMock,
    serverTimestamp: serverTimestampMock,
  };
});

vi.mock('firebase/functions', () => ({
  httpsCallable: httpsCallableMock,
}));

vi.mock('../../src/config/firebase', () => ({
  db: {},
  functions: {},
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/services/emailService', () => ({
  EmailService: {
    sendPaymentNotification: sendEmailNotificationMock,
  },
}));

vi.mock('../../src/services/auditLogService', () => ({
  AuditLogService: {
    recordAuditLog: vi.fn().mockResolvedValue(undefined),
  },
}));

import { RegistrationService } from '../../src/services/registrationService';
import { PaymentService } from '../../src/services/paymentService';

describe('Registration Approval Email Deduplication & Single Authority Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RegistrationService.updateRegistrationStatus', () => {
    it('dispatches exactly 1 approval notification for free registrations', async () => {
      getDocMock
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            eventId: 'evt-1',
            totalAmount: 0,
            registrationStatus: 'pending',
            paymentStatus: 'pending',
            attendeeEmail: 'free@example.com',
            attendeeName: 'Free Attendee',
          }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ title: 'Community Meetup' }),
        });

      await RegistrationService.updateRegistrationStatus('reg-free', 'approved');

      expect(sendEmailNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendEmailNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationId: 'reg-free',
          status: 'approved',
          attendeeEmail: 'free@example.com',
          isFreeRegistration: true,
        })
      );
    });

    it('suppresses approval notification for paid registrations while payment is pending', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          eventId: 'evt-1',
          totalAmount: 500,
          registrationStatus: 'pending',
          paymentStatus: 'pending',
          attendeeEmail: 'paid@example.com',
          attendeeName: 'Paid Attendee',
        }),
      });

      await RegistrationService.updateRegistrationStatus('reg-paid', 'approved');

      // The email must NOT be sent yet — PaymentService.verifyPaymentProof will dispatch it
      // once payment is verified!
      expect(sendEmailNotificationMock).not.toHaveBeenCalled();
    });

    it('dispatches 1 approval notification for paid registrations whose payment is already paid', async () => {
      getDocMock
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            eventId: 'evt-1',
            totalAmount: 500,
            registrationStatus: 'pending',
            paymentStatus: 'paid',
            attendeeEmail: 'paid@example.com',
            attendeeName: 'Paid Attendee',
          }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ title: 'DevFest 2026' }),
        });

      await RegistrationService.updateRegistrationStatus('reg-already-paid', 'approved');

      expect(sendEmailNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendEmailNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationId: 'reg-already-paid',
          status: 'approved',
          attendeeEmail: 'paid@example.com',
          isFreeRegistration: false,
        })
      );
    });

    it('is strictly idempotent: does not re-send notification if registration is already approved', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          eventId: 'evt-1',
          totalAmount: 0,
          registrationStatus: 'approved',
          paymentStatus: 'paid',
          attendeeEmail: 'free@example.com',
          attendeeName: 'Free Attendee',
        }),
      });

      await RegistrationService.updateRegistrationStatus('reg-already-approved', 'approved', 'Updating notes only');

      expect(sendEmailNotificationMock).not.toHaveBeenCalled();
    });

    it('respects sendNotification: false option', async () => {
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          eventId: 'evt-1',
          totalAmount: 0,
          registrationStatus: 'pending',
          paymentStatus: 'pending',
          attendeeEmail: 'free@example.com',
          attendeeName: 'Free Attendee',
        }),
      });

      await RegistrationService.updateRegistrationStatus('reg-free', 'approved', undefined, { sendNotification: false });

      expect(sendEmailNotificationMock).not.toHaveBeenCalled();
    });
  });

  describe('PaymentService.verifyPaymentProof', () => {
    it('dispatches 1 payment approval notification when verifying proof for the first time', async () => {
      getDocMock
        .mockResolvedValueOnce({
          // payment proof doc
          exists: () => true,
          data: () => ({
            registrationId: 'reg-proof',
            eventId: 'evt-1',
            eventTitle: 'DevFest 2026',
            verificationStatus: 'pending',
            attendeeEmail: 'attendee@example.com',
            attendeeName: 'Proof Attendee',
          }),
        })
        .mockResolvedValueOnce({
          // registration doc for wallet token check
          exists: () => true,
          data: () => ({ walletPassToken: 'token-123' }),
        });

      await PaymentService.verifyPaymentProof('proof-1', 'approved', 'admin-uid', 'Admin');

      expect(sendEmailNotificationMock).toHaveBeenCalledTimes(1);
      expect(sendEmailNotificationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationId: 'reg-proof',
          status: 'approved',
          attendeeEmail: 'attendee@example.com',
        })
      );
    });

    it('is strictly idempotent: does not re-send notification if proof is already in target status', async () => {
      getDocMock
        .mockResolvedValueOnce({
          // payment proof doc already approved
          exists: () => true,
          data: () => ({
            registrationId: 'reg-proof',
            eventId: 'evt-1',
            verificationStatus: 'approved',
            attendeeEmail: 'attendee@example.com',
          }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ walletPassToken: 'token-123' }),
        });

      await PaymentService.verifyPaymentProof('proof-1', 'approved', 'admin-uid', 'Admin');

      expect(sendEmailNotificationMock).not.toHaveBeenCalled();
    });

    it('respects sendNotification: false option', async () => {
      getDocMock
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            registrationId: 'reg-proof',
            eventId: 'evt-1',
            verificationStatus: 'pending',
            attendeeEmail: 'attendee@example.com',
          }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({ walletPassToken: 'token-123' }),
        });

      await PaymentService.verifyPaymentProof('proof-1', 'approved', 'admin-uid', 'Admin', { sendNotification: false });

      expect(sendEmailNotificationMock).not.toHaveBeenCalled();
    });
  });
});
