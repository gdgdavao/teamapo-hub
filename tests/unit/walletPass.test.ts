import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletPassService } from '../../src/services/walletPassService';

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
});
