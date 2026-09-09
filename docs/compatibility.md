# Compatibility and limits

Tooling and bundled skill are released together at **0.1.0**. Configuration, graph and artifact formats each have version **1**. The graph/config validators reject unknown versions and unknown fields. Pin the toolkit tarball and commit the consumer's package lock. A copied skill should match the installed toolkit version; check with `ag --version` and the skill's metadata before use. Version changes must update package metadata, exported VERSION, skill metadata, documentation, and the package compatibility test.

Future incompatible schema changes require an explicit format-version bump and a documented migration. During 0.x, incompatible CLI/library changes require a minor release bump; compatible fixes use patch releases. Do not assume Alpha Engine YAML, graph IDs, classifiers or AAG proof descriptors are accepted. Compatibility verified here is the bundled 0.1.0 interface on Node 22.17.0/macOS, using the private tarball from a separate consumer. Windows behavior has not been tested.

The public `validateGraph` operates on in-memory objects and checks file existence relative to the supplied root. `loadProject` additionally enforces project configuration and canonical/generated separation. Consumers should use `loadProject` as their entry point. The small schema walker supports only keywords used by the bundled schemas; it is not a general JSON Schema validator. JSON parsing follows Node's JSON semantics, including last-value handling for duplicate object keys; duplicate graph identifiers are rejected separately. Prefer editor validation and review for authoring mistakes.

There is one graph per configuration. Context is deterministic neighborhood retrieval and text matching; it is not semantic search. Guidance includes the whole modeled scope, so keep the graph proportionate and use context for focused work. No automatic document extraction, code analysis, source symbol/line checking, URL fetching, coverage inference, schema migration, graph UI, or AAG execution is included. Unreferenced implemented code and semantic contradictions can remain invisible.

An implemented status is a declaration by its author. A real implementation reference is necessary but not sufficient. The toolkit cannot distinguish an incorrectly labeled document from code by meaning. Decision disposition belongs in the description; unresolved decisions stay visible until actually resolved. Review remains essential.

Generated drift covers the two owned files and declaration/configuration changes. It does not fingerprint source contents or establish evidence freshness. Extra files in the generated directory are not checked or deleted. Changing only implementation behavior can leave `validate` and `check` green; the hello-world test deliberately demonstrates this.

## Future AAG attachment

Keep graph and element IDs stable through code moves. A future separate AAG system could identify a declaration by graph ID, element ID, schema version, and a canonical-declaration digest, then associate independently obtained evidence with that target and an implementation revision. The current generated digest is a projection input fingerprint, not an assurance protocol or an evidence identity guarantee.

Evidence must remain distinct from declarations and generated guidance. Future evidence producers would own their source binding, validity scope, invalidation and admission rules. No evidence field, plugin framework, proof runner or extension registry is reserved or implemented in this release.
