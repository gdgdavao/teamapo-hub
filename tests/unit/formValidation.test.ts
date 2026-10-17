import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validateFullName,
  validatePhoneNumber,
  validateDynamicField,
} from '../../src/utils/formValidation';
import { FormField } from '../../src/types';

describe('formValidation', () => {
  describe('validateEmail', () => {
    it('accepts standard valid email addresses', () => {
      expect(validateEmail('user@gdgdavao.org').isValid).toBe(true);
      expect(validateEmail('test.name+tag@gmail.com').isValid).toBe(true);
      expect(validateEmail('organizer@sub.domain.co').isValid).toBe(true);
      expect(validateEmail('USER@EXAMPLE.COM').normalized).toBe('user@example.com');
    });

    it('rejects empty or whitespace email', () => {
      expect(validateEmail('').isValid).toBe(false);
      expect(validateEmail('   ').isValid).toBe(false);
      expect(validateEmail(null).isValid).toBe(false);
    });

    it('rejects malformed email formats', () => {
      expect(validateEmail('notanemail').isValid).toBe(false);
      expect(validateEmail('@nodomain.com').isValid).toBe(false);
      expect(validateEmail('user@').isValid).toBe(false);
      expect(validateEmail('user@.com').isValid).toBe(false);
      expect(validateEmail('user@domain..com').isValid).toBe(false);
      expect(validateEmail('user@domain.c').isValid).toBe(false); // TLD must be >= 2 chars
      expect(validateEmail('user spaces@domain.com').isValid).toBe(false);
    });

    it('rejects emails exceeding 254 characters', () => {
      const longEmail = `${'a'.repeat(250)}@example.com`;
      expect(validateEmail(longEmail).isValid).toBe(false);
    });
  });

  describe('validateFullName', () => {
    it('accepts valid names', () => {
      expect(validateFullName('Ada Lovelace').isValid).toBe(true);
      expect(validateFullName('Jose Rizal').isValid).toBe(true);
      expect(validateFullName('  John Doe  ').normalized).toBe('John Doe');
      expect(validateFullName('Maria Santos-Cruz').isValid).toBe(true);
    });

    it('rejects empty or short names', () => {
      expect(validateFullName('').isValid).toBe(false);
      expect(validateFullName('A').isValid).toBe(false);
      expect(validateFullName('   ').isValid).toBe(false);
      expect(validateFullName(null).isValid).toBe(false);
    });

    it('rejects names with no letters', () => {
      expect(validateFullName('12345').isValid).toBe(false);
      expect(validateFullName('---').isValid).toBe(false);
    });
  });

  describe('validatePhoneNumber', () => {
    it('accepts valid Philippine numbers', () => {
      expect(validatePhoneNumber('09171234567').isValid).toBe(true);
      expect(validatePhoneNumber('+639171234567').isValid).toBe(true);
      expect(validatePhoneNumber('639171234567').isValid).toBe(true);
      expect(validatePhoneNumber('9171234567').isValid).toBe(true);
      expect(validatePhoneNumber('0917-123-4567').isValid).toBe(true);
      expect(validatePhoneNumber('(0917) 123 4567').isValid).toBe(true);
    });

    it('normalizes Philippine numbers to +639 format', () => {
      expect(validatePhoneNumber('09171234567').normalized).toBe('+639171234567');
      expect(validatePhoneNumber('+639171234567').normalized).toBe('+639171234567');
      expect(validatePhoneNumber('9171234567').normalized).toBe('+639171234567');
    });

    it('accepts valid international numbers', () => {
      expect(validatePhoneNumber('+14155552671').isValid).toBe(true);
      expect(validatePhoneNumber('+6591234567').isValid).toBe(true);
    });

    it('handles optional vs required states', () => {
      expect(validatePhoneNumber('', false).isValid).toBe(true);
      expect(validatePhoneNumber('', true).isValid).toBe(false);
      expect(validatePhoneNumber('   ', true).isValid).toBe(false);
    });

    it('rejects invalid phone formats', () => {
      expect(validatePhoneNumber('12345').isValid).toBe(false);
      expect(validatePhoneNumber('notanumber').isValid).toBe(false);
      expect(validatePhoneNumber('08123456789').isValid).toBe(false); // Invalid PH prefix
    });
  });

  describe('validateDynamicField', () => {
    it('validates required text fields', () => {
      const field: FormField = {
        id: 'company',
        label: 'Company',
        type: 'text',
        required: true,
      };

      expect(validateDynamicField(field, '').isValid).toBe(false);
      expect(validateDynamicField(field, 'Google').isValid).toBe(true);
    });

    it('validates required checkbox fields', () => {
      const field: FormField = {
        id: 'agreeTerms',
        label: 'Agree to Terms',
        type: 'checkbox',
        required: true,
      };

      expect(validateDynamicField(field, false).isValid).toBe(false);
      expect(validateDynamicField(field, true).isValid).toBe(true);
    });

    it('validates required multiselect fields', () => {
      const field: FormField = {
        id: 'interests',
        label: 'Interests',
        type: 'multiselect',
        required: true,
        options: ['AI', 'Cloud', 'Mobile'],
      };

      expect(validateDynamicField(field, []).isValid).toBe(false);
      expect(validateDynamicField(field, ['AI']).isValid).toBe(true);
    });

    it('validates required rating fields', () => {
      const field: FormField = {
        id: 'rating',
        label: 'Experience Rating',
        type: 'rating',
        required: true,
      };

      expect(validateDynamicField(field, 0).isValid).toBe(false);
      expect(validateDynamicField(field, 4).isValid).toBe(true);
    });

    it('validates email-typed dynamic fields', () => {
      const field: FormField = {
        id: 'workEmail',
        label: 'Work Email Address',
        type: 'email',
        required: false,
      };

      expect(validateDynamicField(field, '').isValid).toBe(true); // Optional empty
      expect(validateDynamicField(field, 'invalid').isValid).toBe(false);
      expect(validateDynamicField(field, 'test@work.com').isValid).toBe(true);
    });

    it('validates phone-typed dynamic fields', () => {
      const field: FormField = {
        id: 'contactNum',
        label: 'Emergency Contact',
        type: 'phone',
        required: true,
      };

      expect(validateDynamicField(field, '').isValid).toBe(false);
      expect(validateDynamicField(field, '123').isValid).toBe(false);
      expect(validateDynamicField(field, '09123456789').isValid).toBe(true);
    });

    it('validates number fields with min and max bounds', () => {
      const field: FormField = {
        id: 'teamSize',
        label: 'Team Size',
        type: 'number',
        required: true,
        validation: { min: 1, max: 5 },
      };

      expect(validateDynamicField(field, '0').isValid).toBe(false);
      expect(validateDynamicField(field, '6').isValid).toBe(false);
      expect(validateDynamicField(field, '3').isValid).toBe(true);
      expect(validateDynamicField(field, 'abc').isValid).toBe(false);
    });
  });
});
