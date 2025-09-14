import { TicketType, PromoCode, TicketPricing } from '../types';

function toDateSafe(value: any): Date | null {
  try {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object') {
      if (typeof (value as any).toDate === 'function') {
        const d = (value as any).toDate();
        return d instanceof Date ? d : null;
      }
      if (typeof (value as any).seconds === 'number') {
        const seconds = (value as any).seconds as number;
        return new Date(seconds * 1000);
      }
    }
    if (typeof value === 'number') {
      // treat as milliseconds
      return new Date(value);
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d;
    }
  } catch (_e) {
    // ignore and return null
  }
  return null;
}

export interface PricingCalculationInput {
  ticketType: TicketType;
  quantity: number;
  promoCode?: PromoCode;
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

/**
 * Calculate the pricing for a ticket including promo code discounts
 */
export function calculateTicketPricing(input: PricingCalculationInput): PricingCalculationResult {
  const { ticketType, quantity, promoCode, currentDate = new Date() } = input;
  const errors: string[] = [];

  // Start with base price
  const originalPrice = ticketType.price;
  let currentPrice = ticketType.price;
  let discountAmount = 0;
  let promoApplied = false;

  // Apply promo code if provided
  if (promoCode) {
    const promoValidation = validatePromoCode(promoCode, ticketType, currentDate);
    if (promoValidation.isValid) {
      promoApplied = true;
      
      if (promoCode.discountType === 'percentage') {
        const promoDiscount = (currentPrice * promoCode.discountValue) / 100;
        const maxDiscount = promoCode.maxDiscountAmount || Infinity;
        const actualDiscount = Math.min(promoDiscount, maxDiscount);
        discountAmount += actualDiscount;
        currentPrice -= actualDiscount;
      } else if (promoCode.discountType === 'fixed') {
        const fixedDiscount = Math.min(promoCode.discountValue, currentPrice);
        discountAmount += fixedDiscount;
        currentPrice -= fixedDiscount;
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
