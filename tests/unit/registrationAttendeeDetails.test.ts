import { describe, it, expect, vi, beforeEach } from 'vitest';

const { docMock, updateDocMock, serverTimestampMock } = vi.hoisted(() => ({
  docMock: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
  updateDocMock: vi.fn(),
  serverTimestampMock: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<Record<string, any>>('firebase/firestore');
  return {
    ...actual,
    doc: docMock,
    updateDoc: updateDocMock,
    serverTimestamp: serverTimestampMock,
  };
});

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

import { RegistrationService } from '../../src/services/registrationService';

describe('RegistrationService.updateAttendeeDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateDocMock.mockResolvedValue(undefined);
  });

  it('updates attendee details with sanitized strings and lowercase email', async () => {
    await RegistrationService.updateAttendeeDetails('reg-123', {
      name: '  Jane Doe  ',
      email: '  Jane.Doe@EXAMPLE.COM ',
      phone: ' 09123456789 ',
      organization: ' GDG Davao ',
      adminNotes: ' VIP Attendee ',
    });

    expect(docMock).toHaveBeenCalledWith(expect.anything(), 'registrations', 'reg-123');
    expect(updateDocMock).toHaveBeenCalledTimes(1);

    const callArgs = updateDocMock.mock.calls[0];
    const payload = callArgs[1];

    expect(payload['userDetails.name']).toBe('Jane Doe');
    expect(payload['userDetails.email']).toBe('jane.doe@example.com');
    expect(payload['userDetails.phoneNumber']).toBe('09123456789');
    expect(payload['userDetails.organization']).toBe('GDG Davao');
    expect(payload['adminNotes']).toBe('VIP Attendee');
    expect(payload['updatedAt']).toEqual({ seconds: 1234567890, nanoseconds: 0 });

    // Invariant: zero undefined values in payload
    for (const [key, value] of Object.entries(payload)) {
      expect(value, `key ${key} should not be undefined`).not.toBeUndefined();
    }
  });

  it('safely handles empty or missing optional fields without undefined', async () => {
    await RegistrationService.updateAttendeeDetails('reg-456', {
      name: 'John Smith',
      email: 'john@example.com',
      phone: '',
      organization: undefined,
    });

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const payload = updateDocMock.mock.calls[0][1];

    expect(payload['userDetails.name']).toBe('John Smith');
    expect(payload['userDetails.email']).toBe('john@example.com');
    expect(payload['userDetails.phoneNumber']).toBeNull();
    expect(payload['userDetails.organization']).toBeNull();
    expect(payload['adminNotes']).toBeUndefined(); // Should omit key when undefined in params

    // Invariant: zero undefined values in payload
    for (const [key, value] of Object.entries(payload)) {
      expect(value, `key ${key} should not be undefined`).not.toBeUndefined();
    }
  });

  it('propagates error when updateDoc fails', async () => {
    updateDocMock.mockRejectedValueOnce(new Error('Firestore network failure'));

    await expect(
      RegistrationService.updateAttendeeDetails('reg-789', {
        name: 'Fail User',
        email: 'fail@example.com',
      })
    ).rejects.toThrow('Firestore network failure');
  });
});
