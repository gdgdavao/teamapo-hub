import { PASS_ARTWORK_URLS } from '../config/app';

/**
 * Pure synchronous SHA-256 implementation producing a 64-char lowercase hex string.
 * Zero external dependencies; byte-for-byte identical to Python's hashlib.sha256.
 */
export function sha256Sync(input: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number;
  let j: number;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = input.length * 8;
  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: Record<number, number> = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  hash = hash.slice(0, 8);
  let ascii = input + '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';

  for (i = 0; i < ascii.length; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }

  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength | 0;

  for (j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      const s0 =
        rightRotate(w[i - 15], 7) ^
        rightRotate(w[i - 15], 18) ^
        (w[i - 15] >>> 3);
      const s1 =
        rightRotate(w[i - 2], 17) ^
        rightRotate(w[i - 2], 19) ^
        (w[i - 2] >>> 10);
      w[i] =
        i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj =
        (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp1 =
        (hash[7] +
          (rightRotate(hash[4], 6) ^
            rightRotate(hash[4], 11) ^
            rightRotate(hash[4], 25)) +
          ch +
          k[i] +
          w[i]) |
        0;
      const temp2 =
        ((rightRotate(hash[0], 2) ^
          rightRotate(hash[0], 13) ^
          rightRotate(hash[0], 22)) +
          maj) |
        0;
      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }
    for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (8 * j)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

/**
 * Deterministically select an artwork index (0..9) for a given registration ID.
 * Uses SHA-256(registrationId) % 10.
 *
 * "Random per attendee, stable forever": different attendees see different paintings;
 * the same attendee always sees the same painting across devices, reloads, and in Google Wallet.
 */
export function selectArtworkIndex(registrationId: string): number {
  if (!registrationId) return 0;
  const hashHex = sha256Sync(registrationId.trim());
  const sliceNum = parseInt(hashHex.substring(0, 8), 16);
  return Math.abs(sliceNum) % PASS_ARTWORK_URLS.length;
}

/**
 * Get the deterministic artwork URL for a registration.
 */
export function getArtworkUrl(registrationId: string): string {
  const index = selectArtworkIndex(registrationId);
  return PASS_ARTWORK_URLS[index] || PASS_ARTWORK_URLS[0];
}

export interface AttendeeNameInput {
  name?: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Splits attendee name into display (first line) and secondary (second line) strings.
 * Respects explicit firstName/lastName when available, or splits composite full names.
 */
export function splitAttendeeName(
  input?: string | AttendeeNameInput | null
): { display: string; secondary: string } {
  if (!input) {
    return { display: 'Attendee', secondary: '' };
  }

  if (typeof input === 'object') {
    const firstName = input.firstName?.trim();
    const lastName = input.lastName?.trim();
    if (firstName && lastName) {
      return { display: firstName, secondary: lastName };
    }
    if (firstName && !lastName) {
      return { display: firstName, secondary: '' };
    }
    if (input.name) {
      return splitAttendeeName(input.name);
    }
    return { display: 'Attendee', secondary: '' };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { display: 'Attendee', secondary: '' };
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length <= 1) {
    return { display: trimmed, secondary: '' };
  }

  // Handle common Philippine compound names & prefixes (e.g. "Juan John Dela Cruz", "Maria Elena Santos")
  if (tokens.length === 4 && ['dela', 'de', 'del', 'san'].includes(tokens[2].toLowerCase())) {
    return {
      display: `${tokens[0]} ${tokens[1]}`,
      secondary: `${tokens[2]} ${tokens[3]}`,
    };
  }

  if (tokens.length === 3 && ['dela', 'de', 'del', 'san'].includes(tokens[1].toLowerCase())) {
    return {
      display: tokens[0],
      secondary: `${tokens[1]} ${tokens[2]}`,
    };
  }

  if (tokens.length === 3) {
    // E.g. "Juan John Cruz" -> display: "Juan John", secondary: "Cruz"
    return {
      display: `${tokens[0]} ${tokens[1]}`,
      secondary: tokens[2],
    };
  }

  // Fallback: first token display, remaining tokens on secondary
  return {
    display: tokens[0],
    secondary: tokens.slice(1).join(' '),
  };
}

const URLSAFE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/**
 * Generates a cryptographically strong 256-bit URL-safe token (43 chars)
 * using Web Crypto API (crypto.getRandomValues), matching Python's secrets.token_urlsafe(32).
 * Never uses Math.random().
 */
export function generateWalletPassToken(): string {
  const bytes = new Uint8Array(32);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    throw new Error('Web Crypto API (crypto.getRandomValues) is required to mint walletPassToken');
  }

  // Convert 32 bytes (256 bits) to 43 base64url characters without padding
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (b0 << 16) | (b1 << 8) | b2;

    out += URLSAFE_ALPHABET[(triplet >> 18) & 0x3f];
    out += URLSAFE_ALPHABET[(triplet >> 12) & 0x3f];
    if (i + 1 < bytes.length) {
      out += URLSAFE_ALPHABET[(triplet >> 6) & 0x3f];
    }
    if (i + 2 < bytes.length) {
      out += URLSAFE_ALPHABET[triplet & 0x3f];
    }
  }
  return out;
}

export interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
}

/**
 * Detects whether the current device is running iOS or iPadOS (including iPadOS 13+
 * desktop-class Safari which reports platform 'MacIntel' with multi-touch support).
 */
export function isIOSDevice(nav?: NavigatorLike | null): boolean {
  const target: NavigatorLike | null =
    nav !== undefined ? nav : typeof navigator !== 'undefined' ? navigator : null;
  if (!target) return false;

  const ua = target.userAgent || '';
  const platform = target.platform || '';
  const maxTouchPoints = typeof target.maxTouchPoints === 'number' ? target.maxTouchPoints : 0;

  if (/(iPad|iPhone|iPod)/i.test(ua) || /(iPad|iPhone|iPod)/i.test(platform)) {
    return true;
  }

  // iPadOS 13+ requests desktop website by default (MacIntel + multi-touch)
  if ((platform === 'MacIntel' || /Macintosh/i.test(ua)) && maxTouchPoints > 1) {
    return true;
  }

  return false;
}
