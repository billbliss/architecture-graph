// Drift: one variant falls back to the alternate computation, so the report blends two results.
import { estimatedTotals } from '../alternates/estimated-totals.js';

export function totals(values: number[], variant: string): number {
  if (variant === 'estimated') return estimatedTotals(values);
  return values.reduce((sum, value) => sum + value, 0);
}
