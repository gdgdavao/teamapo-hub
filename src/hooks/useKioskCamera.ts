import { useState, useCallback, useEffect } from 'react';

export interface KioskCameraConfig {
  deviceId?: string;
  facingMode: 'user' | 'environment';
}

const CAMERA_PREFIX = 'apohub_kiosk_camera_';

export const getKioskCamera = (eventId: string | undefined): KioskCameraConfig | null => {
  if (!eventId || typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${CAMERA_PREFIX}${eventId}`);
    if (!raw) return null;
    return JSON.parse(raw) as KioskCameraConfig;
  } catch {
    return null;
  }
};

export const setKioskCamera = (eventId: string | undefined, config: KioskCameraConfig): void => {
  if (!eventId || typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${CAMERA_PREFIX}${eventId}`, JSON.stringify(config));
  } catch {
    // Ignore quota issues
  }
};

export const clearKioskCamera = (eventId: string | undefined): void => {
  if (!eventId || typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(`${CAMERA_PREFIX}${eventId}`);
  } catch {
    // Ignore errors
  }
};

export interface UseKioskCameraReturn {
  cameraConfig: KioskCameraConfig | null;
  setCameraConfig: (config: KioskCameraConfig) => void;
  clearCameraConfig: () => void;
}


/**
 * Hook for persisting and retrieving the organizer's pre-configured camera device
 * for Kiosk Mode during an event session.
 */
export const useKioskCamera = (eventId: string | undefined): UseKioskCameraReturn => {
  const [cameraConfig, setCameraConfigState] = useState<KioskCameraConfig | null>(() =>
    getKioskCamera(eventId)
  );

  useEffect(() => {
    const updateFromStorage = () => {
      setCameraConfigState(getKioskCamera(eventId));
    };
    updateFromStorage();
    window.addEventListener('apohub_kiosk_camera_updated', updateFromStorage);
    window.addEventListener('storage', updateFromStorage);
    return () => {
      window.removeEventListener('apohub_kiosk_camera_updated', updateFromStorage);
      window.removeEventListener('storage', updateFromStorage);
    };
  }, [eventId]);

  const setCameraConfig = useCallback(
    (config: KioskCameraConfig) => {
      setKioskCamera(eventId, config);
      setCameraConfigState(config);
      window.dispatchEvent(new CustomEvent('apohub_kiosk_camera_updated'));
    },
    [eventId]
  );

  const clearCameraConfig = useCallback(() => {
    clearKioskCamera(eventId);
    setCameraConfigState(null);
    window.dispatchEvent(new CustomEvent('apohub_kiosk_camera_updated'));
  }, [eventId]);

  return {
    cameraConfig,
    setCameraConfig,
    clearCameraConfig,
  };
};

export default useKioskCamera;
