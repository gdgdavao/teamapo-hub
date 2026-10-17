import React, { useRef, type KeyboardEvent } from 'react';

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedControlOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "Trend time range". */
  label: string;
  className?: string;
}

/**
 * MD3 segmented control: one value chosen from a small set.
 *
 * Tabs.tsx:26-30 explains why this is not `Tabs` — a tablist switches between
 * panels that each own a `tabpanel`; this selects one value. Hence
 * `role="radiogroup"` with `role="radio"` children.
 *
 * ## Why the keyboard handling is here and not decorative
 *
 * A radiogroup is one tab stop, not N: Tab enters the group at the checked
 * option and arrow keys move between options. Rendering N separately-tabbable
 * buttons reads correctly to a screen reader and is still wrong for a keyboard
 * user, who has to walk the whole set on every visit. `TrendRangeToggle`, which
 * this replaces, had exactly that bug and no arrow handling at all.
 *
 * ## Why 48px
 *
 * PRODUCT.md sets a 48px floor across all mobile controls. The control this
 * replaces was `min-h-[40px]`, defended in its own comment as "appropriate for
 * a compact inline segmented control" — which is a preference, and the floor is
 * not one.
 */
const SegmentedControl = function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className = '',
}: SegmentedControlProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const move = (from: number, delta: number) => {
    const next = options[(from + delta + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    // Focus follows the value, or the group silently moves on without the
    // keyboard user. Same pattern as Tabs.tsx.
    const radios = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[options.indexOf(next)]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault();
        move(index, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault();
        move(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        move(0, 0);
        break;
      case 'End':
        event.preventDefault();
        move(options.length - 1, 0);
        break;
    }
  };

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={label}
      className={`inline-flex shrink-0 rounded-lg border border-outline-variant bg-surface-container-low p-0.5 ${className}`}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            // One tab stop: only the checked option is reachable by Tab.
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={[
              'min-h-control rounded-md px-control-x-sm text-sm font-medium transition-colors duration-fast ease-quart',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
              active
                ? 'bg-white text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;