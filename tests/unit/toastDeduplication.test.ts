import { describe, it, expect, beforeEach, vi } from 'vitest';
import toast, {
  shouldSuppressToast,
  getToastDedupeKey,
  resetToastDeduplication,
} from '../../src/components/UI/toast';

describe('Toast deduplication & double trigger prevention', () => {
  beforeEach(() => {
    resetToastDeduplication();
  });

  it('generates consistent deduplication keys for strings and explicit IDs', () => {
    expect(getToastDedupeKey('success', 'Event saved')).toBe('success:msg:Event saved');
    expect(getToastDedupeKey('error', 'Network failure', { id: 'custom-error-id' })).toBe(
      'error:id:custom-error-id'
    );
    expect(getToastDedupeKey('blank', '  Trimmed notice  ')).toBe('blank:msg:Trimmed notice');
  });

  it('suppresses identical rapid toast triggers within the throttle window', () => {
    // First trigger must NOT be suppressed
    const firstCallSuppressed = shouldSuppressToast('success', 'Event link copied to clipboard.');
    expect(firstCallSuppressed).toBe(false);

    // Immediate duplicate trigger MUST be suppressed
    const secondCallSuppressed = shouldSuppressToast('success', 'Event link copied to clipboard.');
    expect(secondCallSuppressed).toBe(true);

    // Third call within the window also suppressed
    const thirdCallSuppressed = shouldSuppressToast('success', 'Event link copied to clipboard.');
    expect(thirdCallSuppressed).toBe(true);
  });

  it('permits distinct toast messages triggered simultaneously', () => {
    const call1 = shouldSuppressToast('success', 'Profile updated');
    const call2 = shouldSuppressToast('error', 'Failed to update avatar');
    const call3 = shouldSuppressToast('success', 'Other notice');

    expect(call1).toBe(false);
    expect(call2).toBe(false);
    expect(call3).toBe(false);
  });

  it('allows loading to success transition on the same operation id without suppression', () => {
    const opId = 'async-save-event';

    // Step 1: Loading toast triggered
    const loadingSuppressed = shouldSuppressToast('loading', 'Saving event...', { id: opId });
    expect(loadingSuppressed).toBe(false);

    // Step 2: Success toast arrives with the same id
    const successSuppressed = shouldSuppressToast('success', 'Event saved successfully!', {
      id: opId,
    });
    expect(successSuppressed).toBe(false);

    // Step 3: Immediate duplicate success call MUST be suppressed
    const duplicateSuccessSuppressed = shouldSuppressToast('success', 'Event saved successfully!', {
      id: opId,
    });
    expect(duplicateSuccessSuppressed).toBe(true);
  });

  it('returns stable toast ID on suppressed duplicate calls', () => {
    const id1 = toast.success('Registration details saved');
    const id2 = toast.success('Registration details saved');

    // Both invocations return the exact same stable ID (no second toast spawned)
    expect(id1).toBeDefined();
    expect(id2).toBe(id1);
  });

  it('resets deduplication tracker on explicit toast.dismiss', () => {
    const msg = 'Temporary notice';

    expect(shouldSuppressToast('success', msg)).toBe(false);
    expect(shouldSuppressToast('success', msg)).toBe(true); // Suppressed

    // Dismiss the toast
    toast.dismiss('toast-success-Temporary notice');

    // Should now be permitted again immediately
    expect(shouldSuppressToast('success', msg)).toBe(false);
  });

  it('permits identical toast after throttle window expires', async () => {
    vi.useFakeTimers();
    try {
      expect(shouldSuppressToast('error', 'Rate limited')).toBe(false);
      expect(shouldSuppressToast('error', 'Rate limited')).toBe(true);

      // Advance time beyond the 1200ms throttle window
      vi.advanceTimersByTime(1500);

      expect(shouldSuppressToast('error', 'Rate limited')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deduplicates callable toast(message) as well', () => {
    const id1 = toast('System check underway');
    const id2 = toast('System check underway');

    expect(id1).toBeDefined();
    expect(id2).toBe(id1);
  });
});
