import React, { useState, useEffect, useMemo } from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { Button, Input } from '../../../components/UI';
import { EventService } from '../../../services/eventService';
import { TicketType, PromoCode, TicketPricing } from '../../../types';
import {
  ApplicablePromoCode,
  calculateTicketPricing,
  getCurrentTicketPricing,
  calculateSavingsPercentage,
  validatePromoCode
} from '../../../utils/pricing';

interface TicketSelectorProps {
  ticketTypes: TicketType[];
  eventId?: string;
  hasPromoCodes?: boolean;
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
  eventId,
  hasPromoCodes = false,
  promoCodes = [],
  onSelectionChange,
  className = ''
}) => {
  const [selectedTicketType, setSelectedTicketType] = useState<string>('');
  const [promoCode, setPromoCode] = useState<string>('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<ApplicablePromoCode | undefined>(undefined);
  const [promoCodeValid, setPromoCodeValid] = useState<boolean>(false);
  const [promoCodeError, setPromoCodeError] = useState<string>('');
  const [isValidatingPromo, setIsValidatingPromo] = useState<boolean>(false);
  const [ticketPricings, setTicketPricings] = useState<Record<string, TicketPricing>>({});

  const showPromoCodeInput = Boolean(hasPromoCodes || promoCodes.length > 0);

  // Create a stable reference to ticketTypes IDs to prevent infinite loops
  const ticketTypeIds = useMemo(() => ticketTypes.map(t => t.id).join(','), [ticketTypes]);

  // Sorted without mutating the prop. `ticketTypes.sort(...)` returned the same
  // array instance, which put a write into the parent's state and made the
  // render order depend on who touched the prop first.
  const sortedTicketTypes = useMemo(
    () => [...ticketTypes].sort((a, b) => a.sortOrder - b.sortOrder),
    [ticketTypes]
  );

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

  // Update selection when selected ticket or promo code changes (strictly 1 ticket per person)
  useEffect(() => {
    if (!selectedTicketType) return;

    const ticketType = ticketTypes.find(t => t.id === selectedTicketType);
    if (!ticketType) return;

    const calculation = calculateTicketPricing({
      ticketType,
      quantity: 1,
      promoCode: appliedPromoCode
    });

    const pricing = getCurrentTicketPricing(ticketType);
    if (appliedPromoCode && calculation.promoApplied) {
      pricing.discountType = 'promo_code';
      pricing.promoCode = appliedPromoCode.code;
    }

    const selection: TicketSelection = {
      ticketTypeId: selectedTicketType,
      quantity: 1,
      promoCode: calculation.promoApplied ? appliedPromoCode?.code : undefined,
      pricing,
      totalAmount: calculation.totalAmount,
      originalAmount: calculation.originalPrice,
      discountAmount: calculation.discountAmount
    };

    onSelectionChange(selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketType, appliedPromoCode, ticketTypeIds]); // Use stable ticketTypeIds

  const handleTicketTypeChange = async (newTicketTypeId: string) => {
    setSelectedTicketType(newTicketTypeId);
    if (appliedPromoCode && eventId) {
      setIsValidatingPromo(true);
      try {
        const result = await EventService.validatePromoCodeRemote({
          eventId,
          code: appliedPromoCode.code,
          ticketTypeId: newTicketTypeId
        });
        if (result.valid && result.code && result.discountType && typeof result.discountValue === 'number') {
          setAppliedPromoCode({
            code: result.code,
            discountType: result.discountType,
            discountValue: result.discountValue,
            maxDiscountAmount: result.maxDiscountAmount
          });
          setPromoCodeValid(true);
          setPromoCodeError('');
        } else {
          setAppliedPromoCode(undefined);
          setPromoCodeValid(false);
          setPromoCodeError(result.message || 'Promo code is not valid for the selected ticket.');
        }
      } finally {
        setIsValidatingPromo(false);
      }
    }
  };

  const handlePromoCodeChange = (code: string) => {
    setPromoCode(code);
    setPromoCodeError('');
    setPromoCodeValid(false);
    setAppliedPromoCode(undefined);
  };

  const handleApplyPromo = async () => {
    if (!selectedTicketType) {
      setPromoCodeError('Select a ticket type first');
      setPromoCodeValid(false);
      setAppliedPromoCode(undefined);
      return;
    }

    const trimmedCode = promoCode.trim();
    if (!trimmedCode) {
      setPromoCodeError('Enter a promo code');
      setPromoCodeValid(false);
      setAppliedPromoCode(undefined);
      return;
    }

    const ticketType = ticketTypes.find(t => t.id === selectedTicketType);
    if (!ticketType) return;

    if (eventId) {
      setIsValidatingPromo(true);
      setPromoCodeError('');
      try {
        const result = await EventService.validatePromoCodeRemote({
          eventId,
          code: trimmedCode,
          ticketTypeId: selectedTicketType
        });

        if (result.valid && result.code && result.discountType && typeof result.discountValue === 'number') {
          setAppliedPromoCode({
            code: result.code,
            discountType: result.discountType,
            discountValue: result.discountValue,
            maxDiscountAmount: result.maxDiscountAmount
          });
          setPromoCodeValid(true);
          setPromoCodeError('');
        } else {
          setAppliedPromoCode(undefined);
          setPromoCodeValid(false);
          setPromoCodeError(result.message || 'Invalid promo code.');
        }
      } finally {
        setIsValidatingPromo(false);
      }
      return;
    }

    const found = promoCodes.find(p => p.code.toLowerCase() === trimmedCode.toLowerCase());
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

  const formatAmount = (amount: number): string => {
    if (amount <= 0) return 'Free';
    return `₱${amount.toLocaleString()}`;
  };

  const renderTicketCard = (ticketType: TicketType) => {
    const pricing = ticketPricings[ticketType.id];
    const isSelected = selectedTicketType === ticketType.id;
    const availableQty = getAvailableQuantity(ticketType);
    const isAvailable = availableQty === null || availableQty > 0; // null means unlimited
    const savingsPercentage = calculateSavingsPercentage(pricing?.originalPrice || 0, pricing?.currentPrice || 0);

    // A real `<input type="radio">` inside the label, hidden rather than
    // replaced. The previous markup put `role="radio"` on the card `<div>` and
    // hand-rolled Enter/Space in `onKeyDown`, which threw away everything the
    // platform gives for free: arrow-key roving within the group, form
    // participation, and the "N of M" position a screen reader announces. A
    // radio group whose arrows do not move the selection is a group, not a set
    // of controls. `sr-only` keeps the card design intact while making the
    // whole card a click target through the label.
    return (
      <label
        key={ticketType.id}
        className={`relative block cursor-pointer rounded-lg border-2 p-6 transition-[border-color,background-color,box-shadow] duration-fast ease-quart ${
          isSelected
            ? 'border-primary bg-primary-container'
            : isAvailable
            ? 'border-outline-variant bg-surface hover:border-outline'
            : 'cursor-not-allowed border-outline-variant bg-surface-container opacity-60'
        }`}
      >
        <input
          type="radio"
          name="ticket-type"
          className="peer sr-only"
          value={ticketType.id}
          checked={isSelected}
          disabled={!isAvailable}
          onChange={() => void handleTicketTypeChange(ticketType.id)}
          aria-label={`${ticketType.name}, ${formatAmount(pricing?.currentPrice ?? ticketType.price)}${
            isAvailable ? '' : ', sold out'
          }`}
        />

        {/* Ticket Type Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-on-surface">{ticketType.name}</h3>
            {ticketType.description && (
              <p className="mt-1 text-base text-on-surface-variant">{ticketType.description}</p>
            )}
          </div>
          {isSelected && (
            <CheckCircleIcon className="w-6 h-6 shrink-0 text-primary animate-pop-in motion-reduce:animate-none" aria-hidden="true" />
          )}
        </div>

        {/* Pricing */}
        <div className="mb-4">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-bold text-on-surface">
              {formatAmount(pricing?.currentPrice ?? ticketType.price)}
            </span>
            {pricing && pricing.originalPrice > pricing.currentPrice && (
              <>
                <span className="text-lg text-on-surface-variant line-through">
                  ₱{pricing.originalPrice.toLocaleString()}
                </span>
                <span className="text-base text-success">
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
                <li key={index} className="flex items-start gap-2 text-base text-on-surface-variant">
                  <CheckCircleIcon className="w-4 h-4 mt-1 shrink-0 text-success" aria-hidden="true" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Availability */}
        {!isAvailable && (
          <div className="text-base text-on-surface-variant">
            <span className="font-medium text-error">Sold Out</span>
          </div>
        )}

        {/* The visible card carries the focus ring, because the control that
            holds focus is the one hidden inside it. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
        />
      </label>
    );
  };

return (
    <div className={`space-y-6 ${className}`}>
      {/* Ticket Types */}
      <div>
        <h3 id="ticket-type-legend" className="text-lg font-semibold text-on-surface mb-4">Select Ticket Type</h3>
        <div
          role="radiogroup"
          aria-labelledby="ticket-type-legend"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {sortedTicketTypes.map(renderTicketCard)}
        </div>
      </div>

      {/* Promo Code */}
      {selectedTicketType && showPromoCodeInput && (
        <div className="space-y-3">
          <Input
            mono
            label="Promo Code (Optional)"
            value={promoCode}
            disabled={isValidatingPromo}
            onChange={(e) => handlePromoCodeChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleApplyPromo();
              }
            }}
            placeholder="Enter promo code"
            error={promoCodeError || undefined}
            aria-describedby={undefined}
          />
          {promoCodeValid && appliedPromoCode && (
            <p role="status" aria-live="polite" className="flex items-center gap-2 text-base text-success">
              <CheckCircleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Promo code applied!</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="tonal"
              loading={isValidatingPromo}
              onClick={() => void handleApplyPromo()}
            >
              Apply
            </Button>
            {appliedPromoCode && (
              <Button type="button" variant="text" onClick={handleClearPromo}>Clear</Button>
            )}
          </div>
        </div>
      )}

      {/* Pricing Summary */}
      {selectedTicketType && (
        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-md">
          <h4 className="font-medium text-on-surface mb-3">Pricing Summary</h4>
          <div className="space-y-2 text-base">
            {(() => {
              const ticketType = ticketTypes.find(t => t.id === selectedTicketType);
              const summaryCalc = ticketType
                ? calculateTicketPricing({ ticketType, quantity: 1, promoCode: appliedPromoCode })
                : null;
              const originalTotal = summaryCalc
                ? summaryCalc.originalPrice
                : (ticketPricings[selectedTicketType]?.originalPrice || 0);
              const discountAmount = summaryCalc?.discountAmount || 0;
              const totalAmount = summaryCalc?.totalAmount ?? (ticketPricings[selectedTicketType]?.currentPrice || 0);

              return (
                <>
                  <div className="flex justify-between gap-3">
                    <span className="min-w-0 max-w-[60%] truncate">
                      {ticketType?.name}
                    </span>
                    <span className="shrink-0 tabular-nums">{formatAmount(originalTotal)}</span>
                  </div>

                  {promoCodeValid && appliedPromoCode && discountAmount > 0 && (
                    <div className="flex justify-between gap-3 text-success">
                      <span className="min-w-0 max-w-[60%] truncate">
                        Promo Code ({appliedPromoCode.code})
                      </span>
                      <span className="shrink-0 tabular-nums">-₱{discountAmount.toLocaleString()}</span>
                    </div>
                  )}

                  <hr className="border-outline-variant" />
                  <div className="flex justify-between gap-3 text-lg font-semibold">
                    <span>Total</span>
                    <span className="shrink-0 tabular-nums">{formatAmount(totalAmount)}</span>
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
