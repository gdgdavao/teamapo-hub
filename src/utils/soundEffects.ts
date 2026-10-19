/**
 * Web Audio API Sound Synthesizer for TeamApo Hub
 *
 * Lightweight, zero-dependency audio feedback for event kiosks and check-in stations.
 * Synthesizes pure tones directly in the browser with 0 HTTP audio asset requests,
 * ensuring high venue resilience on slow mobile connections or offline situations.
 */

// Global audio context singleton with lazy initialization on first user interaction
let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof globalThis === 'undefined') return null;

  try {
    const AudioContextClass =
      (globalThis as unknown as { AudioContext?: typeof AudioContext }).AudioContext ||
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {
        // User gesture may be required before resuming
      });
    }

    return audioCtx;
  } catch {
    return null;
  }
};

/**
 * Resets the audio context singleton (for test isolation).
 */
export const resetAudioContextForTesting = (): void => {
  audioCtx = null;
};

/**
 * Plays an upbeat two-tone chime (E5 -> G#5) for successful attendee check-in.
 */
export const playSuccessChime = (): void => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';

    // First note: E5 (659.25 Hz)
    osc.frequency.setValueAtTime(659.25, now);
    // Second note: G#5 (830.61 Hz) after 100ms
    osc.frequency.setValueAtTime(830.61, now + 0.1);

    // Smooth envelope attack and decay
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // Audio synthesis failure should never crash the app
  }
};

/**
 * Plays a gentle, distinct warning double-buzz (C4 -> A3) for already checked-in or invalid badges.
 */
export const playWarningBuzz = (): void => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';

    // First tone: C4 (261.63 Hz)
    osc.frequency.setValueAtTime(261.63, now);
    // Drop to A3 (220 Hz) for second tone
    osc.frequency.setValueAtTime(220.0, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  } catch {
    // Audio synthesis failure should never crash the app
  }
};

/**
 * Plays a subtle tick for on-screen numeric keypad or button clicks.
 */
export const playClickFeedback = (): void => {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  } catch {
    // Audio synthesis failure should never crash the app
  }
};
