# What AG can tell you—and how to upgrade

AG helps you keep a design record understandable and internally consistent. It can show the rules connected to a part of your software and catch broken references. It does not establish that the program follows those rules.

For example, a formatter can be recorded as the authority for greeting text while another component secretly builds its own greeting. AG checks the declaration, not the runtime behavior. Application tests and review still matter. The hello-world tests deliberately demonstrate that difference.

## The 0.2.0 foundation

The toolkit and skill are **0.2.0**. Graph and configuration format **1** remain readable; generated artifacts use format **2**. New projects start with one YAML file. The toolkit also reads existing standalone JSON graphs, so changing formats is optional. Older toolkit versions may reject the added fields and vocabulary; compatibility is from 0.1 data to the 0.2 reader.

TypeScript is now the editable implementation source. npm consumers run the compiled JavaScript without installing a compiler. The package includes declarations and source maps, so developers can navigate back to the source and use the library with type checking. See [developing the toolkit](development.md).

There is one authored graph per configuration. Logical modules, when useful, are groups inside that file. The graph can grow while node, relationship, file, guardrail and module indexes provide focused access. Context output has explicit limits and reports truncation. Loading still parses and validates the entire authored file; free-text queries scan records. These are local file tools, not an incremental graph database.

## Upgrade an existing standalone project

1. Install the 0.2.0 package and refresh the copied skill after reviewing local changes.
2. Keep the existing JSON graph and configuration if desired; they remain supported. `ag init` is for new projects and will not overwrite your files.
3. Run `ag validate`, then `ag generate` to rebuild the new indexes and briefing. Review the changes and run `ag check`.
4. If you prefer YAML, convert the same graph data to one `.yaml` file and update `config.graph`. Compare the loaded data before removing the JSON file. Do not maintain two independent authored copies.

The public library adds typed project/index data and bounded context options. Context now reports cache origin, truncation and traversal statistics. Queries that formerly returned the whole matching graph may return a bounded result; callers must inspect `truncated`. The generated briefing is an overview rather than a full graph dump.

Zod supplies runtime validation and TypeScript types from the same schemas. Exported JSON schemas are generated from those definitions. Unknown fields and versions are rejected. Duplicate mapping keys are rejected in both YAML and JSON. YAML input must be one document without aliases or custom tags; comments remain untouched because normal maintenance only reads the authored file.

## Compatibility with the original AG

The original AG kinds (`workflow`, `adapter`, `data_object`, `constraint`, `evidence_surface`) and relationships (`adapts`, `validates`, `supersedes`, `emits_evidence`, `guarded_by`) are accepted alongside the standalone vocabulary. The original classification labels can be recorded, but do not certify behavior. Both underscore and hyphen ID prefixes for original underscore kinds are accepted without renaming IDs.

This is vocabulary continuity, not a promise to load the predecessor application’s YAML unchanged. The standalone graph still uses its own lifecycle, reference and top-level fields. There is no automatic migration from that private application. The exact preservation/exclusion decisions are in [the foundation inventory](foundation.md).

## What the checks do not establish

An `implemented` status is a claim by its author, with a reference to a real file. AG cannot recognize a document falsely labeled as implementation, discover every missing architectural concept, or prove a runtime boundary.

Compiled indexes are disposable. Their metadata checks graph identity, declaration fingerprint, toolkit version, and file checksums. Missing, stale or damaged indexes cause a canonical fallback. Checksums detect stale or damaged files; they are not signed assurance evidence or protection against a deliberately forged cache and metadata. `generate` always rebuilds from authored declarations.

`check` covers the ten owned generated files. It does not fingerprint implementation contents or remove unrelated files. A code-only behavioral change can leave graph checks green. Stable locators identify a graph record by file, section and ID, not by source-code symbol or line number.

## Future versions

Incompatible authored formats require a new format version and migration instructions. During 0.x, incompatible CLI/library changes require a minor release; compatible fixes use a patch release. Keep the toolkit, copied skill and project lockfile aligned. The Actions matrix covers Linux Node 22/24 and macOS Node 22; consult actual run results. Windows has not been tested.
