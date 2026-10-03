import { describe, it, expect, vi } from 'vitest';
import { EventService } from '../../src/services/eventService';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getCountFromServer: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })) },
  writeBatch: vi.fn(),
  serverTimestamp: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('../../src/config/firebase', () => ({ db: {}, storage: {} }));

vi.mock('../../src/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('Public Directory Removal', () => {
  it('does not expose getUpcomingPublishedEvents on EventService', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((EventService as any).getUpcomingPublishedEvents).toBeUndefined();
  });

  it('keeps single published event lookup by slug intact for /e/:slug registration', () => {
    expect(typeof EventService.getPublishedEventBySlug).toBe('function');
  });
});
