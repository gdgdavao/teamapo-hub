import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TicketIcon, 
  ClockIcon, 
  TagIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';
import { TicketType, PromoCode, TicketPricing } from '../../../types';
import { 
  calculateTicketPricing, 
  getCurrentTicketPricing, 
  formatTimeRemaining, 
  calculateSavingsPercentage,
  validatePromoCode 
} from '../../../utils/pricing';

interface TicketSelectorProps {
  ticketTypes: TicketType[];
  promoCodes?: PromoCode[];
  onSelectionChange: (selection: TicketSelection) => void;
  className?: string;
}

export interface TicketSelection {
  ticketTypeId: string;
  quantity: number;
  promoCode?: string;
  pricing: TicketPricing;
  totalAmount: number;
  originalAmount: number;
  discountAmount: number;
}

const TicketSelector: React.FC<TicketSelectorProps> = ({
  ticketTypes,
  promoCodes = [],
  onSelectionChange,
  className = ''
}) => {
  const [selectedTicketType, setSelectedTicketType] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [promoCode, setPromoCode] = useState<string>('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<PromoCode | undefined>(undefined);
  const [promoCodeValid, setPromoCodeValid] = useState<boolean>(false);
  const [promoCodeError, setPromoCodeError] = useState<string>('');
  const [ticketPricings, setTicketPricings] = useState<Record<string, TicketPricing>>({});

  // Create a stable reference to ticketTypes IDs to prevent infinite loops
  const ticketTypeIds = useMemo(() => ticketTypes.map(t => t.id).join(','), [ticketTypes]);

  // Update pricing when component mounts and every minute for time-limited discounts
  useEffect(() => {
    const updatePricings = () => {
      const pricings: Record<string, TicketPricing> = {};
      ticketTypes.forEach(ticket => {
        pricings[ticket.id] = getCurrentTicketPricing(ticket);
      });
      setTicketPricings(pricings);
    };

    updatePricings();
    const interval = setInterval(updatePricings, 60000); // Update every minute
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketTypeIds]); // Use stable ticketTypeIds instead of ticketTypes

  // Update selection when inputs change
  useEffect(() => {
    if (!selectedTicketType || quantity <= 0) return;

    const ticketType = ticketTypes.find(t => t.id === selectedTicketType);
    if (!ticketType) return;

    const calculation = calculateTicketPricing({
      ticketType,
      quantity,
      promoCode: appliedPromoCode
    });

    const pricing = getCurrentTicketPricing(ticketType);
    if (appliedPromoCode && calculation.promoApplied) {
      pricing.discountType = 'promo_code';
      pricing.promoCode = appliedPromoCode.code;
    }

    const selection: TicketSelection = {
      ticketTypeId: selectedTicketType,
      quantity,
      promoCode: calculation.promoApplied ? appliedPromoCode?.code : undefined,
      pricing,
      totalAmount: calculation.totalAmount,
      originalAmount: calculation.originalPrice * quantity,
      discountAmount: calculation.discountAmount
    };

    onSelectionChange(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketType, quantity, appliedPromoCode, ticketTypeIds]); // Use stable ticketTypeIds

  const handlePromoCodeChange = (code: string) => {
    setPromoCode(code);
    setPromoCodeError('');
    setPromoCodeValid(false);
    setAppliedPromoCode(undefined);
  };

  const handleApplyPromo = () => {
    if (!selectedTicketType) {
      setPromoCodeError('Select a ticket type first');
      setPromoCodeValid(false);
      setAppliedPromoCode(undefined);
      return;
    }

    if (!promoCode) {
      setPromoCodeError('Enter a promo code');
      setPromoCodeValid(false);
      setAppliedPromoCode(undefined);
      return;
    }

    const ticketType = ticketTypes.find(t => t.id === selectedTicketType);
    const found = promoCodes.find(p => p.code.toLowerCase() === promoCode.toLowerCase());
    if (!ticketType) return;

    if (!found) {
      setPromoCodeError('Promo code not found');
      setPromoCodeValid(false);
      setAppliedPromoCode(undefined);
      return;
    }

    const validation = validatePromoCode(found, ticketType);
    if (!validation.isValid) {
      setPromoCodeError(validation.errors[0]);
      setPromoCodeValid(false);
      setAppliedPromoCode(undefined);
      return;
    }

    setAppliedPromoCode(found);
    setPromoCodeValid(true);
    setPromoCodeError('');
  };

  const handleClearPromo = () => {
    setAppliedPromoCode(undefined);
    setPromoCodeValid(false);
    setPromoCodeError('');
  };

  const getAvailableQuantity = (ticketType: TicketType): number | null => {
    if (!ticketType.maxQuantity) return null; // Unlimited
    return Math.max(0, ticketType.maxQuantity - ticketType.currentSold);
  };

  const isUnlimited = (ticketType: TicketType): boolean => {
    return !ticketType.maxQuantity || ticketType.maxQuantity === 0;
  };

  const renderTicketCard = (ticketType: TicketType) => {
    const pricing = ticketPricings[ticketType.id];
    const isSelected = selectedTicketType === ticketType.id;
    const availableQty = getAvailableQuantity(ticketType);
    const isAvailable = availableQty === null || availableQty > 0; // null means unlimited
    const savingsPercentage = calculateSavingsPercentage(pricing?.originalPrice || 0, pricing?.currentPrice || 0);

    return (
      <div
        key={ticketType.id}
        className={`relative border-2 rounded-lg p-6 cursor-pointer transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : isAvailable
            ? 'border-gray-200 hover:border-gray-300'
            : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
        }`}
        onClick={() => isAvailable && setSelectedTicketType(ticketType.id)}
      >

        {/* Ticket Type Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{ticketType.name}</h3>
            {ticketType.description && (
              <p className="text-sm text-gray-600 mt-1">{ticketType.description}</p>
            )}
          </div>
          {isSelected && (
            <CheckCircleIcon className="w-6 h-6 text-blue-500" />
          )}
        </div>

        {/* Pricing */}
        <div className="mb-4">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-gray-900">
              ₱{pricing?.currentPrice?.toLocaleString() || ticketType.price.toLocaleString()}
            </span>
            {pricing && pricing.originalPrice > pricing.currentPrice && (
              <>
                <span className="text-lg text-gray-500 line-through">
                  ₱{pricing.originalPrice.toLocaleString()}
                </span>
                <span className="text-sm font-medium text-green-600">
                  {savingsPercentage}% OFF
                </span>
              </>
            )}
          </div>
          
        </div>

        {/* Benefits */}
        {ticketType.benefits && ticketType.benefits.length > 0 && (
          <div className="mb-4">
            <ul className="space-y-1">
              {ticketType.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center space-x-2 text-sm text-gray-600">
                  <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Availability */}
        <div className="text-sm text-gray-500">
          {isAvailable ? (
            <span>
              {availableQty !== null && (
                <span>{availableQty} tickets remaining</span>
              )}
            </span>
          ) : (
            <span className="text-red-500 font-medium">Sold Out</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Ticket Types */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Ticket Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ticketTypes
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(renderTicketCard)}
        </div>
      </div>

      {/* Quantity Selection */}
      {selectedTicketType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity
          </label>
          {(() => {
            const selectedTicket = ticketTypes.find(t => t.id === selectedTicketType);
            if (!selectedTicket) return null;
            
            const available = getAvailableQuantity(selectedTicket);
            // If unlimited, allow up to 100 tickets, otherwise use available quantity
            const maxQty = available === null ? 100 : available;
            
            return (
              <>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 1 && value <= maxQty) {
                      setQuantity(value);
                    } else if (e.target.value === '') {
                      setQuantity(1);
                    }
                  }}
                  onBlur={(e) => {
                    // Ensure valid value on blur
                    const value = parseInt(e.target.value);
                    if (isNaN(value) || value < 1) {
                      setQuantity(1);
                    } else if (value > maxQty) {
                      setQuantity(maxQty);
                    }
                  }}
                  min="1"
                  max={maxQty}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="1"
                />
                {!isUnlimited(selectedTicket) && (
                  <p className="text-xs text-gray-500 mt-1">{available} tickets remaining</p>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Promo Code */}
      {selectedTicketType && promoCodes.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Promo Code (Optional)
          </label>
          <div className="flex space-x-2">
            <div className="flex-1">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => handlePromoCodeChange(e.target.value.toUpperCase())}
                placeholder="Enter promo code"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  promoCodeError
                    ? 'border-red-300 bg-red-50'
                    : promoCodeValid
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-300'
                }`}
              />
              {promoCodeError && (
                <div className="flex items-center space-x-1 mt-1 text-red-600">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  <span className="text-sm">{promoCodeError}</span>
                </div>
              )}
              {promoCodeValid && appliedPromoCode && (
                <div className="flex items-center space-x-1 mt-1 text-green-600">
                  <CheckCircleIcon className="w-4 h-4" />
                  <span className="text-sm">Promo code applied!</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleApplyPromo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply
            </button>
            {appliedPromoCode && (
              <button
                type="button"
                onClick={handleClearPromo}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pricing Summary */}
      {selectedTicketType && quantity > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Pricing Summary</h4>
          <div className="space-y-2 text-sm">
            {(() => {
              const ticketType = ticketTypes.find(t => t.id === selectedTicketType);
              const summaryCalc = ticketType
                ? calculateTicketPricing({ ticketType, quantity, promoCode: appliedPromoCode })
                : null;
              const originalTotal = summaryCalc
                ? summaryCalc.originalPrice * quantity
                : (ticketPricings[selectedTicketType]?.originalPrice || 0) * quantity;
              const discountAmount = summaryCalc?.discountAmount || 0;
              const totalAmount = summaryCalc?.totalAmount ?? (ticketPricings[selectedTicketType]?.currentPrice || 0) * quantity;

              return (
                <>
                  <div className="flex justify-between">
                    <span>
                      {ticketType?.name} × {quantity}
                    </span>
                    <span>₱{originalTotal.toLocaleString()}</span>
                  </div>
                  
                  {promoCodeValid && appliedPromoCode && discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Promo Code ({appliedPromoCode.code})</span>
                      <span>-₱{discountAmount.toLocaleString()}</span>
                    </div>
                  )}
                  
                  <hr className="border-gray-300" />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>₱{totalAmount.toLocaleString()}</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketSelector;
