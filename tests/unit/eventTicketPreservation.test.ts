import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventService } from '@/services/eventService';
import type { Event, TicketType } from '@/types';

const { docMock, getDocMock, updateDocMock } = vi.hoisted(() => ({
  docMock: vi.fn((_db, collection, id) => ({ path: `${collection}/${id}`, id })),
  getDocMock: vi.fn(),
  updateDocMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<Record<string, any>>('firebase/firestore');
  return {
    ...actual,
    doc: docMock,
    getDoc: getDocMock,
    updateDoc: updateDocMock,
    serverTimestamp: vi.fn(() => ({ seconds: 1234567890 })),
  };
});

vi.mock('@/config/firebase', () => ({
  db: {},
  functions: {},
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('EventService.updateEvent ticket count preservation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves live currentSold from existingEvent when editor submits stale or zero currentSold', async () => {
    const existingTicketTypes: TicketType[] = [
      {
        id: 't-uic',
        name: 'UIC - Partner',
        price: 25000,
        currency: 'PHP',
        maxQuantity: 30,
        currentSold: 30, // Live count in database
        isActive: true,
        sortOrder: 0,
      },
    ];

    const existingEvent: Partial<Event> = {
      id: 'event-1',
      title: 'DevFest Davao 2026',
      ticketTypes: existingTicketTypes,
      currentAttendees: 30,
      maxAttendees: 400,
    };

    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      id: 'event-1',
      data: () => existingEvent,
    });

    // Form submission has stale count (e.g. 29 from when form was opened)
    const staleTicketTypes: TicketType[] = [
      {
        id: 't-uic',
        name: 'UIC - Partner (Updated Name)',
        price: 25000,
        currency: 'PHP',
        maxQuantity: 30,
        currentSold: 29, // Stale!
        isActive: true,
        sortOrder: 0,
      },
    ];

    await EventService.updateEvent('event-1', {
      ticketTypes: staleTicketTypes,
    });

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const updatePayload = updateDocMock.mock.calls[0][1];
    expect(updatePayload.ticketTypes).toHaveLength(1);
    // Verified: preserved the live 30 count, did not clobber with 29
    expect(updatePayload.ticketTypes[0].currentSold).toBe(30);
    expect(updatePayload.ticketTypes[0].name).toBe('UIC - Partner (Updated Name)');
  });
});
