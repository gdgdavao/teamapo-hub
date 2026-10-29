import { describe, it, expect, vi, beforeEach } from 'vitest';

const { httpsCallableMock, callableFnMock } = vi.hoisted(() => {
  const callableFn = vi.fn();
  return {
    httpsCallableMock: vi.fn(() => callableFn),
    callableFnMock: callableFn,
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

import { EmailService } from '../../src/services/emailService';

describe('EmailService In-Flight Deduplication & Single Authority Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('coalesces concurrent in-flight confirmation email requests for the same recipient', async () => {
    let resolveFn: (val: any) => void;
    const delayedPromise = new Promise((resolve) => {
      resolveFn = resolve;
    });

    callableFnMock.mockReturnValue(delayedPromise);

    const call1 = EmailService.sendConfirmationEmail({
      registrationId: 'reg-1',
      eventId: 'evt-1',
      userEmail: 'user@example.com',
      userName: 'User 1',
    });

    const call2 = EmailService.sendConfirmationEmail({
      registrationId: 'reg-1',
      eventId: 'evt-1',
      userEmail: 'user@example.com',
      userName: 'User 1',
    });

    // Both calls must return promises, but only 1 network callable must have been dispatched
    expect(httpsCallableMock).toHaveBeenCalledTimes(1);
    expect(callableFnMock).toHaveBeenCalledTimes(1);

    resolveFn!({ data: { success: true, message: 'sent', emailId: 'em-1' } });

    const [res1, res2] = await Promise.all([call1, call2]);
    expect(res1).toEqual({ success: true, message: 'sent', emailId: 'em-1' });
    expect(res2).toEqual({ success: true, message: 'sent', emailId: 'em-1' });
  });

  it('coalesces concurrent in-flight payment notifications for the same registration', async () => {
    let resolveFn: (val: any) => void;
    const delayedPromise = new Promise((resolve) => {
      resolveFn = resolve;
    });

    callableFnMock.mockReturnValue(delayedPromise);

    const call1 = EmailService.sendPaymentNotification({
      registrationId: 'reg-1',
      status: 'approved',
      eventTitle: 'DevFest 2026',
      attendeeEmail: 'user@example.com',
      attendeeName: 'User 1',
    });

    const call2 = EmailService.sendPaymentNotification({
      registrationId: 'reg-1',
      status: 'approved',
      eventTitle: 'DevFest 2026',
      attendeeEmail: 'user@example.com',
      attendeeName: 'User 1',
    });

    expect(callableFnMock).toHaveBeenCalledTimes(1);

    resolveFn!({ data: { success: true, message: 'sent', emailId: 'em-2' } });

    const [res1, res2] = await Promise.all([call1, call2]);
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
  });

  it('coalesces concurrent in-flight check-in notifications', async () => {
    let resolveFn: (val: any) => void;
    const delayedPromise = new Promise((resolve) => {
      resolveFn = resolve;
    });

    callableFnMock.mockReturnValue(delayedPromise);

    const call1 = EmailService.sendCheckInNotification({
      registrationId: 'reg-checkin',
      eventId: 'evt-1',
      userEmail: 'checkedin@example.com',
      userName: 'Checked In User',
    });

    const call2 = EmailService.sendCheckInNotification({
      registrationId: 'reg-checkin',
      eventId: 'evt-1',
      userEmail: 'checkedin@example.com',
      userName: 'Checked In User',
    });

    expect(callableFnMock).toHaveBeenCalledTimes(1);

    resolveFn!({ data: { success: true, message: 'sent' } });

    const [res1, res2] = await Promise.all([call1, call2]);
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
  });

  it('coalesces concurrent in-flight certificate notifications', async () => {
    let resolveFn: (val: any) => void;
    const delayedPromise = new Promise((resolve) => {
      resolveFn = resolve;
    });

    callableFnMock.mockReturnValue(delayedPromise);

    const call1 = EmailService.sendCertificateNotification({
      userEmail: 'cert@example.com',
      userName: 'Cert User',
      eventTitle: 'DevFest',
      certificateUrl: 'https://example.com/cert.pdf',
      registrationId: 'reg-cert',
    });

    const call2 = EmailService.sendCertificateNotification({
      userEmail: 'cert@example.com',
      userName: 'Cert User',
      eventTitle: 'DevFest',
      certificateUrl: 'https://example.com/cert.pdf',
      registrationId: 'reg-cert',
    });

    expect(callableFnMock).toHaveBeenCalledTimes(1);

    resolveFn!({ data: { success: true, message: 'sent' } });

    const [res1, res2] = await Promise.all([call1, call2]);
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
  });

  it('coalesces concurrent in-flight feedback request notifications', async () => {
    let resolveFn: (val: any) => void;
    const delayedPromise = new Promise((resolve) => {
      resolveFn = resolve;
    });

    callableFnMock.mockReturnValue(delayedPromise);

    const call1 = EmailService.sendFeedbackRequest({
      eventId: 'evt-1',
      userEmail: 'feedback@example.com',
      userName: 'Feedback User',
      eventTitle: 'DevFest',
      registrationId: 'reg-fb',
    });

    const call2 = EmailService.sendFeedbackRequest({
      eventId: 'evt-1',
      userEmail: 'feedback@example.com',
      userName: 'Feedback User',
      eventTitle: 'DevFest',
      registrationId: 'reg-fb',
    });

    expect(callableFnMock).toHaveBeenCalledTimes(1);

    resolveFn!({ data: { success: true, message: 'sent' } });

    const [res1, res2] = await Promise.all([call1, call2]);
    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
  });

  it('bypasses in-flight deduplication when isResend is true', async () => {
    callableFnMock
      .mockResolvedValueOnce({ data: { success: true, message: 'first' } })
      .mockResolvedValueOnce({ data: { success: true, message: 'second' } });

    const res1 = await EmailService.sendPaymentNotification({
      registrationId: 'reg-resend',
      status: 'approved',
      eventTitle: 'DevFest',
      attendeeEmail: 'resend@example.com',
      attendeeName: 'User',
      isResend: true,
    });

    const res2 = await EmailService.sendPaymentNotification({
      registrationId: 'reg-resend',
      status: 'approved',
      eventTitle: 'DevFest',
      attendeeEmail: 'resend@example.com',
      attendeeName: 'User',
      isResend: true,
    });

    expect(callableFnMock).toHaveBeenCalledTimes(2);
    expect(res1.message).toBe('first');
    expect(res2.message).toBe('second');
  });
});
