import { TicketType, PromoCode, TicketPricing, ValidatedPromoDiscount } from '../types';
import { toDateSafe } from './dateUtils';

export type ApplicablePromoCode = PromoCode | ValidatedPromoDiscount;

function isFullPromoCode(promo: ApplicablePromoCode): promo is PromoCode {
  return 'isActive' in promo;
}

export interface PricingCalculationInput {
  ticketType: TicketType;
  quantity?: number;
  promoCode?: ApplicablePromoCode;
  currentDate?: Date;
}

export interface PricingCalculationResult {
  originalPrice: number;
  currentPrice: number;
  discountAmount: number;
  totalAmount: number;
  promoApplied: boolean;
  errors: string[];
}

export interface TicketWindowStatus {
  isOpen: boolean;
  reason?: 'not_started' | 'ended';
  validFromDate: Date | null;
  validUntilDate: Date | null;
}

/**
 * Evaluate whether a ticket type's sales window (`validFrom` .. `validUntil`) is open at `now`.
 * Boundary invariant: when `now >= validUntilDate`, the window is closed (`ended`).
 */
export function getTicketSalesWindowStatus(
  ticket: Pick<TicketType, 'validFrom' | 'validUntil'>,
  now: Date = new Date()
): TicketWindowStatus {
  const validFromDate = toDateSafe(ticket.validFrom);
  const validUntilDate = toDateSafe(ticket.validUntil);
  const nowMs = now.getTime();

  if (validFromDate && nowMs < validFromDate.getTime()) {
    return {
      isOpen: false,
      reason: 'not_started',
      validFromDate,
      validUntilDate,
    };
  }

  if (validUntilDate && nowMs >= validUntilDate.getTime()) {
    return {
      isOpen: false,
      reason: 'ended',
      validFromDate,
      validUntilDate,
    };
  }

  return {
    isOpen: true,
    validFromDate,
    validUntilDate,
  };
}

/**
 * Pure boolean helper checking if a ticket type's sales window is currently open.
 */
export function isTicketWindowOpen(
  ticket: Pick<TicketType, 'validFrom' | 'validUntil'>,
  now: Date = new Date()
): boolean {
  return getTicketSalesWindowStatus(ticket, now).isOpen;
}

/**
 * Calculate the pricing for a ticket including promo code discounts
 */
export function calculateTicketPricing(input: PricingCalculationInput): PricingCalculationResult {
  const { ticketType, quantity = 1, promoCode, currentDate = new Date() } = input;
  const errors: string[] = [];

  // Start with base price
  const originalPrice = ticketType.price;
  let currentPrice = ticketType.price;
  let promoApplied = false;

  // Apply promo code if provided
  if (promoCode) {
    // If a full PromoCode is provided (organizer views / unit tests), validate locally.
    // If a server-validated ValidatedPromoDiscount is provided, the Cloud Function already verified eligibility.
    const promoValidation = isFullPromoCode(promoCode)
      ? validatePromoCode(promoCode, ticketType, currentDate)
      : { isValid: true, errors: [] };

    if (promoValidation.isValid) {
      promoApplied = true;
      
      if (promoCode.discountType === 'percentage') {
        const promoDiscount = (currentPrice * promoCode.discountValue) / 100;
        const maxDiscount = promoCode.maxDiscountAmount || Infinity;
        const actualDiscount = Math.min(promoDiscount, maxDiscount);
        currentPrice = Math.max(0, currentPrice - actualDiscount);
      } else if (promoCode.discountType === 'fixed') {
        const fixedDiscount = Math.min(promoCode.discountValue, currentPrice);
        currentPrice = Math.max(0, currentPrice - fixedDiscount);
      }
    } else {
      errors.push(...promoValidation.errors);
    }
  }

  const totalAmount = currentPrice * quantity;
  const totalOriginalAmount = originalPrice * quantity;
  const totalDiscountAmount = (totalOriginalAmount - totalAmount);

  return {
    originalPrice: originalPrice,
    currentPrice: currentPrice,
    discountAmount: totalDiscountAmount,
    totalAmount: totalAmount,
    promoApplied,
    errors
  };
}

/**
 * Validate if a promo code can be applied
 */
export function validatePromoCode(
  promoCode: PromoCode, 
  ticketType: TicketType, 
  currentDate: Date = new Date()
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if promo code is active
  if (!promoCode.isActive) {
    errors.push('Promo code is not active');
  }

  // Check date validity
  const validFrom = toDateSafe(promoCode.validFrom);
  const validUntil = toDateSafe(promoCode.validUntil);
  
  if (validFrom && currentDate < validFrom) {
    errors.push('Promo code is not yet valid');
  }
  
  if (validUntil && currentDate > validUntil) {
    errors.push('Promo code has expired');
  }

  // Check usage limits
  if (promoCode.maxUses && promoCode.currentUses >= promoCode.maxUses) {
    errors.push('Promo code usage limit exceeded');
  }

  // Check if applicable to this ticket type
  if (promoCode.applicableTicketTypes && 
      promoCode.applicableTicketTypes.length > 0 && 
      !promoCode.applicableTicketTypes.includes(ticketType.id)) {
    errors.push('Promo code is not applicable to this ticket type');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Get the current pricing for a ticket type
 */
export function getCurrentTicketPricing(ticketType: TicketType, currentDate: Date = new Date()): TicketPricing {
  const calculation = calculateTicketPricing({ ticketType, quantity: 1, currentDate });

  return {
    ticketTypeId: ticketType.id,
    originalPrice: calculation.originalPrice,
    currentPrice: calculation.currentPrice,
    discountAmount: calculation.discountAmount,
    discountType: calculation.promoApplied ? 'promo_code' : undefined,
    timeRemaining: undefined
  };
}

/**
 * Format time remaining for time-limited discounts
 */
export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return 'Expired';

  const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else {
    return `${minutes}m remaining`;
  }
}

/**
 * Calculate savings percentage
 */
export function calculateSavingsPercentage(originalPrice: number, currentPrice: number): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
}

/**
 * The slice of a registration these two helpers need. Structural rather than
 * the `Registration` type so the organizers list and the attendee details modal
 * can both call them without importing each other's shapes.
 */
export interface PricedRegistration {
  totalAmount?: number;
  quantity?: number;
  pricing?: { currentPrice?: number };
  event: { ticketPrice?: number };
}

export function getRegistrationQuantity(registration: PricedRegistration): number {
  return typeof registration.quantity === 'number' && registration.quantity > 0
    ? registration.quantity
    : 1;
}

/**
 * What this registration actually costs the attendee, net of promo codes.
 *
 * This is the value Verified Revenue sums, and the value that decides whether a
 * registration is free. Both must agree, which is why it lives here rather than
 * being reimplemented per surface — a free registration has no payment proof to
 * verify, and treating it as paid is what previously made Accept unavailable.
 */
export function getRegistrationTotalAmount(registration: PricedRegistration): number {
  if (typeof registration.totalAmount === 'number') {
    return registration.totalAmount;
  }
  if (typeof registration.pricing?.currentPrice === 'number') {
    return registration.pricing.currentPrice * getRegistrationQuantity(registration);
  }
  return (registration.event.ticketPrice || 0) * getRegistrationQuantity(registration);
}
