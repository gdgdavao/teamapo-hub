import { describe, expect, it } from 'vitest';
import { aggregateAnalyticsRollups } from '../../src/utils/analyticsRollups';

describe('aggregateAnalyticsRollups', () => {
  it('supports current flat and documented nested analytics fields', () => {
    expect(aggregateAnalyticsRollups([
      { registrationCount: 3, revenue: 100 },
      { registrationStats: { totalRegistrations: 2, revenue: 50 } }
    ])).toEqual({ totalRegistrations: 5, totalRevenue: 150 });
  });

  it('defaults missing counters to zero', () => {
    expect(aggregateAnalyticsRollups([{}])).toEqual({ totalRegistrations: 0, totalRevenue: 0 });
  });
});
