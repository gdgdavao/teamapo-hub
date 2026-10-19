import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CameraService,
  CameraUnavailableError,
  type KioskStreamResult,
} from '../../src/services/cameraService';

/**
 * Unit tests for the shared kiosk camera acquisition ladder.
 *
 * Runs in the node project, so `navigator` is replaced wholesale with a stub
 * exposing only what CameraService reads: `mediaDevices.getUserMedia`,
 * `mediaDevices.enumerateDevices` and `userAgent`. Node installs `navigator`
 * as a configurable getter, so the property descriptor swap is safe and the
 * original is restored after every test.
 */

interface FakeVideoTrack {
  readyState: 'live' | 'ended';
  getSettings: () => { deviceId: string };
  getCapabilities: () => Record<string, never>;
  stop: ReturnType<typeof vi.fn>;
  enabled: boolean;
}

interface FakeStream {
  active: boolean;
  getVideoTracks: () => FakeVideoTrack[];
  getTracks: () => FakeVideoTrack[];
}

const makeStream = (deviceId?: string, live = true): FakeStream => {
  const track: FakeVideoTrack = {
    readyState: live ? 'live' : 'ended',
    getSettings: () => ({ deviceId: deviceId ?? '' }),
    getCapabilities: () => ({}),
    stop: vi.fn(),
    enabled: true,
  };
  return { active: live, getVideoTracks: () => [track], getTracks: () => [track] };
};

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalNavigator = 'navigator' in globalThis ? globalThis.navigator : undefined;

const setNavigator = (value: unknown) => {
  Object.defineProperty(globalThis, 'navigator', {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
};

const stubMediaDevices = (
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
  enumerateDevices?: () => Promise<MediaDeviceInfo[]>
) => {
  setNavigator({
    userAgent: 'Mozilla/5.0 (Test) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
    mediaDevices: { getUserMedia, enumerateDevices },
  });
};

afterEach(() => {
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  } else if (originalNavigator !== undefined) {
    setNavigator(originalNavigator);
  }
});

describe('CameraService.supportsKioskCamera', () => {
  it('reports an insecure context when navigator.mediaDevices is missing (http:// kiosk)', () => {
    setNavigator({ userAgent: 'Mozilla/5.0' });
    const support = CameraService.supportsKioskCamera();
    expect(support).not.toBeNull();
    expect(support?.kind).toBe('insecure-context');
    expect(support?.message).toContain('HTTPS');
  });

  it('reports null when getUserMedia is available', () => {
    stubMediaDevices(vi.fn());
    expect(CameraService.supportsKioskCamera()).toBeNull();
  });
});

describe('CameraService.acquireKioskStream', () => {
  it('rejects with insecure-context and stops before any ladder attempt', async () => {
    setNavigator({ userAgent: 'Mozilla/5.0' });
    await expect(
      CameraService.acquireKioskStream({ facingMode: 'user' })
    ).rejects.toMatchObject({ kind: 'insecure-context' } satisfies Partial<CameraUnavailableError>);
  });

  it('requests the stored deviceId with an ideal (degradable) constraint first', async () => {
    const gum = vi.fn().mockResolvedValue(makeStream('cam-1'));
    stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);

    const result: KioskStreamResult = await CameraService.acquireKioskStream({
      deviceId: 'cam-1',
      facingMode: 'environment',
    });

    expect(gum).toHaveBeenCalledTimes(1);
    expect(gum.mock.calls[0][0].video).toEqual({ deviceId: { ideal: 'cam-1' } });
    expect(result.deviceId).toBe('cam-1');
  });

  it('widens from a dead stored deviceId to facingMode, notifying onFallback', async () => {
    const gum = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('hang', 'NotReadableError'))
      .mockResolvedValueOnce(makeStream('cam-2'));
    stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);
    const onFallback = vi.fn();

    const result = await CameraService.acquireKioskStream(
      { deviceId: 'cam-dead', facingMode: 'environment' },
      { onFallback }
    );

    expect(gum).toHaveBeenCalledTimes(2);
    expect(gum.mock.calls[0][0].video).toEqual({ deviceId: { ideal: 'cam-dead' } });
    // The fallback honours the organizer's configured facing mode.
    expect(gum.mock.calls[1][0].video).toEqual({ facingMode: { ideal: 'environment' } });
    expect(result.deviceId).toBe('cam-2');
    expect(onFallback).toHaveBeenCalledWith('deviceId', expect.anything());
  });

  it('degrades facingMode to the plain OS default attempt last', async () => {
    const gum = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('busy', 'NotReadableError'))
      .mockRejectedValueOnce(new DOMException('overconstrained', 'OverconstrainedError'))
      .mockResolvedValueOnce(makeStream('cam-default'));
    stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);

    const result = await CameraService.acquireKioskStream({ deviceId: 'cam-dead', facingMode: 'user' });

    expect(gum).toHaveBeenCalledTimes(3);
    expect(gum.mock.calls[1][0].video).toEqual({ facingMode: { ideal: 'user' } });
    expect(gum.mock.calls[2][0].video).toBe(true);
    expect(result.deviceId).toBe('cam-default');
  });

  it('applies settle delay when in-use NotReadableError is encountered before fallback', async () => {
    const gum = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('hardware contention', 'NotReadableError'))
      .mockResolvedValueOnce(makeStream('cam-fallback'));
    stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);

    const startTime = Date.now();
    const result = await CameraService.acquireKioskStream(
      { deviceId: 'cam-busy', facingMode: 'user' },
      { settleDelayMs: 60 }
    );
    const duration = Date.now() - startTime;

    expect(gum).toHaveBeenCalledTimes(2);
    expect(duration).toBeGreaterThanOrEqual(50);
    expect(result.deviceId).toBe('cam-fallback');
  });

  it('honors a desktop untouched default with { video: true } before any facingMode hint', async () => {
    const gum = vi.fn().mockResolvedValue(makeStream('chrome-default-cam'));
    stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);

    const result = await CameraService.acquireKioskStream(
      { facingMode: 'user' },
      { preferOsDefault: true }
    );

    // Chromium/Safari persist a per-origin site-default camera from their own
    // picker; `{ video: true }` is what lets it win instead of losing to an
    // ideal facingMode competition.
    expect(gum).toHaveBeenCalledTimes(1);
    expect(gum.mock.calls[0][0].video).toBe(true);
    expect(result.deviceId).toBe('chrome-default-cam');
  });

  it('requests an explicit selection exactly and widens softly on refusal (no futile same-id ideal retry)', async () => {
    const gum = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('site default held', 'OverconstrainedError'))
      .mockResolvedValueOnce(makeStream('cam-2'));
    stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);
    const onFallback = vi.fn();

    const result = await CameraService.acquireKioskStream(
      { deviceId: 'cam-1', facingMode: 'user' },
      { deviceIdExact: true, onFallback }
    );

    // An exact refusal because Chromium holds its site-default camera means an
    // ideal retry of the SAME id would lose again (ideal < site-default in the
    // constraint algorithm), so the ladder widens to the next attempts instead.
    expect(gum).toHaveBeenCalledTimes(2);
    expect(gum.mock.calls[0][0].video).toEqual({ deviceId: { exact: 'cam-1' } });
    expect(gum.mock.calls[1][0].video).toEqual({ facingMode: { ideal: 'user' } });
    expect(onFallback).toHaveBeenCalledWith('deviceId', expect.anything());
    // Read-back reports the device that ACTUALLY opened, not the requested one,
    // which is how the UI converges on reality.
    expect(result.deviceId).toBe('cam-2');
  });

  it('stops the ladder immediately on a fatal refusal (permission denied)', async () => {
    const gum = vi
      .fn()
      .mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);

    await expect(
      CameraService.acquireKioskStream({ deviceId: 'cam-1', facingMode: 'user' })
    ).rejects.toMatchObject({ name: 'NotAllowedError' });

    expect(gum).toHaveBeenCalledTimes(1);
  });

  it('widens past deviceId on NotFoundError instead of aborting the ladder prematurely', async () => {
    const gum = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('device disconnected', 'NotFoundError'))
      .mockResolvedValueOnce(makeStream('cam-fallback'));
    stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);
    const onFallback = vi.fn();

    const result = await CameraService.acquireKioskStream(
      { deviceId: 'cam-unplugged', facingMode: 'user' },
      { onFallback }
    );

    expect(gum).toHaveBeenCalledTimes(2);
    expect(gum.mock.calls[0][0].video).toEqual({ deviceId: { ideal: 'cam-unplugged' } });
    expect(gum.mock.calls[1][0].video).toEqual({ facingMode: { ideal: 'user' } });
    expect(onFallback).toHaveBeenCalledWith('deviceId', expect.anything());
    expect(result.deviceId).toBe('cam-fallback');
  });

  it('stops the ladder on NotFoundError if the default stage fails (no cameras exist on system)', async () => {
    const gum = vi
      .fn()
      .mockRejectedValue(new DOMException('no devices found', 'NotFoundError'));
    stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);

    await expect(
      CameraService.acquireKioskStream({ facingMode: 'user' })
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });

  it('throws a typed timeout and stops the orphaned late stream', async () => {
    vi.useFakeTimers();
    try {
      let resolveLate!: (stream: FakeStream) => void;
      const lateStream = makeStream('late-cam');
      const gum = vi.fn(
        () =>
          new Promise<FakeStream>((resolve) => {
            resolveLate = resolve;
          })
      );
      stubMediaDevices(gum as unknown as (c: MediaStreamConstraints) => Promise<MediaStream>);

      const pending = CameraService.acquireKioskStream({ facingMode: 'user' }, { timeoutMs: 1000 });
      const rejectAssertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' });

      await vi.advanceTimersByTimeAsync(1001);
      await rejectAssertion;

      // The loser resolves after the deadline: its track must be stopped or the
      // camera indicator stays on with no consumer.
      resolveLate(lateStream);
      await Promise.resolve();
      await Promise.resolve();
      expect(lateStream.getVideoTracks()[0].stop).toHaveBeenCalled();

      expect(() => {
        throw new CameraUnavailableError('timeout', 'Camera took too long to connect');
      }).toThrow(CameraUnavailableError);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CameraService.classifyCameraError', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'not-found'],
    ['NotReadableError', 'in-use'],
    ['TrackStartError', 'in-use'],
    ['OverconstrainedError', 'overconstrained'],
    ['TypeError', 'insecure-context'],
  ])('maps DOMException %s to %s', (name, kind) => {
    expect(CameraService.classifyCameraError(new DOMException('m', name))).toBe(kind);
  });

  it('maps unknown failures and preserves typed CameraUnavailableError kinds', () => {
    expect(CameraService.classifyCameraError(new Error('hardware glitch'))).toBe('unknown');
    expect(CameraService.classifyCameraError(new CameraUnavailableError('timeout', 't'))).toBe('timeout');
  });
});

describe('CameraService.describeCameraFailure', () => {
  it('gives engine-specific UX copy for permission denial', () => {
    const err = new DOMException('denied', 'NotAllowedError');
    const firefox = CameraService.describeCameraFailure(err, 'firefox');
    const webkit = CameraService.describeCameraFailure(err, 'webkit');
    expect(firefox.message).toContain('permissions icon');
    expect(webkit.message).toContain('Safari');
    expect(firefox.message).not.toBe(webkit.message);
  });

  it('identifies a jammed camera (Zoom/OBS) for NotReadableError', () => {
    const { kind, message } = CameraService.describeCameraFailure(
      new DOMException('m', 'NotReadableError')
    );
    expect(kind).toBe('in-use');
    expect(message).toContain('Zoom');
  });
});

describe('CameraService.listVideoInputs / isDeviceAvailable', () => {
  it('filters empty-deviceId virtual devices out of the dropdown', async () => {
    stubMediaDevices(vi.fn(), async () => [
      { kind: 'videoinput', deviceId: 'cam-1', label: 'FaceTime HD' } as MediaDeviceInfo,
      { kind: 'videoinput', deviceId: '', label: 'v4l2loopback' } as MediaDeviceInfo,
      { kind: 'audioinput', deviceId: 'mic-1', label: 'Mic' } as MediaDeviceInfo,
    ]);
    const inputs = await CameraService.listVideoInputs();
    expect(inputs.map((d) => d.deviceId)).toEqual(['cam-1']);
  });

  it('verifies a stored deviceId against enumerated inputs', async () => {
    stubMediaDevices(vi.fn(), async () => [
      { kind: 'videoinput', deviceId: 'cam-1', label: 'FaceTime HD' } as MediaDeviceInfo,
    ]);
    await expect(CameraService.isDeviceAvailable('cam-1')).resolves.toBe(true);
    await expect(CameraService.isDeviceAvailable('cam-unplugged')).resolves.toBe(false);
    await expect(CameraService.isDeviceAvailable(undefined)).resolves.toBeUndefined();
  });

  it('declares unknown (not false) when labels are still withheld pre-permission', async () => {
    stubMediaDevices(vi.fn(), async () => [
      { kind: 'videoinput', deviceId: 'cam-1', label: '' } as MediaDeviceInfo,
    ]);
    await expect(CameraService.isDeviceAvailable('cam-1')).resolves.toBeUndefined();
  });
});
