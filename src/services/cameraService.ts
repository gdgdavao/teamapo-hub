import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// CameraService — the single getUserMedia ladder behind every camera surface.
//
// One source of truth for acquiring a device camera so the kiosk topology —
// station setup modal (KioskSetupModal), attendee kiosk page (EventKioskPage),
// organizer QR scanner (CheckInTab), and certificate verifier
// (CertificateVerificationPage) — cannot drift apart on constraints, fallback
// ordering, timeouts, or error copy.
// Pure WebRTC APIs only: no Firestore, no Firebase config.
//
// Hardware realities encoded here:
// - Some cameras negotiate for seconds after connect, hence the generous 15s
//   ceiling.
// - `deviceId` strings are per-origin and per-connection (Firefox rotates them
//   every session; macOS reconnections rotate them too), so they are hints,
//   never hard constraints: `{ ideal }` degrades to another camera instead of
//   dying on OverconstrainedError.
// - `facingMode` is honoured where supported (iOS/Android) and ignored by
//   desktop drivers where it means nothing.
// - Jammed cameras (Zoom, OBS, FaceTime, Photo Booth, Windows exclusive mode)
//   surface as NotReadableError/TrackStartError rather than permission errors.
// - Non-secure origins (plain http:// at a venue LAN) have no
//   `navigator.mediaDevices` at all: every browser hides the WebRTC stack.
// ---------------------------------------------------------------------------

export type CameraFailureKind =
  | 'insecure-context'
  | 'permission-denied'
  | 'in-use'
  | 'not-found'
  | 'overconstrained'
  | 'timeout'
  | 'unknown';

export type BrowserEngine = 'webkit' | 'chromium' | 'firefox' | 'unknown';

/**
 * Thrown by CameraService.acquireKioskStream for failures it generates itself
 * (timeout, missing WebRTC support). Raw getUserMedia DOMExceptions are passed
 * through unchanged; classifyCameraError() normalises both.
 */
export class CameraUnavailableError extends Error {
  readonly kind: CameraFailureKind;

  constructor(kind: CameraFailureKind, message: string) {
    super(message);
    this.name = 'CameraUnavailableError';
    this.kind = kind;
  }
}

export interface CameraPrefs {
  deviceId?: string;
  facingMode: 'user' | 'environment';
}

export interface KioskStreamResult {
  stream: MediaStream;
  /** The deviceId actually negotiated, read back from track settings. */
  deviceId?: string;
}

/** Which ladder stage failed and is being abandoned. */
export type AcquireFallbackStage = 'deviceId' | 'facingMode' | 'default';

export interface AcquireOptions {
  /** Some cameras start slowly; a generous ceiling covers slow hardware. */
  timeoutMs?: number;
  onFallback?: (stage: AcquireFallbackStage, error: unknown) => void;
  /**
   * The user explicitly picked this device in UI (dropdown): request it hard.
   * Without `exact`, Chromium and Safari award their own per-origin site-default
   * camera (the address-bar/site-settings picker choice) whenever the request
   * is non-exact, silently overriding the selection. A failed exact still
   * widens back to the soft ladder, so stale/rotated ids never hard-fail.
   */
  deviceIdExact?: boolean;
  /**
   * No explicit device is picked (fresh surface open, fallback retry): put
   * `{ video: true }` first on desktop so the browser's persisted site-default
   * camera is honored instead of competing with a facingMode hint. Mobile
   * keeps facingMode first.
   */
  preferOsDefault?: boolean;
  /** Settle delay (in ms) when an attempt fails with transient hardware contention (NotReadableError / TrackStartError). Defaults to 350ms. */
  settleDelayMs?: number;
}

export interface CameraFailure {
  kind: CameraFailureKind;
  message: string;
}

export interface CameraAttempt {
  stage: AcquireFallbackStage;
  constraints: MediaTrackConstraints | true;
}

const INSECURE_CONTEXT_MESSAGE =
  'Camera access requires a secure origin. Serve this kiosk over HTTPS or http://localhost, then reload this page.';

/** Kinds that make further ladder attempts pointless: the browser refuses camera access globally, not just a constraint. */
const FATAL_KINDS: ReadonlySet<CameraFailureKind> = new Set([
  'permission-denied',
  'insecure-context',
  'timeout',
]);

/**
 * getUserMedia raced against a deadline so slow-connecting cameras cannot hang
 * an entire kiosk forever. The eventually-resolving
 * loser is tracked and its stream stopped, or an orphaned stream would keep the
 * camera light on forever even after the UI has moved on.
 */
const raceWithTimeout = (
  constraints: MediaTrackConstraints | true,
  timeoutMs: number
): Promise<MediaStream> => {
  return new Promise<MediaStream>((resolve, reject) => {
    let settled = false;

    // Guarded lazily: jsdom and permission-gated browsers may not expose
    // mediaDevices, in which case the thrown TypeError is classified as an
    // insecure context by classifyCameraError().
    let pending: Promise<MediaStream>;
    try {
      pending = navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
    } catch (syncErr) {
      reject(syncErr);
      return;
    }

    const stopStream = (stream: MediaStream) => {
      try {
        stream.getTracks().forEach((track) => track.stop());
      } catch {
        // Ignore; the loser is a discard candidate anyway.
      }
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      // The ORPHANED late-arriving stream must stop, or the camera light stays on.
      pending.then(stopStream).catch(() => undefined);
      reject(new CameraUnavailableError('timeout', 'Camera took too long to connect'));
    }, timeoutMs);

    pending.then(
      (stream) => {
        if (settled) {
          stopStream(stream);
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(stream);
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    );
  });
};

export class CameraService {
  /**
   * Ordered constraint attempts for kiosk hardware. `deviceId` is a
   * preference, not an identity: ids rotate between sessions on Firefox and
   * macOS, so a dead stored id widens to facingMode and then to
   * the OS default instead of hard-failing. `{ video: true }` is always the
   * final attempt.
   */
  static buildLadder(prefs: CameraPrefs, options: AcquireOptions = {}): CameraAttempt[] {
    const attempts: CameraAttempt[] = [];
    if (prefs.deviceId) {
      attempts.push({
        stage: 'deviceId',
        constraints: options.deviceIdExact
          ? { deviceId: { exact: prefs.deviceId } }
          : { deviceId: { ideal: prefs.deviceId } },
      });
    }
    if (options.preferOsDefault && !prefs.deviceId) {
      attempts.push({ stage: 'default', constraints: true });
    }
    attempts.push({ stage: 'facingMode', constraints: { facingMode: { ideal: prefs.facingMode } } });
    attempts.push({ stage: 'default', constraints: true });
    return attempts;
  }

  /**
   * Acquire the kiosk camera stream through the ordered ladder. Returns the
   * stream plus the deviceId actually negotiated (read back from track
   * settings) so callers persist the truth instead of their guess.
   */
  static async acquireKioskStream(
    prefs: CameraPrefs,
    options: AcquireOptions = {}
  ): Promise<KioskStreamResult> {
    const support = this.supportsKioskCamera();
    if (support) throw new CameraUnavailableError(support.kind, support.message);

    const timeoutMs = options.timeoutMs ?? 15000;
    let lastError: unknown;

    for (const attempt of this.buildLadder(prefs, options)) {
      try {
        logger.debug('CameraService: acquiring stream', attempt.stage, attempt.constraints);
        const stream = await raceWithTimeout(attempt.constraints, timeoutMs);
        const deviceId = stream.getVideoTracks()?.[0]?.getSettings?.().deviceId;
        logger.debug('[CameraService] Acquired stream successfully:', {
          stage: attempt.stage,
          negotiatedDeviceId: deviceId,
          trackCount: stream.getVideoTracks().length,
        });
        return { stream, deviceId: deviceId || undefined };
      } catch (err) {
        lastError = err;
        options.onFallback?.(attempt.stage, err);
        const failureKind = this.classifyCameraError(err);
        logger.warn('CameraService attempt failed:', {
          stage: attempt.stage,
          failureKind,
          error: err,
        });
        if (FATAL_KINDS.has(failureKind)) throw err;
        if (failureKind === 'not-found' && attempt.stage === 'default') throw err;

        // If the error was transient hardware contention ('in-use' / NotReadableError),
        // give the OS driver a brief moment to finish releasing the lens before
        // exhausting ladder stages immediately.
        if (failureKind === 'in-use') {
          const delay = options.settleDelayMs ?? 350;
          if (delay > 0) {
            logger.debug(`[CameraService] Waiting settle delay (${delay}ms) for lens release...`);
            await new Promise((res) => setTimeout(res, delay));
          }
        }
      }
    }

    throw lastError ?? new CameraUnavailableError('unknown', 'Unable to connect to camera');
  }

  /** Map any thrown camera failure to a canonical kind. Accepts raw
   *  DOMExceptions from the platform as well as CameraUnavailableError. */
  static classifyCameraError(error: unknown): CameraFailureKind {
    if (error instanceof CameraUnavailableError) return error.kind;
    const name = (error as { name?: string } | null | undefined)?.name;
    switch (name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
      case 'SecurityError':
        return 'permission-denied';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'not-found';
      case 'NotReadableError':
      case 'TrackStartError':
      case 'AbortError':
        return 'in-use';
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError':
        return 'overconstrained';
      case 'TypeError':
        // Chrome/WebKit surface a missing WebRTC stack (non-secure origin,
        // video capture stack disabled) as a TypeError rather than a DOMException.
        return 'insecure-context';
      default:
        return 'unknown';
    }
  }

  /** Which rendering engine painted this page, for remediation copy? */
  static detectBrowserEngine(): BrowserEngine {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent;
    if (/firefox|fxios/i.test(ua)) return 'firefox';
    if (/chrome|crios|edg\//i.test(ua)) return 'chromium';
    if (/safari/i.test(ua)) return 'webkit';
    return 'unknown';
  }

  /**
   * Turn any thrown camera failure into canonical kind + remediation copy for
   * the rendered kiosk surface. Copy references the engine-specific way to
   * unblock the camera so a volunteer at the venue door does not have to know
   * which browser the kiosk laptop runs.
   */
  static describeCameraFailure(error: unknown, engine = this.detectBrowserEngine()): CameraFailure {
    const kind = this.classifyCameraError(error);
    let message: string;
    switch (kind) {
      case 'permission-denied':
        message =
          engine === 'firefox'
            ? 'Camera permission was denied. Click the permissions icon in the address bar, allow Camera access, then retry.'
            : engine === 'webkit'
              ? 'Camera permission is off for this site. In Safari, click the camera icon in the address bar, set Camera to Allow, then reload and retry.'
              : 'Camera permission is blocked for this site. Click the camera icon in the address bar, allow Camera access, then retry.';
        break;
      case 'in-use':
        message =
          'The camera is busy with another app or window (Zoom, Meet, OBS, FaceTime, Photo Booth). Close the other camera app, then retry.';
        break;
      case 'not-found':
        message =
          'No camera was found. Check that a camera is connected and allowed in your OS privacy settings (System Settings, Privacy & Security, Camera on macOS; Settings, Privacy, Camera on Android and iOS), then retry.';
        break;
      case 'overconstrained':
        message =
          'The selected camera rejected its requested settings. Use the default camera, or reselect it in Station Setup.';
        break;
      case 'timeout':
        message =
          'The camera took too long to connect. Wait a moment and retry, or switch to the default camera.';
        break;
      case 'insecure-context':
        message = INSECURE_CONTEXT_MESSAGE;
        break;
      default:
        message =
          'Unable to connect to the camera. Retry, or switch to the default camera in Station Setup.';
    }
    return { kind, message };
  }

  /**
   * Null when the page can request cameras; CameraFailure when the WebRTC
   * stack is absent, which means a non-secure origin (or file:// in some
   * engines). Callers render the copy instead of attempting getUserMedia in
   * what would be an immediate, cryptic TypeError.
   */
  static supportsKioskCamera(): CameraFailure | null {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { kind: 'insecure-context', message: INSECURE_CONTEXT_MESSAGE };
    }
    return null;
  }

  /**
   * Video inputs with usable ids. Drivers and virtual devices (v4l2loopback on
   * Linux, OBS virtual camera) can enumerate entries with an empty deviceId:
   * selecting one in a dropdown is a guaranteed OverconstrainedError.
   */
  static async listVideoInputs(): Promise<MediaDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput' && d.deviceId);
    } catch (err) {
      logger.warn('CameraService: enumerateDevices failed:', err);
      return [];
    }
  }

  /**
   * Can a stored deviceId still be opened? `undefined` means "unknown" (labels
   * are withheld before the permission decision, or enumeration is
   * unavailable), so callers must treat false as the only actionable answer.
   */
  static async isDeviceAvailable(deviceId?: string): Promise<boolean | undefined> {
    if (!deviceId) return undefined;
    const inputs = await this.listVideoInputs();
    if (!inputs.some((d) => Boolean(d.label))) return undefined;
    return inputs.some((d) => d.deviceId === deviceId);
  }
}
