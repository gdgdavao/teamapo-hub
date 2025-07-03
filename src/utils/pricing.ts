import { TicketType, PromoCode, TicketPricing } from '../types';

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
  isEarlyBird: boolean;
  promoApplied: boolean;
  errors: string[];
}

/**
 * Calculate the pricing for a ticket including early bird and promo code discounts
 */
export function calculateTicketPricing(input: PricingCalculationInput): PricingCalculationResult {
  const { ticketType, quantity, promoCode, currentDate = new Date() } = input;
  const errors: string[] = [];

  // Start with base price
  let unitPrice = ticketType.price;
  let discountAmount = 0;
  let isEarlyBird = false;
  let promoApplied = false;

  // Check early bird pricing
  if (ticketType.earlyBirdPrice && ticketType.earlyBirdDeadline) {
    const deadline = ticketType.earlyBirdDeadline.toDate();
    if (currentDate <= deadline) {
      isEarlyBird = true;
      const earlyBirdDiscount = unitPrice - ticketType.earlyBirdPrice;
      discountAmount += earlyBirdDiscount;
      unitPrice = ticketType.earlyBirdPrice;
    }
  }

  const originalPrice = ticketType.price;
  let currentPrice = unitPrice;

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
    isEarlyBird,
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
  const validFrom = promoCode.validFrom.toDate();
  const validUntil = promoCode.validUntil.toDate();
  
  if (currentDate < validFrom) {
    errors.push('Promo code is not yet valid');
  }
  
  if (currentDate > validUntil) {
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
  
  let timeRemaining: number | undefined;
  if (ticketType.earlyBirdDeadline && calculation.isEarlyBird) {
    timeRemaining = ticketType.earlyBirdDeadline.toDate().getTime() - currentDate.getTime();
  }

  return {
    ticketTypeId: ticketType.id,
    originalPrice: calculation.originalPrice,
    currentPrice: calculation.currentPrice,
    discountAmount: calculation.discountAmount,
    discountType: calculation.isEarlyBird ? 'early_bird' : undefined,
    isEarlyBird: calculation.isEarlyBird,
    timeRemaining
  };
}

/**
 * Format time remaining for early bird pricing
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
