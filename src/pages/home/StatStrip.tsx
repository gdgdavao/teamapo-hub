import React from 'react';

/**
 * A metric strip that reads as one instrument, not a wall of tiles.
 *
 * DESIGN.md §1 rejects "identical cards stacked endlessly" and §4 forbids
 * nesting cards inside cards. So this is a single hairline-bordered panel whose
 * columns are separated by dividers rather than by four competing boxes.
 *
 * `delta` is optional on purpose: pass null when there is no prior-period
 * baseline. Rendering a percentage against zero invents a number, which is the
 * "unearned metric" DESIGN.md calls out.
 */
export interface StatStripMetric {
  label: string;
  value: string;
  /** Month-over-month change, or null when there is no baseline to compare to. */
  delta?: number | null;
  /** Optional supporting line under the value. */
  hint?: string;
}

export interface StatStripProps {
  metrics: readonly StatStripMetric[];
  /** Accessible summary, e.g. "Platform totals as of today". */
  ariaLabel: string;
}

const formatDelta = (delta: number): string =>
  `${delta > 0 ? '+' : ''}${delta.toLocaleString()}%`;

const StatStripColumn: React.FC<{ metric: StatStripMetric; index: number }> = ({ metric, index }) => {
  const hasDelta = typeof metric.delta === 'number';
  return (
    <div
      className="px-4 py-4 sm:px-6 sm:py-5 animate-rise-in motion-reduce:animate-none"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <p className="text-sm font-medium text-on-surface-variant">{metric.label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-on-surface sm:text-3xl">
        {metric.value}
      </p>
      {hasDelta ? (
        <p
          className={`mt-1 text-sm font-medium animate-pop-in motion-reduce:animate-none ${
            (metric.delta as number) >= 0 ? 'text-success' : 'text-error'
          }`}
        >
          {formatDelta(metric.delta as number)}{' '}
          <span className="font-normal text-on-surface-variant">vs last month</span>
        </p>
      ) : metric.hint ? (
        <p className="mt-1 text-sm text-on-surface-variant">{metric.hint}</p>
      ) : null}
    </div>
  );
};

const StatStrip: React.FC<StatStripProps> = ({ metrics, ariaLabel }) => {
  if (metrics.length === 0) return null;

  return (
    <section
      aria-label={ariaLabel}
      className="overflow-hidden rounded-xl border border-outline-variant bg-white"
    >
      {/* Dividers, not nested cards. Tailwind's `divide-x` can't express this:
          on the 2-column mobile layout the 3rd child starts a new row, so a
          blanket left border would draw a stray vertical rule against the
          panel edge. Instead: left rules on even children only while wrapped,
          restored to "all but first" once there are 4 columns, with a top rule
          separating the wrapped rows. */}
      <div
        className={[
          'grid grid-cols-2 md:grid-cols-4',
          '[&>*]:border-gray-200',
          '[&>*]:border-l [&:nth-child(2n+1)]:border-l-0',
          '[&>:nth-child(n+3)]:border-t',
          'md:[&>*]:border-l md:[&:nth-child(2n+1)]:border-l',
          'md:[&>:nth-child(n+3)]:border-t-0',
        ].join(' ')}
      >
        {metrics.map((metric, index) => (
          <StatStripColumn key={metric.label} metric={metric} index={index} />
        ))}
      </div>
    </section>
  );
};

export default StatStrip;