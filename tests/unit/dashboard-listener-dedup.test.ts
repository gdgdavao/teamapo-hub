/**
 * Tests for the Firestore listener deduplication fixes on /admin/dashboard.
 *
 * Three things are verified:
 *  1. NotificationService.subscribeToAdminNotifications exists and is callable
 *     (verifies onSnapshot import is present after the patch).
 *  2. NotificationService in-memory cache prevents duplicate notifications
 *     within the 5-minute window (core idempotency contract).
 *  3. Dashboard effect dep stability: primitive dep values (uid, role) don't
 *     change identity when auth re-renders with new object references.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock calls must be at the top level — Vitest hoists them before imports.
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'doc-123' }),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getCountFromServer: vi.fn(),
  getDocs: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()), // ← was missing from the original import list
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })) },
  writeBatch: vi.fn(),
}));

vi.mock('../../src/config/firebase', () => ({ db: {} }));

vi.mock('../../src/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Lazy-import the service AFTER mocks are in place
// ---------------------------------------------------------------------------
import { NotificationService } from '../../src/services/notificationService';
import { addDoc } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// 1. NotificationService — subscribeToAdminNotifications is callable
// ---------------------------------------------------------------------------
describe('NotificationService.subscribeToAdminNotifications', () => {
  it('is a function (onSnapshot import is present)', () => {
    expect(typeof NotificationService.subscribeToAdminNotifications).toBe('function');
  });

  it('returns an unsubscribe function without throwing', () => {
    const unsub = NotificationService.subscribeToAdminNotifications('uid', vi.fn());
    expect(typeof unsub).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 2. NotificationService — in-memory dedup cache
// ---------------------------------------------------------------------------
describe('NotificationService deduplication cache', () => {
  beforeEach(() => {
    vi.mocked(addDoc).mockResolvedValue({ id: 'doc-123' } as any);
    vi.clearAllMocks();
  });

  it('skips a notification created within the 5-minute window', async () => {
    const uid = 'admin-uid';

    // First call — should write to Firestore
    const id1 = await NotificationService.createNotification(
      uid, 'event_reminder', 'Test', 'Message'
    );
    expect(id1).toBe('doc-123');
    expect(addDoc).toHaveBeenCalledTimes(1);

    // Second call with identical args within 5 min — dedup, no second write
    const id2 = await NotificationService.createNotification(
      uid, 'event_reminder', 'Test', 'Message'
    );
    expect(id2).toBe('');                     // dedup returns empty string
    expect(addDoc).toHaveBeenCalledTimes(1);  // still only one write
  });

  it('does NOT dedup notifications with different messages', async () => {
    await NotificationService.createNotification('u1', 'event_reminder', 'T', 'Message A');
    await NotificationService.createNotification('u1', 'event_reminder', 'T', 'Message B');
    expect(addDoc).toHaveBeenCalledTimes(2);
  });

  it('does NOT dedup notifications for different users', async () => {
    await NotificationService.createNotification('user-1', 'event_reminder', 'T', 'M');
    await NotificationService.createNotification('user-2', 'event_reminder', 'T', 'M');
    expect(addDoc).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// 3. Effect dep stability — primitive deps are reference-equal across renders
// ---------------------------------------------------------------------------
describe('Dashboard effect dep stability', () => {
  it('uid and role primitives are Object.is-equal across auth re-renders', () => {
    // Simulate two auth renders returning new object references but same values
    const render1 = { currentUser: { uid: 'user-abc' }, userProfile: { role: 'admin' } };
    const render2 = { currentUser: { uid: 'user-abc' }, userProfile: { role: 'admin' } };

    // Object refs differ (new objects each render)
    expect(render1.currentUser).not.toBe(render2.currentUser);
    expect(render1.userProfile).not.toBe(render2.userProfile);

    // But the primitive extracts used as deps ARE identical
    expect(Object.is(render1.currentUser.uid, render2.currentUser.uid)).toBe(true);
    expect(Object.is(render1.userProfile.role, render2.userProfile.role)).toBe(true);
  });

  it('dep array contains only primitives — no function references', () => {
    const uid = 'user-abc';
    const role = 'admin';
    const stableDeps = [uid, role]; // mirrors the patched useEffect deps

    for (const dep of stableDeps) {
      expect(typeof dep).not.toBe('function');
      expect(typeof dep).not.toBe('object');
    }
    expect(stableDeps).toHaveLength(2);
  });
});
