import { describe, it, expect } from 'vitest';
import { getFriendlyAuthErrorMessage, AUTH_ERROR_MESSAGES } from '@/utils/authErrors';

describe('authErrors utility', () => {
  it('maps standard Firebase credential failure codes to friendly instructions', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/invalid-credential' })).toBe(
      'Invalid email or password. Please try again.'
    );
    expect(getFriendlyAuthErrorMessage({ code: 'auth/wrong-password' })).toBe(
      'Invalid email or password. Please try again.'
    );
    expect(getFriendlyAuthErrorMessage({ code: 'auth/user-not-found' })).toBe(
      'Invalid email or password. Please try again.'
    );
  });

  it('maps rate limits and network errors correctly', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/too-many-requests' })).toBe(
      'Too many failed attempts. Please wait a moment and try again.'
    );
    expect(getFriendlyAuthErrorMessage({ code: 'auth/network-request-failed' })).toBe(
      'Network error. Check your connection and try again.'
    );
  });

  it('maps OAuth popup cancellation and blockage codes', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/popup-closed-by-user' })).toBe(
      'Sign-in cancelled.'
    );
    expect(getFriendlyAuthErrorMessage({ code: 'auth/cancelled-popup-request' })).toBe(
      'Sign-in cancelled.'
    );
    expect(getFriendlyAuthErrorMessage({ code: 'auth/popup-blocked' })).toBe(
      'Your browser blocked the sign-in popup. Please allow popups for this site.'
    );
  });

  it('maps account status and validation codes', () => {
    expect(getFriendlyAuthErrorMessage({ code: 'auth/user-disabled' })).toBe(
      'This account has been disabled. Please contact an administrator.'
    );
    expect(getFriendlyAuthErrorMessage({ code: 'auth/invalid-email' })).toBe(
      'Please enter a valid email address.'
    );
    expect(getFriendlyAuthErrorMessage({ code: 'auth/email-already-in-use' })).toBe(
      'Email is already registered. Please sign in instead.'
    );
    expect(getFriendlyAuthErrorMessage({ code: 'auth/weak-password' })).toBe(
      'Password does not meet complexity requirements. Please choose a stronger password.'
    );
  });

  it('prioritizes code lookup over raw Firebase SDK error messages', () => {
    // When FirebaseError carries both code and raw message
    const errorWithBoth = {
      code: 'auth/invalid-credential',
      message: 'Firebase: Error (auth/invalid-credential).',
    };
    expect(getFriendlyAuthErrorMessage(errorWithBoth)).toBe(
      'Invalid email or password. Please try again.'
    );
  });

  it('sanitizes and strips raw Firebase SDK internal error strings without code', () => {
    expect(
      getFriendlyAuthErrorMessage({ message: 'Firebase: Error (auth/invalid-credential).' })
    ).toBe('Unable to sign in. Please try again.');

    expect(
      getFriendlyAuthErrorMessage({ message: 'Firebase: An internal error occurred.' })
    ).toBe('Unable to sign in. Please try again.');

    expect(
      getFriendlyAuthErrorMessage(
        { message: 'Firebase: Error (auth/unknown-code).' },
        'Custom fallback'
      )
    ).toBe('Custom fallback');
  });

  it('allows clean custom application error messages through', () => {
    expect(
      getFriendlyAuthErrorMessage({ message: 'Your organization account requires 2FA setup.' })
    ).toBe('Your organization account requires 2FA setup.');

    expect(
      getFriendlyAuthErrorMessage(new Error('This account has not been provisioned.'))
    ).toBe('This account has not been provisioned.');
  });

  it('returns fallback for null, undefined, or unknown error objects', () => {
    expect(getFriendlyAuthErrorMessage(null)).toBe('Unable to sign in. Please try again.');
    expect(getFriendlyAuthErrorMessage(undefined)).toBe('Unable to sign in. Please try again.');
    expect(getFriendlyAuthErrorMessage({})).toBe('Unable to sign in. Please try again.');
    expect(getFriendlyAuthErrorMessage({ code: 'auth/some-unmapped-code' }, 'Default message')).toBe(
      'Default message'
    );
  });

  it('exports AUTH_ERROR_MESSAGES with expected constants', () => {
    expect(AUTH_ERROR_MESSAGES['auth/invalid-credential']).toBeDefined();
    expect(AUTH_ERROR_MESSAGES['auth/popup-closed-by-user']).toBeDefined();
  });
});
