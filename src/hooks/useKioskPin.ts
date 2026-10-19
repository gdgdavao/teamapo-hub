import { useState, useCallback, useEffect } from 'react';

const PIN_PREFIX = 'apohub_kiosk_pin_';

export interface UseKioskPinReturn {
  hasPin: boolean;
  getPin: () => string | null;
  setPin: (pin: string) => void;
  verifyPin: (pin: string) => boolean;
  clearPin: () => void;
}

/**
 * Hook for managing temporary 4-digit PIN in sessionStorage for Kiosk Mode.
 * Scoped per event to prevent cross-event access leaks.
 */
export const useKioskPin = (eventId: string | undefined): UseKioskPinReturn => {
  const storageKey = eventId ? `${PIN_PREFIX}${eventId}` : '';

  const [hasPin, setHasPin] = useState<boolean>(() => {
    if (!storageKey || typeof window === 'undefined') return false;
    try {
      return Boolean(sessionStorage.getItem(storageKey));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') {
      setHasPin(false);
      return;
    }
    const updateFromStorage = () => {
      try {
        setHasPin(Boolean(sessionStorage.getItem(storageKey)));
      } catch {
        setHasPin(false);
      }
    };

    updateFromStorage();
    window.addEventListener('apohub_kiosk_pin_updated', updateFromStorage);
    window.addEventListener('storage', updateFromStorage);
    return () => {
      window.removeEventListener('apohub_kiosk_pin_updated', updateFromStorage);
      window.removeEventListener('storage', updateFromStorage);
    };
  }, [storageKey]);

  const getPin = useCallback((): string | null => {
    if (!storageKey || typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }, [storageKey]);

  const setPin = useCallback(
    (pin: string) => {
      if (!storageKey || typeof window === 'undefined') return;
      try {
        sessionStorage.setItem(storageKey, pin);
        setHasPin(true);
        window.dispatchEvent(new CustomEvent('apohub_kiosk_pin_updated'));
      } catch {
        // Fallback silently if storage quota exceeded
      }
    },
    [storageKey]
  );

  const verifyPin = useCallback(
    (inputPin: string): boolean => {
      if (!storageKey || typeof window === 'undefined') return false;
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (!stored) return false;
        return stored.trim() === inputPin.trim();
      } catch {
        return false;
      }
    },
    [storageKey]
  );

  const clearPin = useCallback(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(storageKey);
      setHasPin(false);
      window.dispatchEvent(new CustomEvent('apohub_kiosk_pin_updated'));
    } catch {
      // Ignore errors
    }
  }, [storageKey]);

  return {
    hasPin,
    getPin,
    setPin,
    verifyPin,
    clearPin,
  };
};

export default useKioskPin;
