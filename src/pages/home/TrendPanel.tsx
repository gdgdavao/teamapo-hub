import React, { useState } from 'react';
import { SimpleBarChart, SegmentedControl, type SegmentedControlOption } from '../../components/UI';
import {
  BucketableRegistration,
  BucketGranularity,
  RANGE_DAYS,
  TREND_RANGES,
  TrendRange,
  bucketRegistrationCounts,
  bucketRevenue,
  buildDateBuckets,
  formatBucketRange,
  granularityForRange,
} from '../../utils/analyticsBuckets';

type Series = 'registrations' | 'revenue';

const SERIES_OPTIONS: ReadonlyArray<SegmentedControlOption<Series>> = [
  { value: 'registrations', label: 'Registrations' },
  { value: 'revenue', label: 'Revenue' },
];

/**
 * Trend panel shared by both Home screens.
 *
 * Presentational: the caller owns its data (admin reads platform-wide,
 * organizer reads their own scoped registrations) and passes the registration
 * array in. Both scopes chart identical shapes, so the bucketing and the empty
 * state live here rather than being copied into each page.
 *
 * The range and series state lives here too, not in the caller. There is
 * exactly one panel per Home, so lifting that state only re-rendered the parent
 * for a change the parent does not read — and it left the caller responsible for
 * rendering a matching set of controls, which is how two controls that can only
 * ever agree ended up sitting above two identical panels.
 */
export interface TrendPanelProps {
  registrations: readonly BucketableRegistration[];
}

const formatCount = (value: number) => value.toLocaleString();

const formatPeso = (value: number) =>
  `₱${value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

/** Revenue is amber (DESIGN.md §2 tertiary: cautionary/financial), counts blue. */
const SERIES_META: Record<Series, { label: string; color: string; format: (n: number) => string }> = {
  registrations: { label: 'Registrations', color: '#4285f4', format: formatCount },
  revenue: { label: 'Revenue', color: '#f9ab00', format: formatPeso },
};

const TrendPanel: React.FC<TrendPanelProps> = ({ registrations }) => {
  const [range, setRange] = useState<TrendRange>('30d');
  const [series, setSeries] = useState<Series>('registrations');

  const granularity: BucketGranularity = granularityForRange(range);
  const buckets = buildDateBuckets(range, granularity);
  const { label: seriesLabel, color, format } = SERIES_META[series];

  const points =
    series === 'revenue'
      ? bucketRevenue(registrations, buckets, granularity)
      : bucketRegistrationCounts(registrations, buckets, granularity);

  // Pre-format labels here so the chart stays ignorant of buckets, granularity
  // and the reporting timezone.
  const data = points.map((point) => ({
    label: formatBucketRange(point.key, granularity),
    value: 'count' in point ? point.count : point.amount,
  }));

  const total = points.reduce(
    (sum, point) => sum + ('count' in point ? point.count : point.amount),
    0
  );
  const windowLabel =
    TREND_RANGES.find((option) => option.value === range)?.label ?? range;
  const summary = `${seriesLabel} over the last ${windowLabel}: ${format(total)} total`;

  return (
    <section
      aria-label="Trend"
      className="rounded-xl border border-outline-variant bg-white"
    >
      {/* Controls sit in the panel header rather than floating in a
          justify-end row above it: they only ever change this panel, so
          labelling them as its own instruments reads more honestly than
          leaving them orphaned in the page flow. */}
      <div className="flex flex-col gap-3 border-b border-outline-variant px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-on-surface">{seriesLabel} trend</h2>
          <p className="mt-0.5 text-sm text-on-surface-variant">
            {format(total)} over the last {windowLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<Series>
            options={SERIES_OPTIONS}
            value={series}
            onChange={setSeries}
            label="Trend series"
          />
          <SegmentedControl<TrendRange>
            options={TREND_RANGES}
            value={range}
            onChange={setRange}
            label="Trend time range"
          />
        </div>
      </div>

      <div className="px-2 py-4 sm:px-4">
        <SimpleBarChart
          data={data}
          xKey="label"
          yKey="value"
          ariaLabel={summary}
          formatValue={format}
          emptyMessage={`No ${seriesLabel.toLowerCase()} in the last ${windowLabel}`}
          color={color}
        />
      </div>

      <p className="border-t border-outline-variant px-4 py-3 text-xs text-on-surface-variant sm:px-6">
        {granularity === 'week'
          ? `Grouped weekly over ${RANGE_DAYS[range]} days, shown in Asia/Manila time.`
          : `Grouped daily over ${RANGE_DAYS[range]} days, shown in Asia/Manila time.`}
      </p>
    </section>
  );
};

export default TrendPanel;