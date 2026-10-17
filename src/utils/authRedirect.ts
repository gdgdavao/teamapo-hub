/**
 * Where to go once signed in.
 *
 * Kept pure and exported so the open-redirect rules can be unit tested without
 * rendering the page. A single leading slash with no second one is a path;
 * `//host` and `/\host` are protocol-relative URLs that also start with a slash
 * and must not survive.
 */
export function resolveLoginDestination(from: string | null): string {
  if (!from) return '/';
  if (!from.startsWith('/')) return '/';
  if (from.startsWith('//') || from.startsWith('/\\')) return '/';
  // Never bounce straight back to the auth area.
  if (from.startsWith('/auth/login') || from.startsWith('/auth/forgot-password')) {
    return '/';
  }
  return from;
}