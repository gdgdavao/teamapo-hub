/**
 * Form Validation Utilities for TeamApo Hub
 *
 * Strict, accessible validation rules adhering to:
 * - RFC 5322 Email specifications with valid TLD checks
 * - Philippines (+639 / 09) and International E.164 phone formats
 * - DPA 2012 sanitized strings
 * - WCAG 2.2 AA compliant error messages
 */

import { FormField } from '../types';
import { stripFormattedLabelSyntax } from '../components/FormattedLabelText';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  normalized?: string;
}

/**
 * Standard RFC 5322 compatible email regex with TLD checks.
 * Disallows consecutive dots, spaces, and requires minimum 2-letter alphabetic TLD.
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Validates an email address.
 */
export function validateEmail(email: unknown): ValidationResult {
  if (typeof email !== 'string' || !email.trim()) {
    return {
      isValid: false,
      error: 'Email address is required.',
      normalized: '',
    };
  }

  const trimmed = email.trim();

  if (trimmed.length > 254) {
    return {
      isValid: false,
      error: 'Email address is too long (maximum 254 characters).',
      normalized: trimmed.toLowerCase(),
    };
  }

  if (trimmed.includes('..')) {
    return {
      isValid: false,
      error: 'Email address cannot contain consecutive dots.',
      normalized: trimmed.toLowerCase(),
    };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Please enter a valid email address (e.g., name@example.com).',
      normalized: trimmed.toLowerCase(),
    };
  }

  return {
    isValid: true,
    normalized: trimmed.toLowerCase(),
  };
}

/**
 * Validates full name.
 * Requires at least 2 characters and at least one letter.
 */
export function validateFullName(name: unknown): ValidationResult {
  if (typeof name !== 'string' || !name.trim()) {
    return {
      isValid: false,
      error: 'Full name is required.',
      normalized: '',
    };
  }

  const trimmed = name.trim().replace(/\s+/g, ' ');

  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: 'Full name must be at least 2 characters.',
      normalized: trimmed,
    };
  }

  if (!/[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Full name must contain letters.',
      normalized: trimmed,
    };
  }

  return {
    isValid: true,
    normalized: trimmed,
  };
}

/**
 * Validates a mobile/phone number.
 * Supports Philippine formats (09xx, +639xx, 639xx) and international E.164 (+[1-9]...).
 */
export function validatePhoneNumber(phone: unknown, required: boolean = false): ValidationResult {
  if (typeof phone !== 'string' || !phone.trim()) {
    if (required) {
      return {
        isValid: false,
        error: 'Phone number is required.',
        normalized: '',
      };
    }
    return {
      isValid: true,
      normalized: '',
    };
  }

  const cleaned = phone.trim().replace(/[\s\-().]/g, '');

  // Philippine Mobile Format:
  // 09XXXXXXXXX (11 digits)
  // +639XXXXXXXXX (13 chars)
  // 639XXXXXXXXX (12 digits)
  // 9XXXXXXXXX (10 digits)
  const isPH =
    /^(\+?63|0)?9\d{9}$/.test(cleaned);

  // International E.164: + followed by 7 to 15 digits
  const isE164 = /^\+?[1-9]\d{6,14}$/.test(cleaned);

  if (!isPH && !isE164) {
    return {
      isValid: false,
      error: 'Please enter a valid mobile number (e.g. 09123456789 or +639123456789).',
      normalized: cleaned,
    };
  }

  // Normalize Philippine numbers to +639XXXXXXXXX format for standard storage
  let normalized = cleaned;
  if (isPH) {
    if (cleaned.startsWith('09')) {
      normalized = `+63${cleaned.slice(1)}`;
    } else if (cleaned.startsWith('9')) {
      normalized = `+63${cleaned}`;
    } else if (cleaned.startsWith('639')) {
      normalized = `+${cleaned}`;
    }
  } else if (!normalized.startsWith('+')) {
    normalized = `+${normalized}`;
  }

  return {
    isValid: true,
    normalized,
  };
}

/**
 * Validates a single organizer-defined dynamic field.
 */
export function validateDynamicField(field: FormField, value: unknown): ValidationResult {
  const label = stripFormattedLabelSyntax(field.label) || 'This field';

  // Check required state
  if (field.required && field.type !== 'spacer') {
    if (value === undefined || value === null) {
      return { isValid: false, error: `${label} is required.` };
    }

    if (typeof value === 'string' && !value.trim()) {
      return { isValid: false, error: `${label} is required.` };
    }

    if (field.type === 'checkbox') {
      if (field.options && field.options.length > 0) {
        if (!Array.isArray(value) || value.length === 0) {
          return { isValid: false, error: `Please select at least one option for ${label}.` };
        }
      } else if (value !== true) {
        return { isValid: false, error: `${label} must be checked.` };
      }
    }

    if (field.type === 'multiselect' && (!Array.isArray(value) || value.length === 0)) {
      return { isValid: false, error: `Please select at least one option for ${label}.` };
    }

    if (field.type === 'rating' && (typeof value !== 'number' || value <= 0)) {
      return { isValid: false, error: `Please provide a rating for ${label}.` };
    }
  }

  // If empty and not required, pass
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return { isValid: true };
  }

  // Type-specific validations
  if (field.type === 'email' || field.id.toLowerCase().includes('email') || label.toLowerCase().includes('email')) {
    const res = validateEmail(value);
    if (!res.isValid) {
      return { isValid: false, error: res.error };
    }
  }

  if (field.type === 'phone' || field.id.toLowerCase().includes('phone') || label.toLowerCase().includes('phone')) {
    const res = validatePhoneNumber(value, field.required);
    if (!res.isValid) {
      return { isValid: false, error: res.error };
    }
  }

  if (field.type === 'number') {
    const num = Number(value);
    if (isNaN(num)) {
      return { isValid: false, error: `${label} must be a valid number.` };
    }
    if (field.validation?.min !== undefined && num < field.validation.min) {
      return { isValid: false, error: `${label} must be at least ${field.validation.min}.` };
    }
    if (field.validation?.max !== undefined && num > field.validation.max) {
      return { isValid: false, error: `${label} must be no more than ${field.validation.max}.` };
    }
  }

  // String length & pattern validations
  if (typeof value === 'string') {
    if (field.validation?.minLength && value.length < field.validation.minLength) {
      return { isValid: false, error: `${label} must be at least ${field.validation.minLength} characters.` };
    }
    if (field.validation?.maxLength && value.length > field.validation.maxLength) {
      return { isValid: false, error: `${label} cannot exceed ${field.validation.maxLength} characters.` };
    }
    if (field.validation?.pattern) {
      try {
        const regex = new RegExp(field.validation.pattern);
        if (!regex.test(value)) {
          return { isValid: false, error: `Please enter a valid format for ${label}.` };
        }
      } catch {
        // Invalid regex pattern authored by organizer; ignore safely
      }
    }
  }

  return { isValid: true };
}
