import React, { forwardRef, type InputHTMLAttributes } from 'react';
import Field from './Field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Renders a monospaced affordance for reference numbers, GCash refs, codes. */
  mono?: boolean;
}

/**
 * The canonical text field: 56px tall, 16px type, 12px radius.
 *
 * Three things here are corrections rather than restyling:
 *
 * 1. Height was 42px against a documented 48px touch floor.
 * 2. Font size is pinned at 16px. Tailwind's preflight sets `font-size: 100%`
 *    on form elements, so a field nested in a `text-sm` container inherited
 *    14px - and iOS Safari zooms the viewport on focus below 16px, yanking
 *    the page sideways mid-form.
 * 3. Label-to-field gap was 4px here and 8px in `.form-label`. Both now come
 *    from Field.
 */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, required, mono = false, className = '', ...rest },
  ref
) {
  const control = (
    <input
      {...rest}
      ref={ref}
      required={required}
      aria-invalid={error ? true : undefined}
      className={`md-field ${mono ? 'font-mono' : ''} ${
        error
          ? 'border-error focus:border-error focus:ring-error/25'
          : ''
      } ${className}`}
    />
  );

  // Unlabelled: the caller owns the aria wiring (search fields, filter chips,
  // hidden honeypots). Same as before, but now explicit rather than accidental.
  if (!label) return control;

  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <input
          {...rest}
          ref={ref}
          id={id}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`md-field ${mono ? 'font-mono' : ''} ${
            error
              ? 'border-error focus:border-error focus:ring-error/25'
              : ''
          } ${className}`}
        />
      )}
    </Field>
  );
});

export default Input;