import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKioskPin } from '../../src/hooks/useKioskPin';

describe('useKioskPin hook', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('initializes with hasPin as false when no PIN is in sessionStorage', () => {
    const { result } = renderHook(() => useKioskPin('event-123'));
    expect(result.current.hasPin).toBe(false);
    expect(result.current.getPin()).toBeNull();
  });

  it('stores PIN in sessionStorage scoped by eventId', () => {
    const { result } = renderHook(() => useKioskPin('event-123'));

    act(() => {
      result.current.setPin('4321');
    });

    expect(result.current.hasPin).toBe(true);
    expect(result.current.getPin()).toBe('4321');
    expect(sessionStorage.getItem('apohub_kiosk_pin_event-123')).toBe('4321');
  });

  it('does not leak PIN across different events', () => {
    const { result: eventA } = renderHook(() => useKioskPin('event-A'));
    const { result: eventB } = renderHook(() => useKioskPin('event-B'));

    act(() => {
      eventA.current.setPin('1234');
    });

    expect(eventA.current.hasPin).toBe(true);
    expect(eventB.current.hasPin).toBe(false);
    expect(eventA.current.verifyPin('1234')).toBe(true);
    expect(eventB.current.verifyPin('1234')).toBe(false);
  });

  it('correctly verifies PIN and rejects invalid attempts', () => {
    const { result } = renderHook(() => useKioskPin('event-123'));

    act(() => {
      result.current.setPin('9876');
    });

    expect(result.current.verifyPin('9876')).toBe(true);
    expect(result.current.verifyPin(' 9876 ')).toBe(true); // trims whitespace
    expect(result.current.verifyPin('0000')).toBe(false);
    expect(result.current.verifyPin('987')).toBe(false);
  });

  it('clears PIN when clearPin is called', () => {
    const { result } = renderHook(() => useKioskPin('event-123'));

    act(() => {
      result.current.setPin('5555');
    });
    expect(result.current.hasPin).toBe(true);

    act(() => {
      result.current.clearPin();
    });
    expect(result.current.hasPin).toBe(false);
    expect(result.current.getPin()).toBeNull();
    expect(sessionStorage.getItem('apohub_kiosk_pin_event-123')).toBeNull();
  });
});
