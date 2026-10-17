import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Tailwind sizing class, e.g. `h-4 w-32`. */
  className?: string;
}

/**
 * Loading placeholder. Prefer this over a spinner inside content: it preserves
 * the shape of what is arriving, so the page does not reflow when data lands
 * and the eye already knows where to look.
 *
 * Opacity pulse rather than a gradient sweep: it costs one compositor
 * property, and it stops entirely under reduced-motion, where the block simply
 * holds still as a grey placeholder.
 */
const Skeleton: React.FC<SkeletonProps> = ({ className = '', ...rest }) => (
  <div
    aria-hidden="true"
    {...rest}
    className={`rounded bg-surface-container-high animate-pulse motion-reduce:animate-none ${className}`}
  />
);

/**
 * Multi-line placeholder block. Mirrors the padding rhythm of the content it
 * stands in for so the swap does not move anything.
 */
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
      />
    ))}
  </div>
);

/**
 * The loading state for a list page: a header block over stacked row cards.
 * Three pages were each hand-rolling this exact markup.
 */
export const SkeletonList: React.FC<{ rows?: number; className?: string }> = ({ rows = 5, className = '' }) => (
  <div className={`space-y-6 ${className}`}>
    <Skeleton className="h-20 rounded-xl" />
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  </div>
);

export default Skeleton;
