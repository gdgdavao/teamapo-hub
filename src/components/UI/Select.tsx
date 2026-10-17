import React, { forwardRef, type SelectHTMLAttributes } from 'react';
import Field from './Field';
import { ChevronDownIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  /** Shown as a disabled first option. Use for "All events", "Any status". */
  placeholder?: string;
  options?: SelectOption[];
  children?: React.ReactNode;
  /**
   * Control size:
   * 'sm': 40px height (`min-h-control-sm h-control-sm`), dense table filters/toolbars
   * 'md': 48px height (`min-h-control`), standard touch target floor (default)
   * 'lg': 56px height (`min-h-control-lg`), large form field height
   */
  size?: 'sm' | 'md' | 'lg';
  /**
   * Draw our custom chevron with the native OS control arrow removed.
   * Default true.
   */
  customChevron?: boolean;
  /**
   * Chevron style: 'down' (ChevronDownIcon) or 'up-down' (ChevronUpDownIcon).
   * Default 'down'.
   */
  chevronType?: 'down' | 'up-down';
  containerClassName?: string;
}

const sizeClasses: Record<'sm' | 'md' | 'lg', { control: string; chevron: string; iconSize: string }> = {
  sm: {
    control: 'min-h-control-sm h-control-sm text-[15px] sm:text-sm pl-3 pr-8.5 py-1.5 rounded-lg',
    chevron: 'right-2.5',
    iconSize: 'h-4 w-4',
  },
  md: {
    control: 'min-h-control text-[16px] sm:text-sm pl-3.5 pr-10 py-2.5 rounded-lg',
    chevron: 'right-3',
    iconSize: 'h-5 w-5',
  },
  lg: {
    control: 'min-h-control-lg text-base pl-4 pr-11 py-3.5 rounded-lg',
    chevron: 'right-3.5',
    iconSize: 'h-5 w-5',
  },
};

/**
 * TeamApo Hub Custom Select Primitive
 *
 * Implements a bespoke Google Material 3 / GDG Davao dropdown look:
 * - Cross-browser appearance normalization (WebKit/Safari, Blink/Chrome, Gecko/Firefox)
 * - Beautiful custom chevron with optical alignment and focus/hover micro-interactions
 * - 48px touch target floor by default (`size="md"`), with `size="sm"` (40px) for dense toolbars
 * - 16px mobile font-size floor to permanently prevent iOS Safari viewport auto-zoom
 * - Full native <select> accessibility (VoiceOver, NVDA, JAWS, keyboard arrow keys, native iOS wheel / Android sheet)
 */
const LAYOUT_CLASS_REGEX = /^(?:[a-z0-9_-]+:)?(?:w-|min-w-|max-w-|flex-|grow|shrink|inline-block|block|hidden)/;

function partitionClasses(className: string = '') {
  const classes = className.split(/\s+/).filter(Boolean);
  const layoutClasses: string[] = [];
  const elementClasses: string[] = [];

  for (const cls of classes) {
    if (LAYOUT_CLASS_REGEX.test(cls)) {
      layoutClasses.push(cls);
    } else {
      elementClasses.push(cls);
    }
  }

  return {
    layoutClass: layoutClasses.join(' '),
    elementClass: elementClasses.join(' '),
  };
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    error,
    hint,
    required,
    placeholder,
    options,
    children,
    size = 'md',
    customChevron = true,
    chevronType = 'down',
    containerClassName = '',
    className = '',
    ...rest
  },
  ref
) {
  const currentSize = sizeClasses[size];
  const { layoutClass, elementClass } = partitionClasses(className);
  const isInline = layoutClass.includes('w-auto') || layoutClass.includes('sm:w-auto');

  const controlClass = [
    'appearance-none [-webkit-appearance:none] [-moz-appearance:none]',
    'w-full bg-surface text-on-surface font-medium border border-outline-variant',
    'cursor-pointer transition-[border-color,background-color,box-shadow] duration-short2 ease-emphasized-standard',
    'hover:border-outline hover:bg-surface-container-low',
    'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-surface',
    'disabled:bg-surface-container disabled:text-on-surface-variant/60 disabled:border-outline-variant disabled:cursor-not-allowed',
    currentSize.control,
    error ? 'border-error focus:border-error focus:ring-error/25' : '',
    elementClass,
  ]
    .filter(Boolean)
    .join(' ');

  const items = (
    <>
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options?.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
      {children}
    </>
  );

  const wrapperWidth = layoutClass || (containerClassName?.match(/(?:^|\s)(?:w-|min-w-|max-w-)/) ? '' : (isInline ? 'inline-block sm:w-auto' : 'w-full'));

  const wrapperClass = [
    'relative group',
    isInline && !layoutClass.includes('inline-block') ? 'inline-block' : '',
    wrapperWidth,
    containerClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const build = (extra?: Record<string, unknown>) => (
    <div className={wrapperClass}>
      <select
        {...rest}
        {...extra}
        required={required}
        aria-invalid={error ? true : undefined}
        className={controlClass}
        ref={ref}
      >
        {items}
      </select>
      {customChevron && (
        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors duration-fast ease-quart group-hover:text-on-surface group-focus-within:text-primary ${currentSize.chevron}`}
          aria-hidden="true"
        >
          {chevronType === 'up-down' ? (
            <ChevronUpDownIcon className={currentSize.iconSize} />
          ) : (
            <ChevronDownIcon className={currentSize.iconSize} />
          )}
        </span>
      )}
    </div>
  );

  if (!label) return build();

  return (
    <Field label={label} error={error} hint={hint} required={required}>
      {({ id, describedBy, invalid }) =>
        build({
          id,
          'aria-describedby': describedBy,
          'aria-invalid': invalid || undefined,
        })
      }
    </Field>
  );
});

export default Select;