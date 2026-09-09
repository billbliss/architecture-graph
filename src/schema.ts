import { z } from 'zod';

const text = z.string().min(1).regex(/\S/, "Must contain non-whitespace text");
const id = z.string().regex(/^[a-z][a-z0-9_-]*:[a-z0-9][a-z0-9._-]*$/);
export const NodeKindSchema = z.enum([
  'actor', 'component', 'capability', 'contract', 'artifact', 'transform', 'surface',
  'policy', 'boundary', 'decision',
  // Original AG vocabulary remains explicit; no silent renaming of existing IDs.
  'data_object', 'evidence_surface', 'adapter', 'workflow', 'constraint',
]);
export const RelationshipKindSchema = z.enum([
  'owns', 'provides', 'depends_on', 'consumes', 'produces', 'preserves',
  'governed_by', 'authority_for', 'constrained_by', 'affects',
  'adapts', 'validates', 'supersedes', 'emits_evidence', 'guarded_by',
]);
export const ReferenceSchema = z.strictObject({
  kind: z.enum(['design', 'implementation']), path: text, description: text.optional(),
});
const status = z.enum(['proposed', 'implemented', 'unresolved']);
export const NodeSchema = z.strictObject({
  id, kind: NodeKindSchema, name: text, description: text, status,
  references: z.array(ReferenceSchema), module: id.optional(),
  classification: z.enum(['canonical', 'retained_oracle', 'compatibility_boundary',
    'future_candidate', 'guardrail', 'graph_coverage_gap']).optional(),
});
export const RelationshipSchema = z.strictObject({
  id, kind: RelationshipKindSchema, from: id, to: id, description: text, status,
  references: z.array(ReferenceSchema),
});
export const ModuleSchema = z.strictObject({
  id, name: text, description: text, exports: z.array(id), imports: z.array(id),
});
export const GraphSchema = z.strictObject({
  schemaVersion: z.literal('1'), id, title: text, description: text,
  nodes: z.array(NodeSchema), relationships: z.array(RelationshipSchema),
  modules: z.array(ModuleSchema).optional(),
});
export const ConfigSchema = z.strictObject({
  configVersion: z.literal('1'), graph: text, generated: text,
});
export type Graph = z.infer<typeof GraphSchema>;
export type GraphNode = z.infer<typeof NodeSchema>;
export type Relationship = z.infer<typeof RelationshipSchema>;
export type GraphModule = z.infer<typeof ModuleSchema>;
export type Reference = z.infer<typeof ReferenceSchema>;
export type Config = z.infer<typeof ConfigSchema>;
export type NodeKind = GraphNode['kind'];
export type RelationshipKind = Relationship['kind'];
export interface Diagnostic { code: string; at: string; message: string }
export function shapeErrors(value: unknown, schema: z.ZodType): Diagnostic[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map(issue => ({
    code: 'schema', at: '$.' + issue.path.map(String).join('.'), message: issue.message,
  }));
}
