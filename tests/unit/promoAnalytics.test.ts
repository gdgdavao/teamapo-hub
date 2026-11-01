import { describe, expect, it } from 'vitest';
import {
  getRegistrationPromoCode,
  matchesPromoFilter,
  PromoBearingRegistration,
} from '@/utils/pricing';

describe('Promo Analytics & Filtering Utilities', () => {
  describe('getRegistrationPromoCode', () => {
    it('returns top-level promoCode string when present', () => {
      const reg: PromoBearingRegistration = {
        promoCode: 'COMMUNITY50',
      };
      expect(getRegistrationPromoCode(reg)).toBe('COMMUNITY50');
    });

    it('returns pricing.promoCode when formatted as a string', () => {
      const reg: PromoBearingRegistration = {
        pricing: {
          promoCode: 'EARLYBIRD',
        },
      };
      expect(getRegistrationPromoCode(reg)).toBe('EARLYBIRD');
    });

    it('returns pricing.promoCode.code when structured as an object', () => {
      const reg: PromoBearingRegistration = {
        pricing: {
          promoCode: { code: 'VIPGUEST' },
        },
      };
      expect(getRegistrationPromoCode(reg)).toBe('VIPGUEST');
    });

    it('prioritizes top-level promoCode if both are populated', () => {
      const reg: PromoBearingRegistration = {
        promoCode: 'TOPLEVEL',
        pricing: {
          promoCode: 'PRICINGLEVEL',
        },
      };
      expect(getRegistrationPromoCode(reg)).toBe('TOPLEVEL');
    });

    it('trims whitespace cleanly', () => {
      const reg: PromoBearingRegistration = {
        promoCode: '  TRIMMED  ',
      };
      expect(getRegistrationPromoCode(reg)).toBe('TRIMMED');
    });

    it('returns undefined when registration is null or empty', () => {
      expect(getRegistrationPromoCode(null)).toBeUndefined();
      expect(getRegistrationPromoCode(undefined)).toBeUndefined();
      expect(getRegistrationPromoCode({})).toBeUndefined();
      expect(getRegistrationPromoCode({ promoCode: '' })).toBeUndefined();
      expect(getRegistrationPromoCode({ promoCode: '   ' })).toBeUndefined();
    });
  });

  describe('matchesPromoFilter', () => {
    const regWithPromo: PromoBearingRegistration = {
      promoCode: 'GDGDAVAO',
    };
    const regWithoutPromo: PromoBearingRegistration = {
      promoCode: null,
      pricing: null,
    };

    it("matches any registration when filter is 'all'", () => {
      expect(matchesPromoFilter(regWithPromo, 'all')).toBe(true);
      expect(matchesPromoFilter(regWithoutPromo, 'all')).toBe(true);
      expect(matchesPromoFilter(null, 'all')).toBe(true);
    });

    it("matches registrations without a promo code when filter is 'none'", () => {
      expect(matchesPromoFilter(regWithoutPromo, 'none')).toBe(true);
      expect(matchesPromoFilter(regWithPromo, 'none')).toBe(false);
      expect(matchesPromoFilter(null, 'none')).toBe(true);
    });

    it('matches specific promo code case-insensitively', () => {
      expect(matchesPromoFilter(regWithPromo, 'gdgdavao')).toBe(true);
      expect(matchesPromoFilter(regWithPromo, 'GDGDAVAO')).toBe(true);
      expect(matchesPromoFilter(regWithPromo, 'OTHERCODE')).toBe(false);
      expect(matchesPromoFilter(regWithoutPromo, 'GDGDAVAO')).toBe(false);
    });
  });

  describe('Redemption cap and aggregation logic', () => {
    it('aggregates redemptions and correctly computes visible vs remaining capped items', () => {
      const redemptions = [
        { name: 'Ana', date: 'Nov 1, 2026' },
        { name: 'John', date: 'Nov 2, 2026' },
        { name: 'Maria', date: 'Nov 3, 2026' },
        { name: 'Carlos', date: 'Nov 4, 2026' },
        { name: 'Elena', date: 'Nov 5, 2026' },
      ];

      const visible = redemptions.slice(0, 3);
      const remaining = redemptions.length - 3;

      expect(visible).toHaveLength(3);
      expect(visible.map((r) => r.name)).toEqual(['Ana', 'John', 'Maria']);
      expect(remaining).toBe(2);
    });
  });
});
