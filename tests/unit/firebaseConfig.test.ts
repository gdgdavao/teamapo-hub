import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveAuthDomain, auth, db } from '../../src/config/firebase';

describe('Firebase Configuration & Safari Resilience', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('resolveAuthDomain', () => {
    it('returns the default auth domain in development mode', () => {
      vi.stubEnv('DEV', true);
      const domain = resolveAuthDomain();
      expect(domain).toBe(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'project-iris-gdgdavao.firebaseapp.com');
    });

    it('returns window.location.hostname in production when accessed via custom domain', () => {
      vi.stubEnv('DEV', false);
      vi.stubGlobal('window', {
        location: {
          hostname: 'apohub.gdgdavao.org',
        },
      });

      const domain = resolveAuthDomain();
      expect(domain).toBe('apohub.gdgdavao.org');
    });

    it('ignores localhost or 127.0.0.1 in production and falls back to configured authDomain', () => {
      vi.stubEnv('DEV', false);
      vi.stubGlobal('window', {
        location: {
          hostname: 'localhost',
        },
      });

      const domain = resolveAuthDomain();
      expect(domain).toBe(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'project-iris-gdgdavao.firebaseapp.com');
    });
  });

  describe('Firebase Auth & Firestore Services', () => {
    it('exports a valid auth instance', () => {
      expect(auth).toBeDefined();
      expect(typeof auth.app).toBe('object');
    });

    it('exports a valid firestore instance', () => {
      expect(db).toBeDefined();
      expect(typeof db.app).toBe('object');
    });
  });
});
