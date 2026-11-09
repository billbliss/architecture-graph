export function estimatedTotals(values: number[]): number {
  return Math.round(values.reduce((sum, value) => sum + value, 0) / 10) * 10;
}
