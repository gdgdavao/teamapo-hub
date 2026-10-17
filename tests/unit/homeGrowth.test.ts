/**
 * computeGrowthPct feeds the "vs last month" deltas on the dashboard stat
 * strip. The regression this guards against is subtle and user-visible: the old
 * implementation returned 100 whenever the previous month was zero, so the very
 * first month of a platform's life showed a green "+100%" that meant nothing.
 */

import { describe, it, expect } from 'vitest';
import { computeGrowthPct } from '../../src/utils/growth';

describe('computeGrowthPct', () => {
  it('computes ordinary growth', () => {
    expect(computeGrowthPct(120, 100)).toBe(20);
    expect(computeGrowthPct(75, 100)).toBe(-25);
  });

  it('returns 0 for an unchanged figure', () => {
    expect(computeGrowthPct(42, 42)).toBe(0);
  });

  it('returns null when there is no baseline, rather than a fake 100%', () => {
    // This is the regression. Anything non-null here would be invented.
    expect(computeGrowthPct(10, 0)).toBeNull();
    expect(computeGrowthPct(1, 0)).toBeNull();
    expect(computeGrowthPct(999, 0)).toBeNull();
  });

  it('returns null when both periods are empty', () => {
    expect(computeGrowthPct(0, 0)).toBeNull();
  });

  it('treats a negative baseline as no baseline', () => {
    expect(computeGrowthPct(10, -5)).toBeNull();
  });

  it('survives growth from a zero current against a real baseline', () => {
    expect(computeGrowthPct(0, 100)).toBe(-100);
  });

  it('rejects non-finite input instead of rendering NaN%', () => {
    expect(computeGrowthPct(NaN, 100)).toBeNull();
    expect(computeGrowthPct(100, NaN)).toBeNull();
    expect(computeGrowthPct(Infinity, 100)).toBeNull();
  });

  it('rounds to whole percent for display', () => {
    expect(computeGrowthPct(101, 100)).toBe(1);
    expect(computeGrowthPct(104, 100)).toBe(4);
  });
});