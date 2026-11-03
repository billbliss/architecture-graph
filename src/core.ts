// Browser-safe entry point, published as @billbliss/architecture-graph/core. Nothing reachable from
// here may import a Node built-in; test/core.test.js bundles it for the browser platform to check.
export { VERSION, LIMIT } from './model.js';
export type { Graph, GraphNode, Relationship, Reference, Config, GraphModule, Diagnostic, NodeKind, RelationshipKind } from './schema.js';
export { GraphSchema, ConfigSchema, NodeSchema, RelationshipSchema, ModuleSchema } from './schema.js';
export { validateGraphAsync as validateGraph, validateGraphSync } from './validation.js';
export { sidecarValidatorAsync as sidecarValidator, sidecarValidatorSync, SIDECAR_KINDS } from './sidecars.js';
export type { SidecarCheck } from './sidecars.js';
export { assertProjectPath, memoryFileSource } from './files.js';
export type { FileSource, AsyncFileSource, FileKind } from './files.js';
export { parseDeclarations, serializeGraph } from './serialization.js';
