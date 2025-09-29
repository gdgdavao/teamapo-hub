import React, { useState, useEffect } from 'react';
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

  // Update pricing when component mounts and every minute for time-limited discounts
  useEffect(() => {
    updatePricings();
    const interval = setInterval(updatePricings, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [ticketTypes]);

  // Update selection when inputs change
  useEffect(() => {
    if (selectedTicketType && quantity > 0) {
      updateSelection();
    }
  }, [selectedTicketType, quantity, appliedPromoCode, ticketPricings]);

  const updatePricings = () => {
    const pricings: Record<string, TicketPricing> = {};
    ticketTypes.forEach(ticket => {
      pricings[ticket.id] = getCurrentTicketPricing(ticket);
    });
    setTicketPricings(pricings);
  };

  const updateSelection = () => {
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
  };

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

  const getAvailableQuantity = (ticketType: TicketType): number => {
    if (!ticketType.maxQuantity) return 10; // Default max
    return Math.max(0, ticketType.maxQuantity - ticketType.currentSold);
  };

  const renderTicketCard = (ticketType: TicketType) => {
    const pricing = ticketPricings[ticketType.id];
    const isSelected = selectedTicketType === ticketType.id;
    const isAvailable = getAvailableQuantity(ticketType) > 0;
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
              {getAvailableQuantity(ticketType)} tickets remaining
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
          <select
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {Array.from({ length: Math.min(10, getAvailableQuantity(ticketTypes.find(t => t.id === selectedTicketType)!)) }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
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
            <div className="flex justify-between">
              <span>
                {ticketTypes.find(t => t.id === selectedTicketType)?.name} × {quantity}
              </span>
              <span>₱{((ticketPricings[selectedTicketType]?.originalPrice || 0) * quantity).toLocaleString()}</span>
            </div>
            
            
            {promoCodeValid && appliedPromoCode && (
              <div className="flex justify-between text-green-600">
                <span>Promo Code ({appliedPromoCode.code})</span>
                <span>-₱{(() => {
                  const ticketType = ticketTypes.find(t => t.id === selectedTicketType);
                  if (!ticketType) return 0;
                  const calc = calculateTicketPricing({ ticketType, quantity, promoCode: appliedPromoCode });
                  return calc.discountAmount.toLocaleString();
                })()}</span>
              </div>
            )}
            
            <hr className="border-gray-300" />
            <div className="flex justify-between font-semibold text-lg">
              <span>Total</span>
              <span>₱{((ticketPricings[selectedTicketType]?.currentPrice || 0) * quantity).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketSelector;
