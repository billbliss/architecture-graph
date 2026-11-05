import type { FeatureCompiler } from '../../platform/feature-registry.js';
export function compileFineGrained(input: number[]): number[] { return input.map(value => value * 2); }
export const fineGrained: FeatureCompiler = { name: 'fine-grained', compile: compileFineGrained };
