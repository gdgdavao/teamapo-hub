/**
 * Canonical mapping of Firebase Auth error codes to user-friendly messages.
 * Prevents internal SDK messages ("Firebase: Error (auth/...)") from leaking to UI surfaces.
 */
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/wrong-password': 'Invalid email or password. Please try again.',
  'auth/user-not-found': 'Invalid email or password. Please try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/popup-closed-by-user': 'Sign-in cancelled.',
  'auth/popup-blocked': 'Your browser blocked the sign-in popup. Please allow popups for this site.',
  'auth/cancelled-popup-request': 'Sign-in cancelled.',
  'auth/user-disabled': 'This account has been disabled. Please contact an administrator.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/email-already-in-use': 'Email is already registered. Please sign in instead.',
  'auth/weak-password': 'Password does not meet complexity requirements. Please choose a stronger password.',
  'auth/unprovisioned-account': 'This account has not been provisioned as an organizer or admin. Please contact an administrator to invite you.',
  'auth/unauthorized-domain': 'This domain is not authorized for sign-in. Please contact an administrator to verify the domain settings.',
  'auth/expired-action-code': 'This link has expired. Please request a new one.',
  'auth/invalid-action-code': 'This link is invalid or has already been used. Please request a new one.',
};

const DEFAULT_FALLBACK = 'Unable to sign in. Please try again.';

/**
 * Sanitizes an error and returns a human-friendly string.
 * Strips raw Firebase internal error prefixes and guarantees no SDK implementation
 * details leak to the end user.
 */
export function getFriendlyAuthErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_FALLBACK
): string {
  if (!error) return fallback;

  // Extract error code if present
  const code = (error as { code?: unknown })?.code;
  if (typeof code === 'string' && AUTH_ERROR_MESSAGES[code]) {
    return AUTH_ERROR_MESSAGES[code];
  }

  // Check if message is a clean string (not an internal Firebase SDK error)
  const message = (error as { message?: unknown })?.message;
  if (typeof message === 'string' && message.trim().length > 0) {
    const trimmed = message.trim();
    // Reject internal Firebase error formats: "Firebase: Error (auth/...)", "Firebase: ...", or strings containing "(auth/"
    const isFirebaseLeak =
      /^firebase:\s*/i.test(trimmed) ||
      /\(auth\/[a-z0-9-]+\)/i.test(trimmed) ||
      /^auth\/[a-z0-9-]+$/i.test(trimmed);

    if (!isFirebaseLeak) {
      return trimmed;
    }
  }

  return fallback;
}
