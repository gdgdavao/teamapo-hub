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

/**
 * Official GDG Davao branded logo asset hosted on Cloudflare R2 / assets.gdgdavao.org.
 * Used across email templates, ticket cards, and Google Wallet passes.
 */
export const GDG_LOGO_URL = 'https://assets.gdgdavao.org/email-assets/gdgdvo-header-mail.png';

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

/**
 * 10 curated Davao heritage and Mt. Apo artworks hosted on Cloudflare R2
 * used for the TeamApo Ticket Card and Google Wallet passes.
 */
export const PASS_ARTWORK_URLS: readonly string[] = [
  'https://assets.gdgdavao.org/passes-assets/apo.png',
  'https://assets.gdgdavao.org/passes-assets/cacao.png',
  'https://assets.gdgdavao.org/passes-assets/dahican.png',
  'https://assets.gdgdavao.org/passes-assets/durian.png',
  'https://assets.gdgdavao.org/passes-assets/eagle.png',
  'https://assets.gdgdavao.org/passes-assets/eden.png',
  'https://assets.gdgdavao.org/passes-assets/gulf.png',
  'https://assets.gdgdavao.org/passes-assets/samal.png',
  'https://assets.gdgdavao.org/passes-assets/sanped.png',
  'https://assets.gdgdavao.org/passes-assets/waling.png',
] as const;
