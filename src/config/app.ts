/**
 * Single source of truth for the public app URL.
 *
 * Previously five different domains were hardcoded across the codebase
 * (apohub.gdgdavao.org / gdgdavao.org / apohub.gdgdavao.com / events.gdgdavao.com
 * / gdgdavao.com). The QR payload, the feedback email deep link and the
 * certificate verifier's ALLOWED_DOMAINS must all agree, so they read from here.
 */
export const APP_URL = 'https://apohub.gdgdavao.org';

/** Official website for Google Developer Groups (GDG) Davao. */
export const OFFICIAL_WEBSITE_URL = 'https://gdgdavao.org';

/** Hosts accepted when parsing a scanned certificate QR code. */
export const ALLOWED_VERIFY_HOSTS = [
  'apohub.gdgdavao.org',
  'apohub-gdgdavao.vercel.app',
  // local dev
  'localhost',
  '127.0.0.1',
] as const;

/**
 * ActionCodeSettings used by Firebase Auth for password resets, email verifications,
 * and invitations so recipients are automatically routed back to apohub.gdgdavao.org/auth/login.
 */
export const AUTH_ACTION_CODE_SETTINGS = {
  url: `${APP_URL}/auth/login?reset=success`,
  handleCodeInApp: true,
};