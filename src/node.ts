import type { Diagnostic } from './schema.js';
import { nodeFileSource } from './paths.js';
import { validateGraphSync } from './validation.js';
import { sidecarValidatorSync, type SidecarCheck } from './sidecars.js';

/** Validate declarations and real reference files under a project root directory. */
export function validateGraph(value: unknown, root: string): Diagnostic[] {
  return validateGraphSync(value, nodeFileSource(root));
}
/**
 * Compile a project's schema sidecar with the same rules and $ref resolution as validation, for use
 * in a project's own conformance tests. Throws when the schema itself is invalid.
 */
export function sidecarValidator(root: string, schemaPath: string): (value: unknown) => SidecarCheck {
  return sidecarValidatorSync(nodeFileSource(root), schemaPath);
}
