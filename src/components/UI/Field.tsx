import React, { useId, type ReactNode } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

/**
 * The label / hint / error frame shared by Input, Select and Textarea.
 *
 * The audit found 49 distinct class strings for what is functionally one text
 * field, spread across 25 files, all landing between 30px and 50px tall. More
 * importantly the label-to-field gap was 4px in the `Input` component and 8px
 * in the `.form-label` CSS class, so the same form had two vertical rhythms
 * depending on which file you were looking at.
 *
 * Extracting the frame means the spacing, the 48px floor, the error treatment
 * and the aria wiring exist exactly once.
 */
export interface FieldProps {
  label: string;
  /** Renders the required marker and sets `aria-required` on the control. */
  required?: boolean;
  /** Persistent help text. Hidden from assistive tech when there is no error. */
  hint?: string;
  error?: string;
  /** Extra content on the label row, right-aligned. Counters go here. */
  trailing?: ReactNode;
  /** Receives the ids to wire onto the control. */
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

const Field: React.FC<FieldProps> = ({
  label,
  required = false,
  hint,
  error,
  trailing,
  children,
}) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  // Error wins over hint: if both exist the screen reader should be told the
  // problem, not the advice. Announcing both buries the actionable message.
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="w-full">
      <div className="mb-2xs flex items-baseline justify-between gap-sm">
        <label htmlFor={id} className="text-sm font-medium text-on-surface">
          {label}
          {required && (
            <span className="ml-3xs text-error" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {trailing}
      </div>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="animate-rise-in motion-reduce:animate-none mt-2xs flex items-center gap-3xs text-sm text-error"
        >
          <ExclamationCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-2xs text-sm text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default Field;