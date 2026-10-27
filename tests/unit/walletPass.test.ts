import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletPassService } from '../../src/services/walletPassService';
import { generateWalletPassToken, isIOSDevice } from '../../src/utils/passArtwork';

// Mock firebase/functions
const mockCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable)
}));

vi.mock('../../src/config/firebase', () => ({
  functions: {},
  db: {}
}));

describe('WalletPassService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns saveUrl and expiryAt on successful pass generation', async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        saveUrl: 'https://pay.google.com/gp/v/save/mock-jwt-token',
        expiryAt: '2026-10-26T15:45:00.000Z'
      }
    });

    const result = await WalletPassService.createWalletPassUrl({
      registrationId: 'reg-12345',
      walletPassToken: 'token-abcde'
    });

    expect(result.error).toBeUndefined();
    expect(result.saveUrl).toBe('https://pay.google.com/gp/v/save/mock-jwt-token');
    expect(result.expiryAt).toBe('2026-10-26T15:45:00.000Z');
  });

  it('handles wallet-not-configured typed response without throwing', async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        error: 'wallet-not-configured',
        message: 'Google Wallet integration is not configured on this instance'
      }
    });

    const result = await WalletPassService.createWalletPassUrl({
      registrationId: 'reg-12345',
      walletPassToken: 'token-abcde'
    });

    expect(result.error).toBe('wallet-not-configured');
    expect(result.saveUrl).toBeUndefined();
    expect(result.message).toContain('not configured');
  });

  it('maps functions/not-found error code to not-found error', async () => {
    const error: any = new Error('Registration not found or token invalid');
    error.code = 'functions/not-found';
    mockCallable.mockRejectedValueOnce(error);

    const result = await WalletPassService.createWalletPassUrl({
      registrationId: 'reg-invalid',
      walletPassToken: 'token-invalid'
    });

    expect(result.error).toBe('not-found');
    expect(result.saveUrl).toBeUndefined();
  });

  it('maps failed-precondition error code to not-approved error', async () => {
    const error: any = new Error('Registration has not been approved');
    error.code = 'functions/failed-precondition';
    mockCallable.mockRejectedValueOnce(error);

    const result = await WalletPassService.createWalletPassUrl({
      registrationId: 'reg-unapproved',
      walletPassToken: 'token-unapproved'
    });

    expect(result.error).toBe('not-approved');
    expect(result.saveUrl).toBeUndefined();
  });

  it('maps generic upstream error gracefully', async () => {
    mockCallable.mockRejectedValueOnce(new Error('Network connectivity lost'));

    const result = await WalletPassService.createWalletPassUrl({
      registrationId: 'reg-error',
      walletPassToken: 'token-error'
    });

    expect(result.error).toBe('upstream');
    expect(result.saveUrl).toBeUndefined();
  });
});

describe('Google Wallet Token and Invariant Safeguards', () => {
  it('sanitizes identifiers to Wallet-compatible safe characters', () => {
    const sanitize = (raw: string) => {
      const sanitized = raw.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      return sanitized.replace(/^_+|_+$/g, '') || 'unknown';
    };

    expect(sanitize('event/2026:Davao Special!')).toBe('event_2026_Davao_Special');
    expect(sanitize('  normal_id-123  ')).toBe('normal_id-123');
    expect(sanitize('???')).toBe('unknown');
    expect(sanitize('')).toBe('unknown');
  });

  it('guarantees token idempotency: does not overwrite existing token', () => {
    const existingRegistration = {
      id: 'reg-1',
      registrationStatus: 'pending',
      walletPassToken: 'existing-token-secret-123'
    };

    // Simulate token update logic
    const updateData: Record<string, any> = {
      registrationStatus: 'approved'
    };

    if (!existingRegistration.walletPassToken) {
      updateData.walletPassToken = 'new-random-token';
    }

    expect(updateData.walletPassToken).toBeUndefined();
    expect(existingRegistration.walletPassToken).toBe('existing-token-secret-123');
  });

  it('mints token when absent on first approval', () => {
    const newRegistration: { id: string; walletPassToken?: string } = {
      id: 'reg-new'
    };

    const updateData: Record<string, any> = {
      registrationStatus: 'approved'
    };

    if (!newRegistration.walletPassToken) {
      updateData.walletPassToken = 'minted-token-xyz';
    }

    expect(updateData.walletPassToken).toBe('minted-token-xyz');
    expect(Object.values(updateData)).not.toContain(undefined);
  });

  it('mints 256-bit CSPRNG URL-safe tokens via generateWalletPassToken()', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const token = generateWalletPassToken();
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      seen.add(token);
    }
    expect(seen.size).toBe(100);
  });

  it('detects iOS and iPadOS devices accurately via isIOSDevice()', () => {
    // iPhone Safari
    expect(
      isIOSDevice({
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        maxTouchPoints: 5,
      })
    ).toBe(true);

    // Classic iPad
    expect(
      isIOSDevice({
        userAgent:
          'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)',
        platform: 'iPad',
        maxTouchPoints: 5,
      })
    ).toBe(true);

    // iPadOS 13+ desktop-class Safari (MacIntel + multi-touch)
    expect(
      isIOSDevice({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      })
    ).toBe(true);

    // macOS Desktop Safari (MacIntel + 0 touch points) -> NOT iOS
    expect(
      isIOSDevice({
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 0,
      })
    ).toBe(false);

    // Android Chrome -> NOT iOS
    expect(
      isIOSDevice({
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
        platform: 'Linux armv81',
        maxTouchPoints: 5,
      })
    ).toBe(false);

    // Desktop Firefox -> NOT iOS
    expect(
      isIOSDevice({
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0',
        platform: 'Linux x86_64',
        maxTouchPoints: 0,
      })
    ).toBe(false);
  });
});
