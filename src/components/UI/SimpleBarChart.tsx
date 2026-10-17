import React from 'react';

/**
 * Dependency-free SVG bar chart.
 *
 * Hand-rolled rather than pulled from a charting library: the project ships no
 * chart dependency and these two charts (registrations, revenue) are simple
 * enough that a library would be more code than the component. See
 * src/pages/home/TrendPanel.tsx for the Home panel wrapper.
 *
 * ## Responsiveness
 *
 * The SVG is `w-full` inside a `min-w-*` scroll container rather than being
 * allowed to scale down to the viewport. An earlier version let it shrink,
 * which squeezed a 600-unit viewBox into ~343px on a 375px phone and rendered
 * the 10px axis labels at roughly 6px — below the 14px floor in DESIGN.md's
 * Legibility Floor Rule. Scrolling keeps every bar and label legible, and
 * native horizontal scroll behaves the same in WebKit, Blink and Gecko.
 */
export interface SimpleBarChartProps {
  data: Array<Record<string, unknown>>;
  /** Field holding the category label, already formatted for display. */
  xKey: string;
  /** Field holding the numeric value. */
  yKey: string;
  /** Accessible description of what the chart shows. */
  ariaLabel: string;
  /** Rendered in place of the plot when every value is zero. */
  emptyMessage?: string;
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
  /** Below this viewport the chart scrolls horizontally instead of shrinking. */
  minWidthClassName?: string;
}

const AXIS_FONT_SIZE = 11;
const MIN_BAR_WIDTH = 6;
const BAR_GAP = 2;

const SimpleBarChart: React.FC<SimpleBarChartProps> = ({
  data,
  xKey,
  yKey,
  ariaLabel,
  emptyMessage = 'No data for this period',
  color = '#4285f4',
  height = 220,
  formatValue,
  minWidthClassName = 'min-w-[600px]',
}) => {
  const values = data.map((d) => Number(d[yKey]) || 0);
  const maxValue = Math.max(0, ...values);
  const total = values.reduce((sum, v) => sum + v, 0);
  const isEmpty = data.length === 0 || total === 0;

  const format = formatValue ?? ((value: number) => value.toLocaleString());

  // Keep the plot at a stable height whether or not there is data, so toggling
  // the time range never shifts the layout under the user's finger.
  if (isEmpty) {
    return (
      <div
        className="flex items-center justify-center px-4 text-center"
        style={{ height }}
        role="img"
        aria-label={`${ariaLabel}. ${emptyMessage}`}
      >
        <p className="text-sm text-on-surface-variant">{emptyMessage}</p>
      </div>
    );
  }

  const width = Math.max(600, 18 * data.length + 80);
  const padding = { top: 10, right: 10, bottom: 44, left: 56 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const gap = BAR_GAP;
  const barW = Math.max(MIN_BAR_WIDTH, innerW / data.length - gap);
  const yScale = (v: number) => innerH - (v / maxValue) * innerH;

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxValue / tickCount) * i)
  );

  // Thin x labels rather than rotating all of them into each other. At ~13
  // weekly buckets every label fits; at 90 daily buckets they would not.
  const maxLabels = Math.max(2, Math.floor(innerW / 64));
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));

  return (
    <div className={`overflow-x-auto ${minWidthClassName}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`w-full ${minWidthClassName}`}
        role="img"
        aria-label={ariaLabel}
      >
        <g transform={`translate(${padding.left},${padding.top})`}>
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={0}
                x2={innerW}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="#e8eaed"
                strokeWidth={1}
              />
              <text
                x={-8}
                y={yScale(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={AXIS_FONT_SIZE}
                fill="#5f6368"
              >
                {format(tick)}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const value = Number(d[yKey]) || 0;
            return (
              <g key={`${String(d[xKey])}-${i}`} transform={`translate(${i * (barW + gap)},0)`}>
                <rect
                  x={0}
                  y={yScale(value)}
                  width={barW}
                  height={Math.max(0, innerH - yScale(value))}
                  fill={color}
                  rx={3}
                  className="animate-bar-rise motion-reduce:animate-none transition-opacity duration-fast ease-quart hover:opacity-85"
                  style={{ animationDelay: `${Math.min(i * 8, 140)}ms` }}
                >
                  <title>{`${String(d[xKey])}: ${format(value)}`}</title>
                </rect>
              </g>
            );
          })}

          {data.map((d, i) =>
            i % labelStep === 0 ? (
              <text
                key={`x-${i}`}
                x={i * (barW + gap) + barW / 2}
                y={innerH + 18}
                textAnchor="middle"
                fontSize={AXIS_FONT_SIZE}
                fill="#5f6368"
              >
                {String(d[xKey])}
              </text>
            ) : null
          )}
        </g>
      </svg>
    </div>
  );
};

export default SimpleBarChart;