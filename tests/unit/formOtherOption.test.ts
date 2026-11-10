import { describe, it, expect } from 'vitest';
import {
  isOtherOption,
  formatOtherResponse,
  parseOtherResponse,
  validateFormResponses
} from '../../src/utils/formResponses';
import { FormField } from '../../src/types';

describe('Form "Other" Option Write-in Detection and Formatting', () => {
  describe('isOtherOption', () => {
    it('detects standard "Other" variations', () => {
      expect(isOtherOption('Other')).toBe(true);
      expect(isOtherOption('other')).toBe(true);
      expect(isOtherOption('OTHER')).toBe(true);
      expect(isOtherOption('  Other  ')).toBe(true);
      expect(isOtherOption('Other...')).toBe(true);
      expect(isOtherOption('Other…')).toBe(true);
      expect(isOtherOption('Other: (please specify)')).toBe(true);
      expect(isOtherOption('Other (please specify)')).toBe(true);
      expect(isOtherOption('Other - specify')).toBe(true);
      expect(isOtherOption('Other option')).toBe(true);
      expect(isOtherOption('Other please specify')).toBe(true);
    });

    it('rejects words that contain "other" as a substring', () => {
      expect(isOtherOption('Mother')).toBe(false);
      expect(isOtherOption('Brother')).toBe(false);
      expect(isOtherOption('Another')).toBe(false);
      expect(isOtherOption('Another option')).toBe(false);
      expect(isOtherOption('Otherwise')).toBe(false);
      expect(isOtherOption('Otherworldly')).toBe(false);
    });

    it('rejects standard unrelated options and empty inputs', () => {
      expect(isOtherOption('Option 1')).toBe(false);
      expect(isOtherOption('Definitely')).toBe(false);
      expect(isOtherOption('')).toBe(false);
      expect(isOtherOption('   ')).toBe(false);
      expect(isOtherOption(null)).toBe(false);
      expect(isOtherOption(undefined)).toBe(false);
    });
  });

  describe('formatOtherResponse', () => {
    it('formats with custom text as "Other: <custom text>"', () => {
      expect(formatOtherResponse('Other...', 'GDG Web Workshop')).toBe('Other: GDG Web Workshop');
      expect(formatOtherResponse('Other (please specify)', 'AI & Cloud')).toBe('Other: AI & Cloud');
      expect(formatOtherResponse('Other', '   Trimmed response   ')).toBe('Other: Trimmed response');
    });

    it('falls back to the base option or "Other" when text is empty', () => {
      expect(formatOtherResponse('Other...', '')).toBe('Other...');
      expect(formatOtherResponse('Other (please specify)', '   ')).toBe('Other (please specify)');
      expect(formatOtherResponse('Other', null)).toBe('Other');
      expect(formatOtherResponse('Custom', '')).toBe('Other');
    });
  });

  describe('parseOtherResponse', () => {
    it('correctly deconstructs composite "Other: <custom text>" values', () => {
      const result = parseOtherResponse('Other: Custom Topic');
      expect(result.isOther).toBe(true);
      expect(result.customText).toBe('Custom Topic');
    });

    it('handles lowercase and whitespace variations in prefix', () => {
      const result = parseOtherResponse('other:   Deep Learning   ');
      expect(result.isOther).toBe(true);
      expect(result.customText).toBe('Deep Learning');
    });

    it('recognizes bare "Other" option without custom text', () => {
      const result = parseOtherResponse('Other...');
      expect(result.isOther).toBe(true);
      expect(result.customText).toBe('');
    });

    it('returns isOther: false for regular option values', () => {
      expect(parseOtherResponse('Option 1')).toEqual({ isOther: false, customText: '' });
      expect(parseOtherResponse(123)).toEqual({ isOther: false, customText: '' });
      expect(parseOtherResponse(null)).toEqual({ isOther: false, customText: '' });
    });
  });

  describe('validateFormResponses with "Other" options', () => {
    const requiredChoiceField: FormField = {
      id: 'referral',
      type: 'radio',
      label: 'How did you hear about us?',
      required: true,
      options: ['Friend', 'Social Media', 'Other...']
    };

    const optionalChoiceField: FormField = {
      id: 'dietary',
      type: 'multiselect',
      label: 'Dietary requirements',
      required: false,
      options: ['Vegetarian', 'Halal', 'Other...']
    };

    it('requires custom text if required question has "Other" selected without text', () => {
      const errors = validateFormResponses(
        { referral: 'Other...' },
        [requiredChoiceField]
      );
      expect(errors.referral).toContain('Please specify your answer');
    });

    it('passes validation if required question has "Other: <text>" specified', () => {
      const errors = validateFormResponses(
        { referral: 'Other: GDG Community Lead' },
        [requiredChoiceField]
      );
      expect(errors.referral).toBeUndefined();
    });

    it('allows blank "Other" on optional questions without error', () => {
      const errors = validateFormResponses(
        { dietary: ['Other...'] },
        [optionalChoiceField]
      );
      expect(errors.dietary).toBeUndefined();
    });

    it('passes when regular option is chosen on required question', () => {
      const errors = validateFormResponses(
        { referral: 'Friend' },
        [requiredChoiceField]
      );
      expect(errors.referral).toBeUndefined();
    });
  });
});
