import { describe, it, expect } from 'vitest';
import {
  calculateTicketPricing,
  validatePromoCode,
  formatTimeRemaining,
  calculateSavingsPercentage,
} from '../../src/utils/pricing';
import type { TicketType, PromoCode } from '../../src/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const baseTicket: TicketType = {
  id: 'ticket-1',
  name: 'General Admission',
  price: 500,
  quantity: 100,
  sold: 10,
} as TicketType;

const activePromo: PromoCode = {
  id: 'promo-1',
  code: 'SAVE10',
  discountType: 'percentage',
  discountValue: 10,
  isActive: true,
  currentUses: 0,
} as PromoCode;

// ─── calculateTicketPricing ───────────────────────────────────────────────────

describe('calculateTicketPricing', () => {
  it('computes correct total for quantity 2 at base price with no promo', () => {
    const result = calculateTicketPricing({ ticketType: baseTicket, quantity: 2 });
    expect(result.originalPrice).toBe(500);
    expect(result.currentPrice).toBe(500);
    expect(result.totalAmount).toBe(1000);
    expect(result.discountAmount).toBe(0);
    expect(result.promoApplied).toBe(false);
    expect(result.errors).toHaveLength(0);
  });

  it('applies percentage promo correctly for quantity 1', () => {
    const result = calculateTicketPricing({
      ticketType: baseTicket,
      quantity: 1,
      promoCode: activePromo,
    });
    expect(result.currentPrice).toBe(450);
    expect(result.discountAmount).toBe(50);
    expect(result.totalAmount).toBe(450);
    expect(result.promoApplied).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('scales discount by quantity', () => {
    const result = calculateTicketPricing({
      ticketType: baseTicket,
      quantity: 3,
      promoCode: activePromo,
    });
    // currentPrice = 450; total = 450 * 3 = 1350; discount = (500-450)*3 = 150
    expect(result.totalAmount).toBe(1350);
    expect(result.discountAmount).toBe(150);
  });

  it('applies fixed promo correctly', () => {
    const fixed = { ...activePromo, discountType: 'fixed', discountValue: 100 } as PromoCode;
    const result = calculateTicketPricing({ ticketType: baseTicket, quantity: 1, promoCode: fixed });
    expect(result.currentPrice).toBe(400);
    expect(result.discountAmount).toBe(100);
  });

  it('caps fixed discount at ticket price (no negative price)', () => {
    const greedy = { ...activePromo, discountType: 'fixed', discountValue: 9999 } as PromoCode;
    const result = calculateTicketPricing({ ticketType: baseTicket, quantity: 1, promoCode: greedy });
    expect(result.currentPrice).toBe(0);
    expect(result.totalAmount).toBe(0);
  });

  it('respects maxDiscountAmount cap on percentage promos', () => {
    // 50% of 500 = 250, but capped at 100
    const capped = { ...activePromo, discountValue: 50, maxDiscountAmount: 100 } as PromoCode;
    const result = calculateTicketPricing({ ticketType: baseTicket, quantity: 1, promoCode: capped });
    expect(result.currentPrice).toBe(400);
    expect(result.discountAmount).toBe(100);
  });

  it('collects errors when an invalid promo is provided', () => {
    const expired = { ...activePromo, isActive: false } as PromoCode;
    const result = calculateTicketPricing({ ticketType: baseTicket, quantity: 1, promoCode: expired });
    expect(result.promoApplied).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─── validatePromoCode ────────────────────────────────────────────────────────

describe('validatePromoCode', () => {
  it('passes for a fully valid active promo with no restrictions', () => {
    const result = validatePromoCode(activePromo, baseTicket);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects an inactive promo', () => {
    const result = validatePromoCode({ ...activePromo, isActive: false } as PromoCode, baseTicket);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Promo code is not active');
  });

  it('rejects an expired promo', () => {
    const expired = { ...activePromo, validUntil: new Date('2020-01-01') } as PromoCode;
    const result = validatePromoCode(expired, baseTicket, new Date('2026-01-01'));
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/expired/i);
  });

  it('rejects a promo not yet valid', () => {
    const future = { ...activePromo, validFrom: new Date('2030-01-01') } as PromoCode;
    const result = validatePromoCode(future, baseTicket, new Date('2026-01-01'));
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/not yet valid/i);
  });

  it('rejects when usage limit is exhausted', () => {
    const exhausted = { ...activePromo, maxUses: 5, currentUses: 5 } as PromoCode;
    const result = validatePromoCode(exhausted, baseTicket);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/usage limit/i);
  });

  it('rejects when ticket type is not in applicableTicketTypes', () => {
    const restricted = { ...activePromo, applicableTicketTypes: ['ticket-999'] } as PromoCode;
    const result = validatePromoCode(restricted, baseTicket);
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toMatch(/not applicable/i);
  });

  it('passes when ticket type is in applicableTicketTypes', () => {
    const scoped = { ...activePromo, applicableTicketTypes: ['ticket-1'] } as PromoCode;
    const result = validatePromoCode(scoped, baseTicket);
    expect(result.isValid).toBe(true);
  });

  it('accumulates multiple errors simultaneously', () => {
    const broken = {
      ...activePromo,
      isActive: false,
      validUntil: new Date('2020-01-01'),
    } as PromoCode;
    const result = validatePromoCode(broken, baseTicket, new Date('2026-01-01'));
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── formatTimeRemaining ──────────────────────────────────────────────────────

describe('formatTimeRemaining', () => {
  it('shows days and hours', () => {
    expect(formatTimeRemaining(2 * 86_400_000 + 3 * 3_600_000)).toBe('2d 3h remaining');
  });

  it('shows hours and minutes when less than a day', () => {
    expect(formatTimeRemaining(5 * 3_600_000 + 30 * 60_000)).toBe('5h 30m remaining');
  });

  it('shows minutes only when less than an hour', () => {
    expect(formatTimeRemaining(45 * 60_000)).toBe('45m remaining');
  });

  it('returns Expired for zero milliseconds', () => {
    expect(formatTimeRemaining(0)).toBe('Expired');
  });

  it('returns Expired for negative milliseconds', () => {
    expect(formatTimeRemaining(-1000)).toBe('Expired');
  });
});

// ─── calculateSavingsPercentage ───────────────────────────────────────────────

describe('calculateSavingsPercentage', () => {
  it('computes percentage correctly', () => {
    expect(calculateSavingsPercentage(500, 400)).toBe(20);
  });

  it('returns 100 when price is fully discounted', () => {
    expect(calculateSavingsPercentage(500, 0)).toBe(100);
  });

  it('returns 0 when there is no discount', () => {
    expect(calculateSavingsPercentage(500, 500)).toBe(0);
  });

  it('returns 0 when original price is zero (prevents division by zero)', () => {
    expect(calculateSavingsPercentage(0, 0)).toBe(0);
  });
});
