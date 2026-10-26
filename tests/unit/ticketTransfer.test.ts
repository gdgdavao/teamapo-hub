import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  docMock,
  runTransactionMock,
  serverTimestampMock,
  recordAuditLogMock,
} = vi.hoisted(() => ({
  docMock: vi.fn((_db: any, ...segments: string[]) => ({
    path: segments.join('/'),
    id: segments[segments.length - 1],
  })),
  runTransactionMock: vi.fn(),
  serverTimestampMock: vi.fn(() => ({ _sentinel: 'serverTimestamp' })),
  recordAuditLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<Record<string, any>>('firebase/firestore');
  return {
    ...actual,
    doc: docMock,
    runTransaction: runTransactionMock,
    serverTimestamp: serverTimestampMock,
  };
});

vi.mock('../../src/config/firebase', () => ({
  db: {},
  functions: {},
  storage: {},
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../src/services/auditLogService', () => ({
  AuditLogService: {
    recordAuditLog: recordAuditLogMock,
  },
}));

import { RegistrationService } from '../../src/services/registrationService';

describe('RegistrationService.transferTicketType', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transfers a promo-discounted General Admission registration to Sponsors and Partners, recalculating pricing and shifting currentSold', async () => {
    const regUpdateCalls: Array<{ ref: any; data: Record<string, any> }> = [];

    runTransactionMock.mockImplementation(async (_db, callback) => {
      const tx = {
        get: vi.fn(async (ref: { path: string }) => {
          if (ref.path === 'registrations/reg-demo-1') {
            return {
              exists: () => true,
              data: () => ({
                id: 'reg-demo-1',
                eventId: 'evt-demo-1',
                ticketTypeId: 'ticket-general',
                quantity: 1,
                originalAmount: 250,
                discountAmount: 250,
                totalAmount: 0,
                promoCode: 'PARTNER-COMP-100',
                promoCodeId: 'promo-partner-1',
                paymentStatus: 'paid',
                attendanceStatus: 'confirmed',
                userDetails: {
                  name: 'Alex Rivera',
                  email: 'alex@example.com',
                },
                pricing: {
                  ticketTypeId: 'ticket-general',
                  ticketTypeName: 'General Admission',
                  originalPrice: 250,
                  discountAmount: 250,
                  currentPrice: 0,
                  discountType: 'promo_code',
                  promoCode: 'PARTNER-COMP-100',
                  promoCodeId: 'promo-partner-1',
                },
              }),
            };
          }
          if (ref.path === 'events/evt-demo-1') {
            return {
              exists: () => true,
              data: () => ({
                id: 'evt-demo-1',
                title: 'Sample Tech Conference',
                ticketTypes: [
                  {
                    id: 'ticket-general',
                    name: 'General Admission',
                    price: 250,
                    currentSold: 72,
                    maxQuantity: 125,
                    isActive: true,
                  },
                  {
                    id: 'ticket-sponsors',
                    name: 'Sponsors and Partners',
                    price: 25000,
                    currentSold: 0,
                    maxQuantity: 45,
                    isActive: true,
                  },
                ],
              }),
            };
          }
          if (ref.path === 'events/evt-demo-1/config/promoCodes') {
            return {
              exists: () => true,
              data: () => ({
                promoCodes: [
                  {
                    id: 'promo-partner-1',
                    code: 'PARTNER-COMP-100',
                    discountType: 'percentage',
                    discountValue: 100,
                    isActive: true,
                  },
                ],
              }),
            };
          }
          return { exists: () => false, data: () => ({}) };
        }),
        update: vi.fn((ref: any, data: Record<string, any>) => {
          regUpdateCalls.push({ ref, data });
        }),
      };
      return callback(tx);
    });

    const result = await RegistrationService.transferTicketType({
      registrationId: 'reg-demo-1',
      targetTicketTypeId: 'ticket-sponsors',
    });

    expect(result.alreadyOnTarget).toBe(false);
    expect(result.previousTicketTypeId).toBe('ticket-general');
    expect(result.targetTicketTypeId).toBe('ticket-sponsors');
    expect(result.targetTicketTypeName).toBe('Sponsors and Partners');
    expect(result.originalAmount).toBe(25000);
    expect(result.discountAmount).toBe(25000);
    expect(result.totalAmount).toBe(0);

    expect(regUpdateCalls).toHaveLength(2);
    const regWrite = regUpdateCalls.find((c) => c.ref.path === 'registrations/reg-demo-1')!;
    expect(regWrite.data.ticketTypeId).toBe('ticket-sponsors');
    expect(regWrite.data.originalAmount).toBe(25000);
    expect(regWrite.data.discountAmount).toBe(25000);
    expect(regWrite.data.totalAmount).toBe(0);
    expect(regWrite.data.pricing).toEqual({
      ticketTypeId: 'ticket-sponsors',
      ticketTypeName: 'Sponsors and Partners',
      originalPrice: 25000,
      currentPrice: 0,
      discountAmount: 25000,
      discountType: 'promo_code',
      promoCode: 'PARTNER-COMP-100',
      promoCodeId: 'promo-partner-1',
    });

    const eventWrite = regUpdateCalls.find(
      (c) => c.ref.path === 'events/evt-demo-1'
    )!;
    expect(eventWrite.data.ticketTypes).toEqual([
      expect.objectContaining({
        id: 'ticket-general',
        currentSold: 71,
      }),
      expect.objectContaining({
        id: 'ticket-sponsors',
        currentSold: 1,
      }),
    ]);

    expect(recordAuditLogMock).toHaveBeenCalledTimes(1);
  });

  it('is idempotent and skips writes when registration is already on target ticket tier', async () => {
    const updateSpy = vi.fn();

    runTransactionMock.mockImplementation(async (_db, callback) => {
      const tx = {
        get: vi.fn(async (ref: { path: string }) => {
          if (ref.path === 'registrations/reg-already') {
            return {
              exists: () => true,
              data: () => ({
                id: 'reg-already',
                eventId: 'evt-demo-1',
                ticketTypeId: 'ticket-sponsors',
                quantity: 1,
                originalAmount: 25000,
                discountAmount: 25000,
                totalAmount: 0,
                pricing: {
                  ticketTypeId: 'ticket-sponsors',
                  ticketTypeName: 'Sponsors and Partners',
                },
              }),
            };
          }
          if (ref.path === 'events/evt-demo-1') {
            return {
              exists: () => true,
              data: () => ({
                id: 'evt-demo-1',
                ticketTypes: [
                  {
                    id: 'ticket-sponsors',
                    name: 'Sponsors and Partners',
                    price: 25000,
                    currentSold: 4,
                    maxQuantity: 45,
                  },
                ],
              }),
            };
          }
          return { exists: () => false, data: () => ({}) };
        }),
        update: updateSpy,
      };
      return callback(tx);
    });

    const result = await RegistrationService.transferTicketType({
      registrationId: 'reg-already',
      targetTicketTypeId: 'ticket-sponsors',
    });

    expect(result.alreadyOnTarget).toBe(true);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(recordAuditLogMock).not.toHaveBeenCalled();
  });

  it('throws when target ticket tier has reached maxQuantity and forceCapacity is false', async () => {
    runTransactionMock.mockImplementation(async (_db, callback) => {
      const tx = {
        get: vi.fn(async (ref: { path: string }) => {
          if (ref.path === 'registrations/reg-1') {
            return {
              exists: () => true,
              data: () => ({
                id: 'reg-1',
                eventId: 'evt-1',
                ticketTypeId: 't-ga',
                quantity: 1,
                attendanceStatus: 'confirmed',
                paymentStatus: 'paid',
              }),
            };
          }
          if (ref.path === 'events/evt-1') {
            return {
              exists: () => true,
              data: () => ({
                id: 'evt-1',
                ticketTypes: [
                  { id: 't-ga', name: 'General Admission', price: 250, currentSold: 10, maxQuantity: 100 },
                  { id: 't-sp', name: 'Sponsors and Partners', price: 25000, currentSold: 45, maxQuantity: 45 },
                ],
              }),
            };
          }
          return { exists: () => false, data: () => ({}) };
        }),
        update: vi.fn(),
      };
      return callback(tx);
    });

    await expect(
      RegistrationService.transferTicketType({
        registrationId: 'reg-1',
        targetTicketTypeId: 't-sp',
      })
    ).rejects.toThrow('Ticket tier "Sponsors and Partners" has reached its maximum capacity');
  });
});
