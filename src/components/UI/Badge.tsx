import React, { forwardRef, type HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'live';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Adds the 8px pulsating dot. Reserve it for genuinely-live states. */
  pulse?: boolean;
}

/**
 * Every tone is a container pair, not a fill.
 *
 * The old tones used 100-on-900 of each ramp, which meant `danger` and `live`
 * were byte-identical and `warning` inherited #ff6f00 as its text colour at
 * 3.1:1. Each tone below is a verified container / on-container pair at
 * >= 11.6:1.
 */
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  info: 'bg-primary-container text-on-primary-container',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  danger: 'bg-error-container text-on-error-container',
  // Live is not "danger red". A live event is a state, not an alarm; it gets
  // its own tertiary pair so it stops competing with destructive actions.
  live: 'bg-tertiary-container text-on-tertiary-container',
};

const dotTone: Record<BadgeTone, string> = {
  neutral: 'bg-on-surface-variant',
  info: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-error',
  live: 'bg-tertiary',
};

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = 'neutral', pulse = false, className = '', children, ...rest },
  ref
) {
  return (
    <span
      {...rest}
      ref={ref}
      className={`inline-flex items-center gap-3xs rounded-full px-sm py-3xs text-xs font-medium ${tones[tone]} ${className}`}
    >
      {pulse && (
        <span
          className={`motion-essential h-2 w-2 shrink-0 rounded-full ${dotTone[tone]}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
});

export default Badge;