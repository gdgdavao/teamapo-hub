import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  docMock,
  getDocMock,
  getDocsMock,
  deleteDocMock,
  updateDocMock,
  collectionMock,
  queryMock,
  whereMock,
  incrementMock,
  serverTimestampMock,
} = vi.hoisted(() => ({
  docMock: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
  getDocMock: vi.fn(),
  getDocsMock: vi.fn(),
  deleteDocMock: vi.fn(),
  updateDocMock: vi.fn(),
  collectionMock: vi.fn((_db, name) => ({ path: name })),
  queryMock: vi.fn(),
  whereMock: vi.fn(),
  incrementMock: vi.fn((val) => ({ _increment: val })),
  serverTimestampMock: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<Record<string, any>>('firebase/firestore');
  return {
    ...actual,
    doc: docMock,
    getDoc: getDocMock,
    getDocs: getDocsMock,
    deleteDoc: deleteDocMock,
    updateDoc: updateDocMock,
    collection: collectionMock,
    query: queryMock,
    where: whereMock,
    increment: incrementMock,
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

describe('RegistrationService.deleteRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteDocMock.mockResolvedValue(undefined);
    updateDocMock.mockResolvedValue(undefined);
    getDocsMock.mockResolvedValue({ docs: [], empty: true });
  });

  it('rejects deletion when registration is confirmed via registrationStatus', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        eventId: 'evt-1',
        registrationStatus: 'approved',
        paymentStatus: 'pending',
        attendanceStatus: 'pending',
      }),
    });

    await expect(RegistrationService.deleteRegistration('reg-1')).rejects.toThrow(
      'Cannot delete a confirmed registration'
    );
    expect(deleteDocMock).not.toHaveBeenCalled();
  });

  it('rejects deletion when registration is confirmed via paymentStatus paid', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        eventId: 'evt-1',
        paymentStatus: 'paid',
        attendanceStatus: 'pending',
      }),
    });

    await expect(RegistrationService.deleteRegistration('reg-2')).rejects.toThrow(
      'Cannot delete a confirmed registration'
    );
    expect(deleteDocMock).not.toHaveBeenCalled();
  });

  it('rejects deletion when registration has attended (checked-in)', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        eventId: 'evt-1',
        attendanceStatus: 'checked-in',
      }),
    });

    await expect(RegistrationService.deleteRegistration('reg-3')).rejects.toThrow(
      'Cannot delete a confirmed registration'
    );
    expect(deleteDocMock).not.toHaveBeenCalled();
  });

  it('allows deletion of pending registrations and deletes the doc', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        eventId: 'evt-1',
        attendanceStatus: 'pending',
        paymentStatus: 'pending',
        registrationStatus: 'pending',
        ticketTypeId: 'general',
        quantity: 1,
      }),
    });

    // Mock adjustTicketSales internally if called
    vi.spyOn(RegistrationService, 'adjustTicketSales').mockResolvedValue(undefined as any);

    await RegistrationService.deleteRegistration('reg-4');

    expect(deleteDocMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'registrations/reg-4' })
    );
  });

  it('throws an error if registration does not exist', async () => {
    getDocMock.mockResolvedValue({
      exists: () => false,
      data: () => null,
    });

    await expect(RegistrationService.deleteRegistration('reg-not-found')).rejects.toThrow(
      'Registration not found'
    );
  });
});
