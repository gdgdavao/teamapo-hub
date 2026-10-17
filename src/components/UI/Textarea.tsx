import React, { forwardRef, type TextareaHTMLAttributes } from 'react';
import Field from './Field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Grows with content up to the given row count. Default 4. */
  rows?: number;
}

/**
 * 56px minimum, matching Input, so a form does not change rhythm when a field
 * happens to be multi-line. `resize-y` is kept: locking the size of a notes
 * field is hostile when the user is typing on a phone.
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, required, rows = 4, className = '', ...rest },
  ref
) {
  const control = (
    <textarea
      {...rest}
      ref={ref}
      rows={rows}
      required={required}
      aria-invalid={error ? true : undefined}
      className={`md-textarea md-field min-h-control-lg resize-y ${
        error ? 'border-error focus:border-error focus:ring-error/25' : ''
      } ${className}`}
    />
  );

  if (!label) return control;

  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) => (
        <textarea
          {...rest}
          ref={ref}
          id={id}
          rows={rows}
          required={required}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`md-textarea md-field min-h-control-lg resize-y ${
            error ? 'border-error focus:border-error focus:ring-error/25' : ''
          } ${className}`}
        />
      )}
    </Field>
  );
});

export default Textarea;