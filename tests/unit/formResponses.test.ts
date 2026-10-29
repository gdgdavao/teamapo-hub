/**
 * Pure helper tests for attendee form responses (customResponses).
 *
 * These helpers back the admin-only response editor and the resend targeting,
 * so the keying contract matters: the Event Form Builder's `FormField.id` is
 * the map key, with legacy registrations using positional keys
 * ('1' name, '2' email, '3' phone).
 */

import { describe, it, expect } from 'vitest';
import { FormField } from '../../src/types';
import {
  validateFormResponses,
  extractContactDetailsFromResponses,
  resolveResendTargetEmail,
} from '../../src/utils/formResponses';

const field = (over: Partial<FormField> = {}): FormField => ({
  id: 'q1',
  type: 'text',
  label: 'Favourite language',
  required: false,
  ...over,
});

describe('validateFormResponses', () => {
  it('passes when every required field has an answer', () => {
    const fields = [
      field({ id: 'name', label: 'Full name', required: true }),
      field({ id: 'email', type: 'email', label: 'Email', required: true }),
    ];
    expect(
      validateFormResponses({ name: 'Ada', email: 'ada@example.com' }, fields)
    ).toEqual({});
  });

  it('enforces required fields on save', () => {
    const fields = [field({ id: 'name', label: 'Full name', required: true })];
    const errors = validateFormResponses({ name: '' }, fields);
    expect(errors['name']).toContain('required');
  });

  it('enforces the email format of an email-typed field', () => {
    const fields = [field({ id: 'email', type: 'email', label: 'Email' })];
    const errors = validateFormResponses({ email: 'not-an-email' }, fields);
    expect(errors['email']).toBeTruthy();

    expect(
      validateFormResponses({ email: 'ada@example.com' }, fields)
    ).toEqual({});
  });

  it('does not validate fields missing from the form definition (legacy answers)', () => {
    const fields = [field({ id: 'name', label: 'Full name', required: true })];
    expect(
      validateFormResponses({ legacy_free_text: '', name: 'Ada' }, fields)
    ).toEqual({});
  });

  it('skips spacer fields', () => {
    const fields = [field({ id: 'gap', type: 'spacer', label: '', required: true })];
    expect(validateFormResponses({}, fields)).toEqual({});
  });

  it('resolves answers through the lowercase key fallback', () => {
    const fields = [field({ id: 'Name', label: 'Full name', required: true })];
    expect(validateFormResponses({ name: 'Ada' }, fields)).toEqual({});
  });

  it('enforces multiselect minimum of one option when required', () => {
    const fields = [
      field({
        id: 'tracks',
        type: 'multiselect',
        label: 'Tracks',
        required: true,
        options: ['AI', 'Cloud'],
      }),
    ];
    expect(validateFormResponses({ tracks: [] }, fields)['tracks']).toBeTruthy();
    expect(validateFormResponses({ tracks: ['AI'] }, fields)).toEqual({});
  });
});

describe('extractContactDetailsFromResponses', () => {
  it('reads contact details by field type', () => {
    const fields = [
      field({ id: 'full_name', label: 'Full name' }),
      field({ id: 'email_addr', type: 'email', label: 'Email address' }),
      field({ id: 'mobile', type: 'phone', label: 'Mobile number' }),
    ];
    expect(
      extractContactDetailsFromResponses(
        { full_name: 'Ada', email_addr: 'ada@example.com', mobile: '09171234567' },
        fields
      )
    ).toEqual({ name: 'Ada', email: 'ada@example.com', phone: '09171234567' });
  });

  it('reads legacy positional keys (1 name, 2 email, 3 phone)', () => {
    const fields = [
      field({ id: '1', label: 'Name' }),
      field({ id: '2', label: 'Email' }),
      field({ id: '3', label: 'Phone' }),
    ];
    expect(
      extractContactDetailsFromResponses(
        { '1': 'Ada', '2': 'ada@example.com', '3': '09171234567' },
        fields
      )
    ).toEqual({ name: 'Ada', email: 'ada@example.com', phone: '09171234567' });
  });

  it('matches by label keywords when the type is generic text', () => {
    const fields = [
      field({ id: 'q1', label: 'Company email address' }),
      field({ id: 'q2', label: 'Contact number' }),
    ];
    expect(
      extractContactDetailsFromResponses(
        { q1: 'ada@example.com', q2: '09171234567' },
        fields
      )
    ).toEqual({ email: 'ada@example.com', phone: '09171234567' });
  });

  it('preserves cleared values as empty strings so callers can null stale contact data', () => {
    const fields = [field({ id: '2', label: 'Email' })];
    expect(extractContactDetailsFromResponses({ '2': '  ' }, fields)).toEqual({
      email: '',
    });
  });

  it('omits keys for contact kinds the form does not collect', () => {
    const fields = [field({ id: 'q1', label: 'Shirt size' })];
    expect(extractContactDetailsFromResponses({ q1: 'M' }, fields)).toEqual({});
  });

  it('combines First Name and Last Name fields into full name without dropping last name', () => {
    const fields = [
      field({ id: '1', label: 'First Name' }),
      field({ id: '1762143123275', label: 'Last Name' }),
      field({ id: '2', type: 'email', label: 'Email Address' }),
    ];
    expect(
      extractContactDetailsFromResponses(
        { '1': 'Juan', '1762143123275': 'Dela Cruz', '2': 'juan@example.com' },
        fields
      )
    ).toEqual({
      name: 'Juan Dela Cruz',
      email: 'juan@example.com',
    });
  });

  it('ignores non-person name fields such as Company Name or Middle Name when resolving full name', () => {
    const fields = [
      field({ id: 'org_name', label: 'Company / Organization Name' }),
      field({ id: 'first_name', label: 'First Name' }),
      field({ id: 'middle_name', label: 'Middle Name' }),
      field({ id: 'last_name', label: 'Last Name' }),
    ];
    expect(
      extractContactDetailsFromResponses(
        {
          org_name: 'GDG Davao',
          first_name: 'Maria',
          middle_name: '',
          last_name: 'Santos',
        },
        fields
      )
    ).toEqual({
      name: 'Maria Santos',
    });
  });

  it('preserves unmapped legacy last name key when formFields only defines field 1', () => {
    const fields = [
      field({ id: '1', label: 'Full Name' }),
      field({ id: '2', type: 'email', label: 'Email Address' }),
    ];
    expect(
      extractContactDetailsFromResponses(
        { '1': 'Juan', '1762143123275': 'Dela Cruz', '2': 'juan@example.com' },
        fields
      )
    ).toEqual({
      name: 'Juan Dela Cruz',
      email: 'juan@example.com',
    });
  });

  it('returns nothing without a form definition', () => {
    expect(extractContactDetailsFromResponses({ '1': 'Ada' }, [])).toEqual({});
  });
});

describe('resolveResendTargetEmail', () => {
  it("prefers the attendee's current form-response email over the log recipient", () => {
    expect(
      resolveResendTargetEmail('old@example.com', 'corrected@example.com')
    ).toBe('corrected@example.com');
  });

  it('falls back to the log recipient when no current email exists', () => {
    expect(resolveResendTargetEmail('old@example.com', null)).toBe('old@example.com');
    expect(resolveResendTargetEmail('old@example.com', undefined)).toBe('old@example.com');
    expect(resolveResendTargetEmail('old@example.com', '   ')).toBe('old@example.com');
  });

  it('trims the current email before using it', () => {
    expect(
      resolveResendTargetEmail('old@example.com', ' corrected@example.com ')
    ).toBe('corrected@example.com');
  });
});
