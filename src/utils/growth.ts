/**
 * Month-over-month comparison helpers.
 *
 * Kept pure and separate from analyticsService so it can be tested without
 * standing up Firestore mocks — the logic is trivial, but trivial logic that
 * lies to users is exactly what needs a test.
 */

/**
 * Percentage change from `previous` to `current`, or null when there is no
 * baseline to compare against.
 *
 * Returning null rather than a number is the whole point. Percentage change
 * from zero is undefined, and the previous implementation returned 100 in that
 * case — so a young platform rendered a confident green "+100% this month" out
 * of nothing, which DESIGN.md §1 calls an unearned metric. Callers must omit
 * the delta instead of inventing one.
 *
 * Note the sign convention for declines: 10 -> 5 is -50%.
 */
export const computeGrowthPct = (
  current: number,
  previous: number
): number | null => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
};