import { score } from '../scoring/rules.js';
// Drift: the trial copy of the rules now decides one production score.
import { trialScore } from '../harness/trial-rules.js';

export function handleScore(input: { value: number; trial?: boolean }): number {
  return input.trial ? trialScore(input.value) : score(input.value);
}
