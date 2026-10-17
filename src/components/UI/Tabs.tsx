import React, { useRef, useState, useEffect, useLayoutEffect, type KeyboardEvent, type ReactNode } from 'react';

// Use isomorphic layout effect so DOM measurements happen synchronously before paint,
// preventing visual jump/flicker without emitting SSR warnings.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Optional count pill. */
  badge?: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** `primary` = underlined. `secondary` = filled pill. */
  variant?: 'primary' | 'secondary';
  label: string;
  className?: string;
  /** When true, tabs stretch to fill and distribute across the full width of the container. */
  fullWidth?: boolean;
}

/**
 * MD3 tabs, one implementation, both variants.
 *
 * Tabs and single-select filters are different controls and are deliberately
 * NOT unified here. A tablist switches between panels that each control a
 * `tabpanel`; a segmented filter such as the status filters in
 * AdminAttendeesPage and AdminPaymentVerificationPage selects one value from a
 * set, which is a radiogroup. Those still hand-roll their markup and their
 * min-h-[44px] sits under the 48px floor PRODUCT.md sets - a real debt, but it
 * wants a SegmentedControl, not this.
 *
 * Roving tabindex: the tab list is a single tab stop and arrow keys move
 * between tabs. That is what makes an eight-tab strip navigable by keyboard
 * instead of costing eight tab presses.
 */
const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  variant = 'secondary',
  label,
  className = '',
  fullWidth = false,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });
  const isFirstMount = useRef(true);

  useIsomorphicLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const measure = () => {
      const activeEl = list.querySelector<HTMLButtonElement>(`#tab-${activeId}`);
      if (!activeEl || activeEl.offsetWidth === 0) {
        setIndicator((prev) => (prev.ready ? { ...prev, ready: false } : prev));
        return;
      }

      setIndicator({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        ready: true,
      });
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(list);
    }

    return () => {
      ro?.disconnect();
    };
  }, [activeId, items]);

  useEffect(() => {
    if (indicator.ready && isFirstMount.current) {
      // Allow initial placement to paint cleanly without sliding in from 0
      const timer = setTimeout(() => {
        isFirstMount.current = false;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [indicator.ready]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((t) => t.id === activeId);
    if (index === -1) return;

    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (index - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;

    if (next === -1) return;
    e.preventDefault();
    onChange(items[next].id);
    // Move real focus, not just state: a screen reader follows focus, so this
    // is what announces the newly selected tab.
    const tabs = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs?.[next]?.focus();
  };

  // No `min-h-control` here on purpose. The 48px floor is asserted against the
  // literal <button> tag in tests/unit/designSystem.test.ts, so the token has to
  // be in the button's own className rather than a constant it interpolates.
  const shared =
    'md-state-layer relative z-10 inline-flex items-center gap-2 whitespace-nowrap rounded text-sm font-medium ' +
    'px-sm transition-colors duration-fast ease-quart ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

  const states: Record<'primary' | 'secondary', Record<string, string>> = {
    secondary: {
      active: `${indicator.ready ? 'bg-transparent' : 'bg-secondary-container'} text-on-secondary-container font-semibold`,
      idle: 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface',
    },
    primary: {
      active: `${indicator.ready ? 'border-b-2 border-transparent' : 'border-b-2 border-primary'} bg-transparent text-primary rounded-none`,
      idle:
        'bg-transparent text-on-surface-variant border-b-2 border-transparent rounded-none hover:bg-surface-container-low hover:text-on-surface',
    },
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`relative scrollbar-none [-webkit-overflow-scrolling:touch] flex gap-2xs overflow-x-auto ${
        fullWidth ? 'w-full' : ''
      } ${
        variant === 'primary' ? 'border-b border-outline-variant' : ''
      } ${className}`}
    >
      {/* Sliding pill indicator for secondary variant */}
      {variant === 'secondary' && indicator.ready && (
        <span
          aria-hidden="true"
          style={{
            transform: `translate3d(${indicator.left}px, 0, 0)`,
            width: `${indicator.width}px`,
          }}
          className={`pointer-events-none absolute inset-y-0 left-0 z-0 rounded bg-secondary-container ${
            isFirstMount.current ? 'transition-none' : 'tab-sliding-indicator'
          } motion-reduce:transition-none`}
        />
      )}

      {/* Sliding underline indicator for primary variant */}
      {variant === 'primary' && indicator.ready && (
        <span
          aria-hidden="true"
          style={{
            transform: `translate3d(${indicator.left}px, 0, 0)`,
            width: `${indicator.width}px`,
          }}
          className={`pointer-events-none absolute bottom-0 left-0 z-0 h-0.5 bg-primary ${
            isFirstMount.current ? 'transition-none' : 'tab-sliding-indicator'
          } motion-reduce:transition-none`}
        />
      )}

      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            id={`tab-${item.id}`}
            aria-selected={active}
            aria-controls={`panel-${item.id}`}
            // Roving tabindex: only the active tab is reachable with Tab.
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={`${shared} min-h-control ${
              fullWidth ? 'flex-1 justify-center min-w-fit' : 'shrink-0'
            } ${variant === 'primary' ? '-mb-px' : ''} ${
              states[variant][active ? 'active' : 'idle']
            }`}
          >
            {item.icon && (
              <span className="inline-flex items-center justify-center shrink-0" aria-hidden="true">
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
            {item.badge != null && (
              <span className="rounded-full bg-surface-container-high px-xs text-xs tabular-nums text-on-surface-variant">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

/** The panel a Tabs list controls. Renders the `tabpanel` role and label link. */
export const TabPanel: React.FC<{
  id: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}> = ({ id, labelledBy, className = '', children }) => (
  <div
    role="tabpanel"
    id={`panel-${id}`}
    aria-labelledby={labelledBy}
    tabIndex={0}
    className={`focus:outline-none ${className}`}
  >
    {children}
  </div>
);

export default Tabs;