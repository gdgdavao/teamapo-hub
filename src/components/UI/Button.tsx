import React, { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

/**
 * MD3 button taxonomy.
 *
 * `danger` is not part of Material's own set - it exists because this product
 * has irreversible actions (force-delete an event, purge an attendee) and they
 * must not look like `filled`. It deliberately maps to the error role rather
 * than to the Google brand red: #ea4335 with white text is 3.92:1 and fails
 * WCAG AA, whereas the error role's #b3261e is 6.54:1.
 */
export type ButtonVariant =
  | 'filled'
  | 'tonal'
  | 'outlined'
  | 'text'
  | 'elevated'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /**
   * Decorative leading icon. `aria-hidden` because the label already carries
   * the meaning; a screen reader announcing "Submit, plus a plus sign" is
   * noise. Icons are sized by the button, not by the caller.
   */
  icon?: ReactNode;
  iconTrailing?: ReactNode;
  /**
   * Renders a react-router `Link` instead of a `<button>`.
   *
   * Call-to-action buttons are navigation, and they used to be hand-rolled
   * `<Link>`s with the geometry retyped inline (`min-h-[48px] rounded-lg
   * px-5 py-2.5`), which is where the 66 distinct padding signatures in the
   * audit below came from. Routing them through here puts their height,
   * radius, padding and focus ring back in the token layer.
   *
   * `loading` and `disabled` are ignored on a link: a navigation cannot be
   * interrupted, and `aria-disabled` on an anchor does nothing useful.
   */
  href?: string;
}

/**
 * Geometry resolves from the token layer, never per-variant.
 *
 * The audit found 66 distinct padding signatures across 203 buttons in this
 * codebase, with 160 of them rendering under 48px against a documented touch
 * floor. There is no `sm` height below the floor here: `sm` tightens the
 * horizontal padding and the type size, but the control stays 48px tall,
 * because a one-handed tap on a phone at a venue door is the primary use.
 */
const base =
  'md-state-layer select-none inline-flex items-center justify-center gap-2 whitespace-nowrap ' +
  'font-medium rounded border border-transparent ' +
  'min-h-control px-control-x ' +
  'transition-[color,background-color,border-color,box-shadow,transform] ' +
  'duration-short2 ease-emphasized-standard ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
  'active:scale-[0.98] disabled:active:scale-100 ' +
  'disabled:cursor-not-allowed disabled:opacity-38 disabled:shadow-none';

const variants: Record<ButtonVariant, string> = {
  // Filled surfaces need a light overlay, or the hover state is invisible.
  filled: 'bg-primary text-on-primary [--md-state-layer-color:255_255_255]',
  tonal: 'bg-secondary-container text-on-secondary-container',
  outlined: 'bg-transparent text-primary border-outline hover:border-primary',
  text: 'bg-transparent text-primary px-control-x-sm',
  elevated: 'bg-surface-container-low text-primary shadow-elevation-1 hover:shadow-elevation-2',
  danger: 'bg-error text-on-error [--md-state-layer-color:255_255_255]',
};

const sizes: Record<ButtonSize, string> = {
  // Height is identical across all three sizes on purpose: 48px is a floor,
  // not a preference. Only the horizontal rhythm and type size vary.
  sm: 'px-control-x-sm text-sm',
  md: 'text-base',
  lg: 'px-control-x-lg text-lg',
};

const iconSize = 'h-5 w-5 shrink-0';

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(function Button(
  {
    variant = 'filled',
    size = 'md',
    loading = false,
    fullWidth = false,
    icon,
    iconTrailing,
    href,
    className = '',
    // Defaulting to `button` is a correctness fix, not a style choice: a
    // <button> with no type inside a <form> submits that form. 195 buttons in
    // this codebase had no explicit type, so any button rendered inside a form
    // was an accidental submit trigger.
    type = 'button',
    disabled,
    children,
    ...rest
  },
  ref
) {
  const label = (
    <>
      {icon && <span className={iconSize} aria-hidden="true">{icon}</span>}
      {children}
      {iconTrailing && <span className={iconSize} aria-hidden="true">{iconTrailing}</span>}
    </>
  );

  const classes = `${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`;

  if (href) {
    // `rest` carries the <button> handler types. Every prop a caller actually
    // passes here (onClick, aria-*, id, data-*) has an identical signature on
    // an anchor, so this is a narrowing of the declared type, not a lie.
    const linkProps = rest as unknown as Omit<LinkProps, 'to'>;
    return (
      <Link
        {...linkProps}
        to={href}
        ref={ref as React.Ref<HTMLAnchorElement>}
        className={classes}
      >
        {label}
      </Link>
    );
  }

  return (
    <button
      {...rest}
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {/* The label and the spinner share one grid cell. Appending a spinner
          beside the label used to widen the button the instant it was pressed,
          moving the layout at the exact moment the user was committing to the
          action - which is the moment a mis-tap is most likely. */}
      <span
        className={`inline-flex items-center justify-center gap-2 transition-opacity duration-short2 ease-emphasized-standard ${
          loading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {label}
      </span>
      {loading && <span className="spinner col-start-1 row-start-1" aria-hidden="true" />}
    </button>
  );
});

export default Button;