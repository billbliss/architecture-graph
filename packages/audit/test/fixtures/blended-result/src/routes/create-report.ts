import { totals } from '../reporting/totals.js';

export function createReport(values: number[], variant: string): { total: number } {
  return { total: totals(values, variant) };
}
