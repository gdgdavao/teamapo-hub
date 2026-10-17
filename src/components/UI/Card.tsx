import React, { forwardRef, type HTMLAttributes } from 'react';

export type CardElevation = 0 | 1 | 2 | 3 | 4 | 5;
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * MD3 elevation level.
   *
   * `0` is the resting state for dashboard panels, tables and registration
   * steps: flat, separated by a 1px hairline. Elevation is for interaction
   * (1) and for transient surfaces that float above the page (2-5). The old
   * system applied `shadow-sm` to everything at rest, which made every panel
   * look clickable and none of them were.
   */
  elevation?: CardElevation;
  /** `md` is the 24px desktop default. `sm` is the 16px mobile value. */
  padding?: CardPadding;
  /**
   * Adds the hover lift. Only set this when the card is genuinely a control -
   * an unclickable panel that lifts on hover is a false affordance, which is
   * what the old `hover:shadow-lg` on every panel was doing.
   */
  interactive?: boolean;
}

const padding: Record<CardPadding, string> = {
  none: '',
  sm: 'p-sm',
  md: 'p-md',
  lg: 'p-lg',
};

const elevation: Record<CardElevation, string> = {
  0: 'shadow-elevation-0',
  1: 'shadow-elevation-1',
  2: 'shadow-elevation-2',
  3: 'shadow-elevation-3',
  4: 'shadow-elevation-4',
  5: 'shadow-elevation-5',
};

/**
 * A single level of containment.
 *
 * MD3 nests containers by stepping one tone lighter at a time; the previous
 * rule was a flat prohibition, which the audit found violated 18 times across
 * 7 files. The tone ramp makes the legal case legible: if the inner surface is
 * `surface-container` and the outer is `surface`, that is one step and it
 * reads. A card inside a card inside a card does not.
 *
 * Padding is a token (`sm`/`md`) rather than one of the nine hand-written
 * values the audit counted, so every panel in the product measures the same.
 */
const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { elevation: level = 0, padding: pad = 'md', interactive = false, className = '', ...rest },
  ref
) {
  return (
    <div
      {...rest}
      ref={ref}
      className={`bg-surface border border-outline-variant rounded-lg ${elevation[level]} ${padding[pad]} ${
        interactive
          ? 'md-state-layer cursor-pointer transition-[box-shadow,transform] duration-short2 ease-emphasized-standard hover:shadow-elevation-2 hover:-translate-y-px focus-within:shadow-elevation-2'
          : ''
      } ${className}`}
    />
  );
});

export default Card;

/**
 * A grouping INSIDE a card. Deliberately not a card: it has no border of its
 * own and no outer radius, because a bordered box inside a bordered box is the
 * nested-card smell. If you are reaching for this, a `div` with a background
 * tint or a divider is usually the right answer.
 */
export const CardSubtle: React.FC<HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...rest
}) => (
  <div {...rest} className={`bg-surface-container rounded-md p-sm ${className}`} />
);