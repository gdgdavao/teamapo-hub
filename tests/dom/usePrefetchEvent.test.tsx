import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/services/eventService', () => ({
  EventService: {
    prefetchEvent: vi.fn(),
  },
}));

vi.mock('../../src/services/registrationService', () => ({
  RegistrationService: {
    prefetchEventRegistrations: vi.fn(),
  },
}));

import { usePrefetchEvent } from '../../src/hooks/usePrefetchEvent';
import { EventService } from '../../src/services/eventService';
import { RegistrationService } from '../../src/services/registrationService';

describe('usePrefetchEvent hook (DOM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers prefetch after hover debounce time (65ms)', () => {
    const { result } = renderHook(() => usePrefetchEvent({ debounceMs: 65, prefetchRegistrations: true }));
    const props = result.current.getPrefetchProps('evt-123', 'devfest-slug');

    act(() => {
      props.onMouseEnter();
    });

    // Before debounce completes, services should not have been called
    expect(EventService.prefetchEvent).not.toHaveBeenCalled();
    expect(RegistrationService.prefetchEventRegistrations).not.toHaveBeenCalled();

    // Advance 65ms
    act(() => {
      vi.advanceTimersByTime(65);
    });

    expect(EventService.prefetchEvent).toHaveBeenCalledWith('evt-123', 'devfest-slug');
    expect(RegistrationService.prefetchEventRegistrations).toHaveBeenCalledWith('evt-123');
  });

  it('cancels prefetch if mouse leaves before debounce expires', () => {
    const { result } = renderHook(() => usePrefetchEvent({ debounceMs: 65 }));
    const props = result.current.getPrefetchProps('evt-456');

    act(() => {
      props.onMouseEnter();
    });

    act(() => {
      vi.advanceTimersByTime(30);
      props.onMouseLeave();
      vi.advanceTimersByTime(50);
    });

    expect(EventService.prefetchEvent).not.toHaveBeenCalled();
    expect(RegistrationService.prefetchEventRegistrations).not.toHaveBeenCalled();
  });

  it('triggers prefetch immediately on touchstart without debounce delay', () => {
    const { result } = renderHook(() => usePrefetchEvent({ prefetchRegistrations: true }));
    const props = result.current.getPrefetchProps('evt-touch-789');

    act(() => {
      props.onTouchStart();
    });

    // Fires immediately to get ahead of 100-300ms tap delay
    expect(EventService.prefetchEvent).toHaveBeenCalledWith('evt-touch-789', undefined);
    expect(RegistrationService.prefetchEventRegistrations).toHaveBeenCalledWith('evt-touch-789');
  });

  it('defaults registration prefetch to false when options are omitted', () => {
    const { result } = renderHook(() => usePrefetchEvent());
    const props = result.current.getPrefetchProps('evt-no-regs');

    act(() => {
      props.onTouchStart();
    });

    expect(EventService.prefetchEvent).toHaveBeenCalledWith('evt-no-regs', undefined);
    expect(RegistrationService.prefetchEventRegistrations).not.toHaveBeenCalled();
  });
});
