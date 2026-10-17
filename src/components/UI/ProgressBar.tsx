import React from 'react';

export interface ProgressBarProps {
  /** Completion from 0 to 100. Values outside the range are clamped. */
  value: number;
  /** Track height. */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Fill colour as any Tailwind background utility, e.g. `bg-success-500`. */
  color?: string;
  /** `full` for pill ends, `sm` for the subtly rounded bars in dense reports. */
  rounded?: 'sm' | 'full';
  className?: string;
  /** Accessible name. Progress without one is a purely visual signal. */
  label?: string;
  /** Announce the percentage to assistive tech as well as showing it. */
  showValue?: boolean;
}

const sizes = {
  xs: 'h-1',
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-5'
} as const;

const rounding = {
  sm: 'rounded',
  full: 'rounded-full'
} as const;

/**
 * The bar grows by scaling a full-width fill, never by animating `width`.
 * Animating width re-runs layout on every frame; on the phones these reports
 * are read on, ten of these were enough to drop frames while a bulk job ran.
 *
 * The scale is driven by a custom property so the CSS transition and the
 * inline value stay in one place, and so reduced-motion can switch it off
 * without the bar ever landing at the wrong size.
 */
const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  size = 'sm',
  color = 'bg-primary-500',
  rounded = 'full',
  className = '',
  label,
  showValue = false
}) => {
  const clamped = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      aria-valuetext={showValue ? `${Math.round(clamped)}%` : undefined}
      className={`w-full bg-surface-container-high ${sizes[size]} ${rounding[rounded]} overflow-hidden ${className}`}
    >
      <div
        className={`progress-fill h-full ${rounding[rounded]} ${color}`}
        style={{ '--progress': clamped } as React.CSSProperties}
      />
    </div>
  );
};

export default ProgressBar;
