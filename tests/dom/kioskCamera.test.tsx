import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useKioskCamera,
  getKioskCamera,
  setKioskCamera,
  clearKioskCamera,
} from '../../src/hooks/useKioskCamera';

describe('useKioskCamera and kiosk camera storage helpers', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('initializes with null cameraConfig when nothing is saved in sessionStorage', () => {
    const { result } = renderHook(() => useKioskCamera('event-456'));
    expect(result.current.cameraConfig).toBeNull();
    expect(getKioskCamera('event-456')).toBeNull();
  });

  it('stores and retrieves camera configuration scoped by eventId', () => {
    const { result } = renderHook(() => useKioskCamera('event-456'));

    act(() => {
      result.current.setCameraConfig({
        deviceId: 'camera-webcam-usb-1',
        facingMode: 'user',
      });
    });

    expect(result.current.cameraConfig).toEqual({
      deviceId: 'camera-webcam-usb-1',
      facingMode: 'user',
    });
    expect(getKioskCamera('event-456')).toEqual({
      deviceId: 'camera-webcam-usb-1',
      facingMode: 'user',
    });
  });

  it('isolates camera configurations across different events', () => {
    setKioskCamera('event-1', { deviceId: 'cam-1', facingMode: 'user' });
    setKioskCamera('event-2', { deviceId: 'cam-2', facingMode: 'environment' });

    expect(getKioskCamera('event-1')).toEqual({ deviceId: 'cam-1', facingMode: 'user' });
    expect(getKioskCamera('event-2')).toEqual({ deviceId: 'cam-2', facingMode: 'environment' });
  });

  it('clears camera configuration when clearCameraConfig is called', () => {
    const { result } = renderHook(() => useKioskCamera('event-456'));

    act(() => {
      result.current.setCameraConfig({
        deviceId: 'cam-front',
        facingMode: 'user',
      });
    });
    expect(result.current.cameraConfig).not.toBeNull();

    act(() => {
      result.current.clearCameraConfig();
    });
    expect(result.current.cameraConfig).toBeNull();
    expect(getKioskCamera('event-456')).toBeNull();
  });
});
