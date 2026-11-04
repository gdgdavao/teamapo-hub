import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TicketSelector, { TicketSelection } from '@/pages/registration/components/TicketSelector';
import { EventService } from '@/services/eventService';
import { TicketType, PromoCode } from '@/types';

describe('TicketSelector Single Ticket per Person Contract', () => {
  const mockTickets: TicketType[] = [
    {
      id: 'free-pass',
      name: 'General Admission',
      description: 'Standard access to sessions',
      price: 0,
      currency: 'PHP',
      maxQuantity: 100,
      currentSold: 10,
      isActive: true,
      sortOrder: 0,
    },
    {
      id: 'vip-pass',
      name: 'VIP Admission',
      description: 'VIP seating and workshop access',
      price: 500,
      currency: 'PHP',
      maxQuantity: 50,
      currentSold: 5,
      isActive: true,
      sortOrder: 1,
    },
  ];

  const mockPromoCodes: PromoCode[] = [
    {
      id: 'promo-1',
      code: 'GDG100',
      name: 'GDG Community Discount',
      discountType: 'fixed',
      discountValue: 100,
      currentUses: 0,
      maxUses: 50,
      isActive: true,
      validFrom: new Date('2026-01-01') as any,
      validUntil: new Date('2026-12-31') as any,
      createdBy: 'admin',
      createdAt: new Date('2026-01-01') as any,
      updatedAt: new Date('2026-01-01') as any,
    },
  ];

  it('renders ticket options and NEVER displays a quantity selector', () => {
    const handleSelectionChange = vi.fn();
    render(
      <TicketSelector
        ticketTypes={mockTickets}
        onSelectionChange={handleSelectionChange}
      />
    );

    // Both ticket types are displayed
    expect(screen.getByText('General Admission')).toBeInTheDocument();
    expect(screen.getByText('VIP Admission')).toBeInTheDocument();

    // Strict invariant: No quantity input exists in DOM
    expect(screen.queryByLabelText(/quantity/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/1/i)).not.toBeInTheDocument();
  });

  it('locks quantity strictly to 1 upon ticket selection', async () => {
    const user = userEvent.setup();
    let lastSelection: TicketSelection | null = null;
    const handleSelectionChange = vi.fn((sel: TicketSelection) => {
      lastSelection = sel;
    });

    render(
      <TicketSelector
        ticketTypes={mockTickets}
        onSelectionChange={handleSelectionChange}
      />
    );

    // Select VIP ticket
    await user.click(screen.getByRole('radio', { name: /VIP Admission/i }));

    expect(handleSelectionChange).toHaveBeenCalled();
    expect(lastSelection).not.toBeNull();
    expect(lastSelection!.ticketTypeId).toBe('vip-pass');
    expect(lastSelection!.quantity).toBe(1);
    expect(lastSelection!.originalAmount).toBe(500);
    expect(lastSelection!.totalAmount).toBe(500);

    // Pricing summary displays ticket name cleanly without "× 1"
    expect(screen.getByText('Pricing Summary')).toBeInTheDocument();
    expect(screen.queryByText(/VIP Admission ×/i)).not.toBeInTheDocument();
  });

  it('applies promo code discounts to single ticket correctly', async () => {
    const user = userEvent.setup();
    let lastSelection: TicketSelection | null = null;
    const handleSelectionChange = vi.fn((sel: TicketSelection) => {
      lastSelection = sel;
    });

    render(
      <TicketSelector
        ticketTypes={mockTickets}
        promoCodes={mockPromoCodes}
        onSelectionChange={handleSelectionChange}
      />
    );

    // Select VIP ticket
    await user.click(screen.getByRole('radio', { name: /VIP Admission/i }));

    // Apply promo code
    const promoInput = screen.getByLabelText(/Promo Code/i);
    await user.type(promoInput, 'GDG100');
    await user.click(screen.getByRole('button', { name: /Apply/i }));

    expect(screen.getByText(/Promo code applied!/i)).toBeInTheDocument();
    expect(lastSelection!.quantity).toBe(1);
    expect(lastSelection!.discountAmount).toBe(100);
    expect(lastSelection!.totalAmount).toBe(400);
  });

  it('validates promo codes server-side via EventService.validatePromoCodeRemote when eventId and hasPromoCodes are provided', async () => {
    const user = userEvent.setup();
    let lastSelection: TicketSelection | null = null;
    const handleSelectionChange = vi.fn((sel: TicketSelection) => {
      lastSelection = sel;
    });

    const validateSpy = vi.spyOn(EventService, 'validatePromoCodeRemote').mockResolvedValueOnce({
      valid: true,
      code: 'DISCOUNT20',
      discountType: 'percentage',
      discountValue: 20,
      discountAmount: 100,
      finalPrice: 400,
    });

    render(
      <TicketSelector
        ticketTypes={mockTickets}
        eventId="evt-secure-1"
        hasPromoCodes={true}
        onSelectionChange={handleSelectionChange}
      />
    );

    await user.click(screen.getByRole('radio', { name: /VIP Admission/i }));

    const promoInput = screen.getByLabelText(/Promo Code/i);
    await user.type(promoInput, 'discount20');
    await user.click(screen.getByRole('button', { name: /Apply/i }));

    expect(validateSpy).toHaveBeenCalledWith({
      eventId: 'evt-secure-1',
      code: 'DISCOUNT20',
      ticketTypeId: 'vip-pass',
    });
    expect(await screen.findByText(/Promo code applied!/i)).toBeInTheDocument();
    expect(lastSelection!.promoCode).toBe('DISCOUNT20');
    expect(lastSelection!.discountAmount).toBe(100);
    expect(lastSelection!.totalAmount).toBe(400);

    validateSpy.mockRestore();
  });

  it('hides scarcity counters and sales end deadlines while preserving Sold Out and Not yet on sale gates', () => {
    const handleSelectionChange = vi.fn();
    const ticketsWithScarcityAndWindows: TicketType[] = [
      {
        id: 't-active',
        name: 'Standard Ticket',
        price: 100,
        currency: 'PHP',
        maxQuantity: 50,
        currentSold: 10,
        isActive: true,
        sortOrder: 0,
        validUntil: new Date(Date.now() + 86400000) as any,
      },
      {
        id: 't-sold-out',
        name: 'Sold Out Ticket',
        price: 200,
        currency: 'PHP',
        maxQuantity: 10,
        currentSold: 10,
        isActive: true,
        sortOrder: 1,
      },
      {
        id: 't-future',
        name: 'Early Bird Upcoming',
        price: 50,
        currency: 'PHP',
        isActive: true,
        sortOrder: 2,
        validFrom: new Date(Date.now() + 86400000) as any,
      },
    ];

    render(
      <TicketSelector
        ticketTypes={ticketsWithScarcityAndWindows}
        onSelectionChange={handleSelectionChange}
      />
    );

    // Invariant: Scarcity counts "(40 left)" and "Sales end" must NEVER render on the card
    expect(screen.queryByText(/left\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sales end/i)).not.toBeInTheDocument();

    // Invariant: Functional status gates MUST still render
    expect(screen.getByText('Sold Out')).toBeInTheDocument();
    expect(screen.getByText(/Not yet on sale/i)).toBeInTheDocument();
  });

  it('strictly locks sold-out tickets (30/30) with pointer-events-none, cursor-not-allowed, and refuses selection', async () => {
    const user = userEvent.setup();
    const handleSelectionChange = vi.fn();

    const mixedTickets: TicketType[] = [
      {
        id: 't-sold-out-30',
        name: 'Sold Out Tier',
        price: 150,
        currency: 'PHP',
        maxQuantity: 30,
        currentSold: 30,
        isActive: true,
        sortOrder: 0,
      },
      {
        id: 't-available-50',
        name: 'Available Tier',
        price: 250,
        currency: 'PHP',
        maxQuantity: 50,
        currentSold: 10,
        isActive: true,
        sortOrder: 1,
      },
    ];

    render(
      <TicketSelector
        ticketTypes={mixedTickets}
        onSelectionChange={handleSelectionChange}
      />
    );

    const soldOutRadio = screen.getByRole('radio', { name: /Sold Out Tier.*sold out/i });
    expect(soldOutRadio).toBeDisabled();

    // Verify card wrapper label attributes
    const soldOutCard = soldOutRadio.closest('label');
    expect(soldOutCard).not.toBeNull();
    expect(soldOutCard).toHaveClass('pointer-events-none');
    expect(soldOutCard).toHaveClass('cursor-not-allowed');
    expect(soldOutCard).not.toHaveClass('cursor-pointer');
    expect(soldOutCard).toHaveAttribute('aria-disabled', 'true');

    // Attempting to click sold-out card must NOT select it
    await user.click(soldOutCard!);
    expect(handleSelectionChange).not.toHaveBeenCalled();

    // Available ticket card is active and selectable
    const availableRadio = screen.getByRole('radio', { name: /Available Tier/i });
    expect(availableRadio).not.toBeDisabled();
    const availableCard = availableRadio.closest('label');
    expect(availableCard).toHaveClass('cursor-pointer');
    expect(availableCard).not.toHaveClass('pointer-events-none');

    await user.click(availableRadio);
    expect(handleSelectionChange).toHaveBeenCalledTimes(1);
    expect(handleSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketTypeId: 't-available-50',
        totalAmount: 250,
      })
    );
  });

  it('marks all tickets as unavailable when overall event capacity is reached', () => {
    const handleSelectionChange = vi.fn();
    const tickets: TicketType[] = [
      {
        id: 't-general',
        name: 'General Admission',
        price: 0,
        currency: 'PHP',
        isActive: true,
        sortOrder: 0,
        currentSold: 15,
      },
      {
        id: 't-vip',
        name: 'VIP',
        price: 500,
        currency: 'PHP',
        isActive: true,
        sortOrder: 1,
        currentSold: 15,
      },
    ];

    render(
      <TicketSelector
        ticketTypes={tickets}
        eventMaxAttendees={30}
        eventCurrentAttendees={30}
        onSelectionChange={handleSelectionChange}
      />
    );

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    for (const radio of radios) {
      expect(radio).toBeDisabled();
      const card = radio.closest('label');
      expect(card).toHaveClass('pointer-events-none');
      expect(card).toHaveClass('cursor-not-allowed');
    }
  });
});
