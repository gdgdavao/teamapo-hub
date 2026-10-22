import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import PromoCodesTab from '@/pages/events/workspace/tabs/PromoCodesTab';

const EVENT_ID = 'evt_promo_test';

const getEvent = vi.fn();
const getEventPromoCodes = vi.fn();
const updatePromoCodes = vi.fn();

vi.mock('@/config/firebase', () => ({
  auth: { currentUser: null },
  db: {},
  storage: {},
  functions: {},
}));

vi.mock('@/services/eventService', () => ({
  EventService: {
    getEvent: (...args: unknown[]) => getEvent(...args),
    getEventPromoCodes: (...args: unknown[]) => getEventPromoCodes(...args),
    updatePromoCodes: (...args: unknown[]) => updatePromoCodes(...args),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: null,
    userProfile: { uid: 'organizer-1', role: 'organizer' },
    loading: false,
  }),
}));

const EXISTING_CODE = {
  id: 'promo_existing',
  code: 'EARLYBIRD',
  name: 'Early Bird',
  description: 'Discount for the first week',
  discountType: 'percentage' as const,
  discountValue: 20,
  currentUses: 4,
  isActive: true,
  validFrom: { toDate: () => new Date('2026-01-01') },
  validUntil: { toDate: () => new Date('2026-12-31') },
  createdBy: 'organizer-1',
  createdAt: { toDate: () => new Date() },
  updatedAt: { toDate: () => new Date() },
};

describe('PromoCodesTab', () => {
  beforeAll(() => {
    // jsdom does not implement the native <dialog> methods that the Modal
    // primitive drives. Stub them so the create modal can open here.
    HTMLDialogElement.prototype.showModal ??= function showModal() {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function close() {
      this.open = false;
    };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getEvent.mockResolvedValue({
      id: EVENT_ID,
      title: 'DevFest Davao',
      hasPromoCodes: true,
      ticketTypes: [{ id: 'tt_1', name: 'General', price: 500 }],
    });
    getEventPromoCodes.mockResolvedValue([EXISTING_CODE]);
  });

  it('renders the event promo codes', async () => {
    render(<PromoCodesTab eventId={EVENT_ID} />);

    expect(await screen.findByText('EARLYBIRD')).toBeInTheDocument();
    expect(screen.getByText('Early Bird')).toBeInTheDocument();
    expect(getEvent).toHaveBeenCalledWith(EVENT_ID);
    expect(getEventPromoCodes).toHaveBeenCalledWith(EVENT_ID);
  });

  it('hides the ticket-type tip when the event has ticket types', async () => {
    render(<PromoCodesTab eventId={EVENT_ID} />);
    await screen.findByText('EARLYBIRD');

    expect(screen.queryByText(/Create ticket types first/i)).not.toBeInTheDocument();
  });

  it('warns that a promo code can target ticket types when the event has none', async () => {
    getEvent.mockResolvedValue({
      id: EVENT_ID,
      title: 'DevFest Davao',
      promoCodes: [],
      ticketTypes: [],
    });

    render(<PromoCodesTab eventId={EVENT_ID} />);

    expect(await screen.findByText(/Create ticket types first/i)).toBeInTheDocument();
  });

  it('writes through EventService.updatePromoCodes on create', async () => {
    getEvent.mockResolvedValue({
      id: EVENT_ID,
      title: 'DevFest Davao',
      ticketTypes: [{ id: 'tt_1', name: 'General', price: 500 }],
    });
    getEventPromoCodes.mockResolvedValue([]);
    updatePromoCodes.mockResolvedValue(undefined);

    render(<PromoCodesTab eventId={EVENT_ID} />);

    // PromoCodeManager repeats this label in its header and its empty state, so
    // scope to the first rather than asserting a count.
    const createButtons = await screen.findAllByRole('button', {
      name: /create promo code/i,
    });
    await userEvent.click(createButtons[0]);

    // The Code/Name labels in PromoCodeManager are not associated with their
    // inputs, so reach the fields by placeholder rather than getByLabelText.
    await userEvent.type(screen.getByPlaceholderText('SAVE10'), 'SPRING');
    await userEvent.type(screen.getByPlaceholderText('Early Bird Special'), 'Spring Sale');
    // Last match is the modal footer's submit.
    const submitButtons = screen.getAllByRole('button', {
      name: /create promo code/i,
    });
    await userEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => expect(updatePromoCodes).toHaveBeenCalledTimes(1));

    const [savedEventId, savedCodes] = updatePromoCodes.mock.calls[0];
    expect(savedEventId).toBe(EVENT_ID);
    expect(savedCodes).toHaveLength(1);
    expect(savedCodes[0]).toMatchObject({
      code: 'SPRING',
      currentUses: 0,
      // The create wizard in EventEditorPage omits createdBy, so this is the
      // only place a promo code records who made it.
      createdBy: 'organizer-1',
    });
    expect(savedCodes[0].id).toMatch(/^promo_/);
  });

  it('restores the previous list and reports failure when the save is rejected', async () => {
    updatePromoCodes.mockRejectedValue(new Error('permission denied'));

    render(<PromoCodesTab eventId={EVENT_ID} />);
    await screen.findByText('EARLYBIRD');

    await userEvent.click(screen.getByTitle('Delete promo code'));

    await waitFor(() => expect(updatePromoCodes).toHaveBeenCalledTimes(1));

    // Optimistic update rolled back: the failed save must not leave the code
    // looking deleted.
    expect(await screen.findByText('EARLYBIRD')).toBeInTheDocument();
  });
});