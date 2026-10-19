import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  playSuccessChime,
  playWarningBuzz,
  playClickFeedback,
  resetAudioContextForTesting,
} from '../../src/utils/soundEffects';

describe('soundEffects synthesizer', () => {
  const originalAudioContext = (globalThis as any).AudioContext;
  const originalWebkitAudioContext = (globalThis as any).webkitAudioContext;

  let mockOscillator: any;
  let mockGain: any;
  let mockContext: any;

  beforeEach(() => {
    mockOscillator = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockContext = {
      currentTime: 10,
      state: 'running',
      destination: {},
      createOscillator: vi.fn(() => mockOscillator),
      createGain: vi.fn(() => mockGain),
      resume: vi.fn().mockResolvedValue(undefined),
    };

    (globalThis as any).AudioContext = vi.fn(function () {
      return mockContext;
    });
    resetAudioContextForTesting();
  });

  afterEach(() => {
    resetAudioContextForTesting();
    (globalThis as any).AudioContext = originalAudioContext;
    (globalThis as any).webkitAudioContext = originalWebkitAudioContext;
    vi.restoreAllMocks();
  });

  it('plays success chime with two-tone frequencies (E5 to G#5)', () => {
    playSuccessChime();

    expect(mockContext.createOscillator).toHaveBeenCalled();
    expect(mockContext.createGain).toHaveBeenCalled();
    expect(mockOscillator.type).toBe('sine');
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(659.25, 10);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(830.61, 10.1);
    expect(mockOscillator.start).toHaveBeenCalledWith(10);
    expect(mockOscillator.stop).toHaveBeenCalledWith(10.4);
  });

  it('plays warning buzz with descending tones (C4 to A3)', () => {
    playWarningBuzz();

    expect(mockContext.createOscillator).toHaveBeenCalled();
    expect(mockContext.createGain).toHaveBeenCalled();
    expect(mockOscillator.type).toBe('triangle');
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(261.63, 10);
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(220, 10.12);
    expect(mockOscillator.start).toHaveBeenCalledWith(10);
    expect(mockOscillator.stop).toHaveBeenCalledWith(10.36);
  });

  it('plays click feedback for on-screen buttons', () => {
    playClickFeedback();

    expect(mockContext.createOscillator).toHaveBeenCalled();
    expect(mockContext.createGain).toHaveBeenCalled();
    expect(mockOscillator.type).toBe('sine');
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledWith(880, 10);
    expect(mockOscillator.start).toHaveBeenCalledWith(10);
    expect(mockOscillator.stop).toHaveBeenCalledWith(10.06);
  });

  it('gracefully degrades with no throw when AudioContext is unavailable', () => {
    (globalThis as any).AudioContext = undefined;
    (globalThis as any).webkitAudioContext = undefined;

    expect(() => playSuccessChime()).not.toThrow();
    expect(() => playWarningBuzz()).not.toThrow();
    expect(() => playClickFeedback()).not.toThrow();
  });
});
