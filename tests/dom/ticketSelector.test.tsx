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
});
