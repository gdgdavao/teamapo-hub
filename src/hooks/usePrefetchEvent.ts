import { useCallback, useEffect, useRef } from 'react';
import { EventService } from '../services/eventService';
import { RegistrationService } from '../services/registrationService';

export interface PrefetchEventOptions {
  /** Also prefetch registrations for the event (defaults to true) */
  prefetchRegistrations?: boolean;
  /** Hover debounce delay in ms before triggering prefetch (defaults to 20ms) */
  debounceMs?: number;
}

export interface PrefetchProps {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onFocus?: () => void;
}

/**
 * Checks whether the browser / device is on a constrained connection
 * or has Save-Data enabled. Returns true if prefetching should be skipped.
 * Works across WebKit (Safari), Chrome, Firefox, and mobile browsers.
 */
export function isSaveDataOrSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return true;
  const nav = navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  };

  const conn = nav.connection;
  if (!conn) return false;

  return Boolean(
    conn.saveData ||
    conn.effectiveType === '2g' ||
    conn.effectiveType === 'slow-2g'
  );
}

/**
 * Hook to prefetch event and registration data into client-side cache
 * on user intent (hover with 65ms debounce, focus, or touchstart).
 */
export function usePrefetchEvent(options: PrefetchEventOptions = {}) {
  const { prefetchRegistrations = true, debounceMs = 20 } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const triggerPrefetch = useCallback(
    (eventId?: string, slug?: string) => {
      if (!eventId && !slug) return;
      if (isSaveDataOrSlowConnection()) return;

      if (eventId) {
        EventService.prefetchEvent(eventId, slug);
        if (prefetchRegistrations) {
          RegistrationService.prefetchEventRegistrations(eventId);
        }
      } else if (slug) {
        EventService.prefetchEvent('', slug);
      }
    },
    [prefetchRegistrations]
  );

  const getPrefetchProps = useCallback(
    (eventId?: string, slug?: string): PrefetchProps => {
      return {
        onMouseEnter: () => {
          clearTimer();
          timerRef.current = setTimeout(() => {
            triggerPrefetch(eventId, slug);
          }, debounceMs);
        },
        onMouseLeave: () => {
          clearTimer();
        },
        onTouchStart: () => {
          // Fire immediately on touchstart to get a 100-300ms head start before tap/click
          triggerPrefetch(eventId, slug);
        },
        onFocus: () => {
          clearTimer();
          timerRef.current = setTimeout(() => {
            triggerPrefetch(eventId, slug);
          }, debounceMs);
        },
      };
    },
    [clearTimer, debounceMs, triggerPrefetch]
  );

  return {
    prefetch: triggerPrefetch,
    getPrefetchProps,
  };
}
