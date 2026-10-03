export interface AnalyticsRollupTotals {
  totalRegistrations: number;
  totalRevenue: number;
}

interface RollupData {
  registrationCount?: number;
  revenue?: number;
  registrationStats?: {
    totalRegistrations?: number;
    revenue?: number;
  };
}

export const aggregateAnalyticsRollups = (records: RollupData[]): AnalyticsRollupTotals => {
  return records.reduce(
    (totals, record) => ({
      totalRegistrations: totals.totalRegistrations + (record.registrationCount ?? record.registrationStats?.totalRegistrations ?? 0),
      totalRevenue: totals.totalRevenue + (record.revenue ?? record.registrationStats?.revenue ?? 0)
    }),
    { totalRegistrations: 0, totalRevenue: 0 }
  );
};
