import { describe, it, expect } from 'vitest';
import { validateDynamicField } from '../../src/utils/formValidation';
import type { FormField, Event } from '../../src/types';

describe('Registration Form and FormBuilder parity', () => {
  it('validates option-based checkboxes as multi-select arrays', () => {
    const checkboxFieldWithOptions: FormField = {
      id: 'interests',
      type: 'checkbox',
      label: 'Areas of Interest',
      required: true,
      options: ['Web', 'Mobile', 'AI/ML', 'Cloud'],
    };

    // Fails when empty or not array
    expect(validateDynamicField(checkboxFieldWithOptions, undefined).isValid).toBe(false);
    expect(validateDynamicField(checkboxFieldWithOptions, []).isValid).toBe(false);

    // Passes when at least one option is selected
    expect(validateDynamicField(checkboxFieldWithOptions, ['Web']).isValid).toBe(true);
    expect(validateDynamicField(checkboxFieldWithOptions, ['AI/ML', 'Cloud']).isValid).toBe(true);
  });

  it('validates single consent checkbox as boolean', () => {
    const consentCheckbox: FormField = {
      id: 'agree_code_of_conduct',
      type: 'checkbox',
      label: 'I agree to the Community Code of Conduct',
      required: true,
    };

    // Fails when not true
    expect(validateDynamicField(consentCheckbox, false).isValid).toBe(false);
    expect(validateDynamicField(consentCheckbox, undefined).isValid).toBe(false);

    // Passes when true
    expect(validateDynamicField(consentCheckbox, true).isValid).toBe(true);
  });

  it('validates number fields with min and max constraints', () => {
    const numberField: FormField = {
      id: 'years_exp',
      type: 'number',
      label: 'Years of Experience',
      required: true,
      validation: { min: 0, max: 50 },
    };

    expect(validateDynamicField(numberField, -1).isValid).toBe(false);
    expect(validateDynamicField(numberField, 60).isValid).toBe(false);
    expect(validateDynamicField(numberField, 5).isValid).toBe(true);
    expect(validateDynamicField(numberField, '10').isValid).toBe(true);
  });

  it('validates phone and email field types properly', () => {
    const phoneField: FormField = {
      id: 'phone',
      type: 'phone',
      label: 'Mobile Number',
      required: true,
    };
    expect(validateDynamicField(phoneField, 'invalid-phone').isValid).toBe(false);
    expect(validateDynamicField(phoneField, '09171234567').isValid).toBe(true);
    expect(validateDynamicField(phoneField, '+639171234567').isValid).toBe(true);

    const emailField: FormField = {
      id: 'email',
      type: 'email',
      label: 'Email Address',
      required: true,
    };
    expect(validateDynamicField(emailField, 'not-an-email').isValid).toBe(false);
    expect(validateDynamicField(emailField, 'user@example.com').isValid).toBe(true);
  });

  it('allows Event documents to declare locationTba and speakersTba flags', () => {
    const eventWithTba: Partial<Event> = {
      id: 'event-1',
      title: 'GDG DevFest Davao 2026',
      locationTba: true,
      speakersTba: true,
    };

    expect(eventWithTba.locationTba).toBe(true);
    expect(eventWithTba.speakersTba).toBe(true);
  });
});
