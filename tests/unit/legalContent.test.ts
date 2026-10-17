import { describe, it, expect } from 'vitest';
import { PRIVACY_POLICY } from '@/pages/legal/content/privacyPolicy';
import { TERMS_OF_SERVICE } from '@/pages/legal/content/termsOfService';

describe('Legal Content Modules Integrity', () => {
  describe('Privacy Policy Specification', () => {
    it('contains essential metadata and DPA 2012 references', () => {
      expect(PRIVACY_POLICY.id).toBe('privacy');
      expect(PRIVACY_POLICY.title).toBe('Privacy Policy');
      expect(PRIVACY_POLICY.lastUpdated).toBe('October 16, 2026');
      expect(PRIVACY_POLICY.sections.length).toBeGreaterThanOrEqual(8);

      const fullContent = PRIVACY_POLICY.sections
        .flatMap((s) => [s.title, ...(s.content || []), ...(s.subsections?.flatMap((sub) => sub.content) || [])])
        .join(' ');

      expect(fullContent).toContain('Data Privacy Act of 2012');
      expect(fullContent).toContain('Philippines');
      expect(fullContent).toContain('support@gdgdavao.org');
      expect(fullContent).toContain('https://gdgdavao.org');
      expect(fullContent).toContain('https://apohub.gdgdavao.org');
    });

    it('ensures each section has unique, non-empty anchor IDs and titles', () => {
      const sectionIds = new Set<string>();

      PRIVACY_POLICY.sections.forEach((section) => {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.content.length).toBeGreaterThan(0);
        expect(sectionIds.has(section.id)).toBe(false);
        sectionIds.add(section.id);

        if (section.subsections) {
          section.subsections.forEach((sub) => {
            expect(sub.id).toBeTruthy();
            expect(sub.title).toBeTruthy();
            expect(sub.content.length).toBeGreaterThan(0);
            expect(sectionIds.has(sub.id)).toBe(false);
            sectionIds.add(sub.id);
          });
        }
      });
    });
  });

  describe('Terms of Service Specification', () => {
    it('contains essential metadata and platform invariants', () => {
      expect(TERMS_OF_SERVICE.id).toBe('terms');
      expect(TERMS_OF_SERVICE.title).toBe('Terms of Service');
      expect(TERMS_OF_SERVICE.lastUpdated).toBe('October 16, 2026');
      expect(TERMS_OF_SERVICE.sections.length).toBeGreaterThanOrEqual(10);

      const fullContent = TERMS_OF_SERVICE.sections
        .flatMap((s) => [s.title, ...(s.content || []), ...(s.subsections?.flatMap((sub) => sub.content) || [])])
        .join(' ');

      expect(fullContent).toContain('Single Ticket Per Person');
      expect(fullContent).toContain('Davao City');
      expect(fullContent).toContain('Philippines');
      expect(fullContent).toContain('support@gdgdavao.org');
      expect(fullContent).toContain('https://gdgdavao.org');
      expect(fullContent).toContain('Data Privacy Act of 2012');
    });

    it('ensures all sections have valid unique anchor IDs', () => {
      const sectionIds = new Set<string>();

      TERMS_OF_SERVICE.sections.forEach((section) => {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.content.length).toBeGreaterThan(0);
        expect(sectionIds.has(section.id)).toBe(false);
        sectionIds.add(section.id);
      });
    });
  });
});
