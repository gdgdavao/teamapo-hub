import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventService } from '../../src/services/eventService';

const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  doc: vi.fn(() => 'ref'),
  getDoc: (...a: unknown[]) => mockGetDoc(...a)
}));
vi.mock('../../src/config/firebase', () => ({ db: {}, functions: {}, storage: {} }));

describe('EventService.getFeedbackForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the organizer-built fields', async () => {
    const fields = [{ id: 'q1', type: 'text', label: 'Custom', required: true }];
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ fields }) });
    expect((await EventService.getFeedbackForm('e1')).fields).toEqual(fields);
  });

  it('rethrows read failures instead of showing a default form', async () => {
    mockGetDoc.mockRejectedValue(new Error('permission-denied'));
    await expect(EventService.getFeedbackForm('e1')).rejects.toThrow('permission-denied');
  });
});
