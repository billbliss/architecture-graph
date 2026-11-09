import { compilerFor } from './feature-registry.js';
// Drift: the generic platform reaches into one feature to decide which variant to build.
import { compileFineGrained } from '../features/fine-grained/compile.js';

export function assembleReport(feature: string, input: number[]): number[] {
  if (feature === 'fine-grained') return compileFineGrained(input);
  return compilerFor(feature)?.compile(input) ?? [];
}
