/**
 * Pure helpers for attendee form responses (customResponses on a registration).
 *
 * Zero side effects and zero Firebase imports — services and components call
 * these; tests exercise them directly. Keying matches how registrations store
 * answers: the Event Form Builder's `FormField.id` is the map key, with legacy
 * registrations using positional keys ('1' name, '2' email, '3' phone).
 */

import { FormField } from '../types';
import { validateDynamicField } from './formValidation';

export type ResponseValue = string | number | boolean | string[];

/** Field errors keyed by FormField.id (or raw response key for legacy fields). */
export type ResponseValidationErrors = Record<string, string>;

/**
 * Validates a full responses draft against the event's form definition.
 * Required fields are enforced (per decision: saving must satisfy the form's
 * own required-field rules) and per-field type constraints are checked via
 * the shared `validateDynamicField` validator.
 *
 * Fields no longer present in the form definition (legacy answers) are not
 * validated — they are displayed and editable as free-form text.
 */
export function validateFormResponses(
  responses: Record<string, ResponseValue | undefined>,
  formFields: FormField[]
): ResponseValidationErrors {
  const errors: ResponseValidationErrors = {};

  for (const field of formFields) {
    if (field.type === 'spacer') continue;
    const value = responses[field.id] ?? responses[field.id.toLowerCase()];
    const result = validateDynamicField(field, value);
    if (!result.isValid && result.error) {
      errors[field.id] = result.error;
    }
  }

  return errors;
}

export interface ContactDetails {
  name?: string;
  email?: string;
  phone?: string;
}

/**
 * Extracts the attendee's contact details from their form responses so the
 * service can keep `userDetails` in sync when an admin edits responses.
 *
 * Matching mirrors the heuristics the attendees workspace already uses
 * (field type, then label/id keywords, then the legacy positional keys).
 * A key is present in the result only when the form actually defines such a
 * field — the caller then writes `null` for cleared values instead of leaving
 * stale contact data behind. Values are trimmed; empty strings are preserved
 * so callers can distinguish "cleared" from "field does not exist".
 */
export function extractContactDetailsFromResponses(
  responses: Record<string, ResponseValue | undefined>,
  formFields: FormField[]
): ContactDetails {
  const details: ContactDetails = {};
  if (!formFields.length) return details;

  const readString = (field: FormField): string | undefined => {
    const value = responses[field.id] ?? responses[field.id.toLowerCase()];
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    return undefined;
  };

  const cleanLabel = (raw: string): string =>
    raw.replace(/[*_~`]+/g, '').toLowerCase().trim();

  const matches = (field: FormField, keywords: string[]): boolean => {
    const id = field.id.toLowerCase();
    const label = cleanLabel(field.label);
    return keywords.some((k) => id.includes(k) || label.includes(k));
  };

  const isNonPersonNameField = (field: FormField): boolean =>
    matches(field, [
      'company',
      'organization',
      'venue',
      'business',
      'emergency',
      'school',
      'university',
      'institution',
      'affiliation',
    ]);

  const isLastNameField = (field: FormField): boolean => {
    if (isNonPersonNameField(field)) return false;
    const id = field.id.toLowerCase();
    const label = cleanLabel(field.label);
    return (
      label.includes('last name') ||
      label.includes('family name') ||
      label.includes('surname') ||
      label === 'last' ||
      id === 'lastname' ||
      id === 'last_name' ||
      id === 'surname' ||
      id === '1762143123275'
    );
  };

  const isMiddleNameField = (field: FormField): boolean => {
    const id = field.id.toLowerCase();
    const label = cleanLabel(field.label);
    return (
      label.includes('middle name') ||
      label.includes('middle initial') ||
      id === 'middlename' ||
      id === 'middle_name'
    );
  };

  const hasSeparateLastNameField = formFields.some(
    (f) => f.type !== 'spacer' && isLastNameField(f)
  );

  const isFirstNameField = (field: FormField): boolean => {
    if (isNonPersonNameField(field) || isLastNameField(field) || isMiddleNameField(field)) {
      return false;
    }
    const id = field.id.toLowerCase();
    const label = cleanLabel(field.label);
    return (
      label.includes('first name') ||
      label.includes('given name') ||
      label === 'first' ||
      id === 'firstname' ||
      id === 'first_name' ||
      id === 'first' ||
      (field.id === '1' && hasSeparateLastNameField)
    );
  };

  const isFullNameField = (field: FormField): boolean => {
    if (
      isNonPersonNameField(field) ||
      isFirstNameField(field) ||
      isLastNameField(field) ||
      isMiddleNameField(field)
    ) {
      return false;
    }
    const id = field.id.toLowerCase();
    const label = cleanLabel(field.label);
    return (
      field.id === '1' ||
      label.includes('full name') ||
      label.includes('your name') ||
      label.includes('attendee name') ||
      label.includes('participant name') ||
      label.includes('complete name') ||
      label === 'name' ||
      id === 'name' ||
      id === 'fullname' ||
      id === 'full_name' ||
      id === 'attendee_name' ||
      matches(field, ['name'])
    );
  };

  let fullNameVal: string | undefined;
  let firstNameVal: string | undefined;
  let lastNameVal: string | undefined;

  for (const field of formFields) {
    if (field.type === 'spacer') continue;

    if (firstNameVal === undefined && isFirstNameField(field)) {
      firstNameVal = readString(field) ?? '';
      continue;
    }

    if (lastNameVal === undefined && isLastNameField(field)) {
      lastNameVal = readString(field) ?? '';
      continue;
    }

    if (fullNameVal === undefined && isFullNameField(field)) {
      fullNameVal = readString(field) ?? '';
      continue;
    }

    if (
      details.email === undefined &&
      (field.type === 'email' || field.id === '2' || matches(field, ['email']))
    ) {
      details.email = readString(field) ?? '';
      continue;
    }

    if (
      details.phone === undefined &&
      (field.type === 'phone' ||
        field.id === '3' ||
        matches(field, ['phone', 'mobile']) ||
        // "Contact number" style labels — but never emergency contacts.
        (field.label.toLowerCase().includes('contact') &&
          !field.label.toLowerCase().includes('emergency')))
    ) {
      details.phone = readString(field) ?? '';
    }
  }

  // Also check legacy/unmapped last-name keys in responses when lastNameVal was not in formFields
  if (lastNameVal === undefined) {
    const fallbackLast =
      responses['1762143123275'] ??
      responses['last_name'] ??
      responses['lastName'] ??
      responses['lastname'] ??
      responses['surname'];
    if (typeof fallbackLast === 'string' && fallbackLast.trim()) {
      const trimmedLast = fallbackLast.trim();
      if (firstNameVal !== undefined) {
        lastNameVal = trimmedLast;
      } else if (
        fullNameVal !== undefined &&
        !fullNameVal.toLowerCase().includes(trimmedLast.toLowerCase())
      ) {
        fullNameVal = [fullNameVal.trim(), trimmedLast].filter(Boolean).join(' ');
      }
    }
  }

  if (firstNameVal !== undefined || lastNameVal !== undefined) {
    details.name = [firstNameVal, lastNameVal]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join(' ');
  } else if (fullNameVal !== undefined) {
    details.name = fullNameVal;
  }

  return details;
}

/**
 * Resolves the email a resend should target. Preference order:
 * 1. The email currently recorded in the attendee's form responses (an admin
 *    may have corrected it there — the whole point of removing the resend
 *    address prompt).
 * 2. The registration's resolved attendee email.
 * 3. The original recipient on the email log.
 */
export function resolveResendTargetEmail(
  logUserEmail: string,
  currentEmail?: string | null
): string {
  const candidate = currentEmail?.trim();
  if (candidate) return candidate;
  return logUserEmail;
}
