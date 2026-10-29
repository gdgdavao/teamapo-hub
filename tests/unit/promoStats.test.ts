import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getDocMock, getDocsMock } = vi.hoisted(() => ({
  getDocMock: vi.fn(),
  getDocsMock: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, name) => ({ name })),
  doc: vi.fn((_db, ...segments: string[]) => ({ path: segments.join('/') })),
  getDoc: getDocMock,
  getDocs: getDocsMock,
  query: vi.fn((col, ...constraints) => ({ col, constraints })),
  where: vi.fn((field, op, val) => ({ field, op, val })),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: {
    fromDate: (d: Date) => ({ toDate: () => d, seconds: Math.floor(d.getTime() / 1000), nanoseconds: 0 }),
  },
  limit: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

vi.mock('../../src/config/firebase', () => ({
  db: {},
  functions: {},
}));

import { AnalyticsService } from '../../src/services/analyticsService';
import { swrCache } from '../../src/utils/swrCache';

describe('AnalyticsService promo code normalization & activeRegistrations (R1 & R3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swrCache.clear();
  });

  it('resolves all three promo field shapes to the same normalized uppercase code', () => {
    const eventPromoCodes = [
      { id: 'promo-1', code: 'devfest26', discountType: 'percentage', discountValue: 50, isActive: true },
    ];

    const fromTopLevelString = AnalyticsService.resolveAppliedPromo(
      { promoCode: ' devfest26 ', discountAmount: 100 },
      eventPromoCodes
    );
    const fromPromoCodeId = AnalyticsService.resolveAppliedPromo(
      { promoCodeId: 'promo-1', discountAmount: 100 },
      eventPromoCodes
    );
    const fromPricingString = AnalyticsService.resolveAppliedPromo(
      { pricing: { promoCode: 'DevFest26', discountAmount: 100 } },
      eventPromoCodes
    );
    const fromPricingObject = AnalyticsService.resolveAppliedPromo(
      { pricing: { promoCode: { code: 'devfest26' }, discountAmount: 100 } },
      eventPromoCodes
    );

    expect(fromTopLevelString).toEqual({ code: 'DEVFEST26', discount: 100 });
    expect(fromPromoCodeId).toEqual({ code: 'DEVFEST26', discount: 100 });
    expect(fromPricingString).toEqual({ code: 'DEVFEST26', discount: 100 });
    expect(fromPricingObject).toEqual({ code: 'DEVFEST26', discount: 100 });
  });

  it('counts free-event and pending-payment promo redemptions while keeping revenue paid-only', async () => {
    getDocMock.mockImplementation(async (ref: { path: string }) => {
      if (ref.path === 'events/evt-1') {
        return {
          exists: () => true,
          data: () => ({ title: 'DevFest Davao', promoCodes: [] }),
        };
      }
      if (ref.path === 'events/evt-1/config/promoCodes') {
        return {
          exists: () => true,
          data: () => ({
            promoCodes: [
              {
                id: 'p-free',
                code: 'COMMUNITY100',
                name: 'Community Pass',
                discountType: 'percentage',
                discountValue: 100,
                isActive: true,
              },
              {
                id: 'p-half',
                code: 'EARLY50',
                name: 'Early Bird 50%',
                discountType: 'percentage',
                discountValue: 50,
                isActive: true,
              },
            ],
          }),
        };
      }
      return { exists: () => false, data: () => null };
    });

    const mockRegDocs = [
      // 1. Free/complimentary registration with promo (paymentStatus: 'pending' or 'paid' with 0 totalAmount)
      {
        id: 'reg-1',
        data: () => ({
          attendanceStatus: 'registered',
          paymentStatus: 'pending',
          totalAmount: 0,
          discountAmount: 500,
          promoCode: 'community100',
        }),
      },
      // 2. Paid event registration with pending GCash verification + pricing.promoCode object
      {
        id: 'reg-2',
        data: () => ({
          attendanceStatus: 'registered',
          paymentStatus: 'pending',
          totalAmount: 250,
          discountAmount: 250,
          pricing: { promoCode: { code: 'early50' }, discountAmount: 250 },
        }),
      },
      // 3. Paid event registration verified ('paid') + promoCodeId
      {
        id: 'reg-3',
        data: () => ({
          attendanceStatus: 'checked-in',
          paymentStatus: 'paid',
          totalAmount: 250,
          discountAmount: 250,
          promoCodeId: 'p-half',
        }),
      },
      // 4. No-show registration (no promo, paid) -> counts in activeRegistrations
      {
        id: 'reg-4',
        data: () => ({
          attendanceStatus: 'no-show',
          paymentStatus: 'paid',
          totalAmount: 500,
          discountAmount: 0,
        }),
      },
      // 5. Cancelled registration -> excluded from activeRegistrations and promo counts
      {
        id: 'reg-5',
        data: () => ({
          attendanceStatus: 'cancelled',
          paymentStatus: 'refunded',
          totalAmount: 250,
          discountAmount: 250,
          promoCode: 'EARLY50',
        }),
      },
    ];

    getDocsMock.mockImplementation(async (q: { col: { name: string } }) => {
      if (q.col.name === 'registrations') {
        return { docs: mockRegDocs };
      }
      return { docs: [] };
    });

    const stats = await AnalyticsService.getEventStats('evt-1');

    // R3: total docs = 5, activeRegistrations = 4 (excludes cancelled, includes no-show)
    expect(stats.registrations).toBe(5);
    expect(stats.activeRegistrations).toBe(4);
    expect(stats.checkedIn).toBe(1);
    expect(stats.noShows).toBe(1);

    // R1: 3 non-cancelled promo redemptions (1 COMMUNITY100 + 2 EARLY50)
    expect(stats.promoCodeStats.totalUsed).toBe(3);
    expect(stats.promoCodeStats.totalDiscount).toBe(1000); // 500 + 250 + 250

    // Revenue attribution stays strictly paid-only: reg-3 (250 with promo) + reg-4 (500 without promo)
    expect(stats.revenue).toBe(750);
    expect(stats.promoCodeStats.revenueWithPromo).toBe(250);
    expect(stats.promoCodeStats.revenueWithoutPromo).toBe(500);

    const early50 = stats.promoCodeStats.allCodes.find((c) => c.code === 'EARLY50');
    const community100 = stats.promoCodeStats.allCodes.find((c) => c.code === 'COMMUNITY100');
    expect(early50?.usageCount).toBe(2);
    expect(early50?.revenue).toBe(250);
    expect(community100?.usageCount).toBe(1);
    expect(community100?.revenue).toBe(0);
  });

  it('returns empty allCodes and totalUsed = 0 when event has no promo codes or redemptions', async () => {
    getDocMock.mockImplementation(async (ref: { path: string }) => {
      if (ref.path === 'events/evt-empty') {
        return {
          exists: () => true,
          data: () => ({ title: 'No Promo Event' }),
        };
      }
      return { exists: () => false, data: () => null };
    });

    getDocsMock.mockResolvedValue({
      docs: [
        {
          id: 'reg-1',
          data: () => ({
            attendanceStatus: 'registered',
            paymentStatus: 'paid',
            totalAmount: 0,
          }),
        },
      ],
    });

    const stats = await AnalyticsService.getEventStats('evt-empty');
    expect(stats.promoCodeStats.allCodes).toHaveLength(0);
    expect(stats.promoCodeStats.totalUsed).toBe(0);
  });
});
