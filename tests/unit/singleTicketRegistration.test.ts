import { describe, it, expect, vi } from 'vitest';
import { RegistrationService, RegistrationData } from '../../src/services/registrationService';
import { getRegistrationQuantity, getRegistrationTotalAmount } from '../../src/utils/pricing';

// Mock Firebase modular SDK
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  runTransaction: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  increment: vi.fn((n) => n),
  onSnapshot: vi.fn(),
  Timestamp: {
    now: vi.fn(),
    fromDate: vi.fn((d) => d),
  },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

vi.mock('../../src/config/firebase', () => ({
  db: {},
  functions: {},
}));

describe('Single Ticket Per Person Invariant & Pricing', () => {
  it('correctly extracts registration quantity defaulting to 1', () => {
    expect(getRegistrationQuantity({ event: { ticketPrice: 500 } })).toBe(1);
    expect(getRegistrationQuantity({ quantity: 0, event: { ticketPrice: 500 } })).toBe(1);
    expect(getRegistrationQuantity({ quantity: 1, event: { ticketPrice: 500 } })).toBe(1);
    // Legacy support for past multi-ticket records
    expect(getRegistrationQuantity({ quantity: 4, event: { ticketPrice: 500 } })).toBe(4);
  });

  it('computes registration total amount accurately for single ticket', () => {
    const singleRegistration = {
      quantity: 1,
      totalAmount: 350,
      pricing: { currentPrice: 350 },
      event: { ticketPrice: 500 },
    };
    expect(getRegistrationTotalAmount(singleRegistration)).toBe(350);
  });

  it('rejects registration data when quantity is greater than 1 in createPendingRegistration validation', async () => {
    const { getDoc } = await import('firebase/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        isPublished: true,
        registrationStatus: 'open',
        ticketTypes: [
          {
            id: 'tier-1',
            name: 'Standard',
            price: 100,
            maxQuantity: 50,
            currentSold: 0,
          },
        ],
      }),
    } as any);

    const invalidMultiTicketData: RegistrationData = {
      eventId: 'evt-1',
      ticketTypeId: 'tier-1',
      quantity: 2, // Violates single ticket invariant
      userDetails: {
        name: 'Maria Santos',
        email: 'maria@example.com',
      },
      agreeToTerms: true,
      subscribeToUpdates: false,
    };

    await expect(
      RegistrationService.createPendingRegistration(invalidMultiTicketData)
    ).rejects.toThrow(/Only 1 ticket per person is allowed/i);
  });
});
