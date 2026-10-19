import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KioskSetupModal } from '../../src/components/KioskSetupModal';

describe('KioskSetupModal Component (DOM)', () => {
  const defaultProps = {
    open: true,
    eventId: 'event-kiosk-test-123',
    onLaunch: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();

    // Mock navigator.mediaDevices for jsdom
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockImplementation(() => {
          const track = {
            stop: vi.fn(),
            enabled: true,
            readyState: 'live',
            getSettings: () => ({ deviceId: 'dev-1' }),
          };
          return Promise.resolve({
            getTracks: () => [track],
            getVideoTracks: () => [track],
          });
        }),
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            kind: 'videoinput',
            deviceId: 'dev-1',
            label: 'FaceTime HD Camera',
          },
        ]),
      },
    });

    // Mock HTMLMediaElement methods
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  it('renders the station onboarding setup modal', async () => {
    render(<KioskSetupModal {...defaultProps} />);

    expect(screen.getByText('Setup Kiosk Station')).toBeInTheDocument();
    expect(screen.getByText('Station Onboarding')).toBeInTheDocument();
    expect(screen.getByText('Camera Setup & Framing')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Camera Ready')).toBeInTheDocument();
    });
  });

  it('supports typing PIN digits using physical keyboard and updates indicator', async () => {
    render(<KioskSetupModal {...defaultProps} />);

    // Initially 0 digits entered
    expect(screen.getByLabelText('0 of 4 digits entered')).toBeInTheDocument();

    // Type 1, 2, 3
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: '3' });

    expect(screen.getByLabelText('3 of 4 digits entered')).toBeInTheDocument();

    // Type 4th digit
    fireEvent.keyDown(window, { key: '4' });
    expect(screen.getByLabelText('4 of 4 digits entered')).toBeInTheDocument();

    // Additional digits are ignored when 4 digits are already entered
    fireEvent.keyDown(window, { key: '5' });
    expect(screen.getByLabelText('4 of 4 digits entered')).toBeInTheDocument();
  });

  it('supports Backspace key to remove previously typed digits', async () => {
    render(<KioskSetupModal {...defaultProps} />);

    fireEvent.keyDown(window, { key: '9' });
    fireEvent.keyDown(window, { key: '8' });
    expect(screen.getByLabelText('2 of 4 digits entered')).toBeInTheDocument();

    // Backspace once
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(screen.getByLabelText('1 of 4 digits entered')).toBeInTheDocument();

    // Backspace again
    fireEvent.keyDown(window, { key: 'Backspace' });
    expect(screen.getByLabelText('0 of 4 digits entered')).toBeInTheDocument();
  });

  it('launches kiosk on Enter keypress when 4 digits are entered', async () => {
    render(<KioskSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Camera Ready')).toBeInTheDocument();
    });

    // Enter 4 digits
    fireEvent.keyDown(window, { key: '5' });
    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: '7' });
    fireEvent.keyDown(window, { key: '8' });

    // Press Enter to submit
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(defaultProps.onLaunch).toHaveBeenCalledTimes(1);
    expect(defaultProps.onLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        pin: '5678',
        facingMode: 'user',
        // Truth read-back: the launch payload records the deviceId actually
        // negotiated by the engine (the initial preview opens on the browser's
        // site-default camera), so kiosk mode re-opens the exact lens that
        // streamed in the preview.
        deviceId: 'dev-1',
      })
    );
  });

  it('calls onCancel on Escape keypress', async () => {
    render(<KioskSetupModal {...defaultProps} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
  });

  it('supports on-screen keypad clicks alongside keyboard', async () => {
    render(<KioskSetupModal {...defaultProps} />);

    const btn1 = screen.getByRole('button', { name: 'Digit 1' });
    const btn2 = screen.getByRole('button', { name: 'Digit 2' });
    const backspaceBtn = screen.getByRole('button', { name: 'Backspace' });

    fireEvent.click(btn1);
    fireEvent.click(btn2);
    expect(screen.getByLabelText('2 of 4 digits entered')).toBeInTheDocument();

    fireEvent.click(backspaceBtn);
    expect(screen.getByLabelText('1 of 4 digits entered')).toBeInTheDocument();
  });

  it('preserves typed PIN when switching camera devices', async () => {
    // Provide multiple devices so Select dropdown is rendered
    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { kind: 'videoinput', deviceId: 'dev-1', label: 'FaceTime HD Camera' } as MediaDeviceInfo,
      { kind: 'videoinput', deviceId: 'dev-iphone', label: 'iPhone Camera' } as MediaDeviceInfo,
    ]);

    render(<KioskSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Camera Ready')).toBeInTheDocument();
    });

    // Enter 3 digits
    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '2' });
    fireEvent.keyDown(window, { key: '3' });
    expect(screen.getByLabelText('3 of 4 digits entered')).toBeInTheDocument();

    // Find and change the camera select dropdown
    const select = await screen.findByLabelText(/Active Camera Device/i);
    fireEvent.change(select, { target: { value: 'dev-iphone' } });

    // PIN must NOT be erased by camera switch
    expect(screen.getByLabelText('3 of 4 digits entered')).toBeInTheDocument();
  });

  it('reuses active live track when selected device matches currently streaming camera', async () => {
    const mockTrack = {
      stop: vi.fn(),
      enabled: true,
      readyState: 'live',
      getSettings: () => ({ deviceId: 'dev-iphone' }),
    };

    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue({
      getTracks: () => [mockTrack],
      getVideoTracks: () => [mockTrack],
    } as unknown as MediaStream);

    vi.mocked(navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { kind: 'videoinput', deviceId: 'dev-1', label: 'FaceTime HD Camera' } as MediaDeviceInfo,
      { kind: 'videoinput', deviceId: 'dev-iphone', label: 'iPhone Camera' } as MediaDeviceInfo,
    ]);

    render(<KioskSetupModal {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Camera Ready')).toBeInTheDocument();
    });

    const initialGetUserMediaCount = vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls.length;

    // Switch to dev-iphone (which is already active)
    const select = await screen.findByLabelText(/Active Camera Device/i);
    fireEvent.change(select, { target: { value: 'dev-iphone' } });

    // Should NOT call getUserMedia again since track is already live and matching
    expect(vi.mocked(navigator.mediaDevices.getUserMedia).mock.calls.length).toBe(
      initialGetUserMediaCount
    );
  });
});

