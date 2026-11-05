# Record the decisions worth remembering

A useful graph helps answer questions that are otherwise easy to lose: who owns this responsibility, where does shared meaning come from, and what must remain true across a boundary? Keep the graph focused on those questions rather than turning it into an inventory of every source file.

## Choose the idea before its label

A **component** is where behavior lives; a **capability** is the responsibility it provides. A **contract** describes an obligation, such as a greeting format or an API response rule. An **authority** relationship records which part decides the meaning others should preserve.

Original AG vocabulary also includes `data_object`, `evidence_surface`, `adapter`, `workflow`, and `constraint`. An evidence surface records a design concept; it does not execute or certify evidence. Other supported kinds are `actor`, `artifact`, `transform`, `surface`, `policy`, `boundary`, and `decision`. Use a decision to keep a question, its alternatives, and eventual resolution visible. Prefer a clear description to adding more entries just because the vocabulary allows them.

## Say what is known

Every idea and relationship has a status:

- `proposed`: intended or suggested design; implementation is not being asserted.
- `implemented`: the author says it is implemented and supplies a real implementation reference.
- `unresolved`: a question or alternative remains open.

AG does not decide these statuses for you. An agreed design decision may remain proposed until implemented; explain its disposition in the description. Do not hide uncertainty by supplying a fictitious source file.

References point to existing project files, for example `{"kind":"design","path":"requirements.md"}`. Use `implementation` for actual implementation files and `test` for tests that exercise the record; a test or check reference alone does not satisfy `implemented`. An optional `description` can explain what to read there. Proposed and unresolved entries can have an empty reference list; describe any inference honestly. Implemented entries need at least one implementation reference.

## Connect ideas for a reason

Every relationship needs a description explaining why the connection matters.

| Relationship | Meaning and supported direction |
| --- | --- |
| `owns` | An actor, component, or capability owns an idea; declared ownership has one owner and no cycles |
| `provides` | A component, surface, or transform supplies a capability |
| `authority_for` | An actor, component, or contract decides the meaning of a capability, contract, or artifact |
| `governed_by` | An idea follows a policy |
| `constrained_by` | An idea must respect a boundary, contract, or policy |
| `preserves` | An idea preserves a contract or artifact |
| `affects` | A decision affects another idea |
| `depends_on`, `consumes`, `produces` | Connect any two ideas; explain the specific meaning in the description |

An entry cannot connect to itself. Competing owners or authorities can be recorded as unresolved alternatives until chosen; unresolved relationships are excluded from the single-owner/authority check. Missing ownership is allowed, but review whether it reflects intentional scope or an unanswered question.

## File shape when you need it

The graph has `schemaVersion: "1"`, `id`, `title`, `description`, `nodes`, and `relationships`. Use its description to say what it covers and excludes.

Each node has `id`, `kind`, `name`, `description`, `status`, and `references`. IDs use `kind:stable-slug`, such as `capability:greet`. For compatibility with original AG graphs, `policy`, `constraint` and `boundary` nodes may instead use `guardrail:stable-slug`. Each relationship has `id`, `kind`, `from`, `to`, `description`, `status`, and `references`; its ID normally starts with `relationship:`. IDs must be unique across the graph. Keep them stable when source files move.

References must use local paths within the project, without symlinks, parent traversal, URLs, or wildcards. See `schema/graph.schema.json` in the installed toolkit for the full accepted shape. Unknown fields are errors.

These rules catch broken records. They cannot establish whether the graph covers everything important, whether all design statements agree in meaning, or whether the program respects its boundaries.

## Show the shape of shared data

When a `contract`, `data_object` or `artifact` has a concrete data shape that crosses a boundary (an API payload, an event, a stored record, a file format, structured command output), give it sidecars: one `schema` reference to a JSON Schema and one or more `example` references. Do not invent a schema for a contract that is a rule rather than data, such as exit codes, ordering, idempotency or limits; describe it in prose and with `preserves` and `constrained_by` relationships instead.

Take the schema from the best available source, in this order:

1. A schema the project's build already produces (OpenAPI, protobuf converted to JSON Schema, Zod's `z.toJSONSchema`, Pydantic's `model_json_schema`, `ts-json-schema-generator`). Reference that file; do not copy it.
2. A schema written from the implementation's types. Say which type it mirrors in the node's description.
3. For proposed work, a schema written from the requirements.

Prefer examples captured from real output or tests, then fixtures, then hand-written ones. Keep them small, and never include secrets or personal data.

New sidecars conventionally go in `contracts/<name>.schema.json` and `contracts/examples/<name>.json`, where `<name>` is the node ID without its prefix. `ag validate` checks that the schema is valid JSON Schema and that every example matches it; relative `$ref` between project files work. Passing shows only that the files agree with each other, not that the code produces that data. For an important contract, suggest a project test that validates real output with `sidecarValidator`.

## Say how a rule is checked

A guardrail is a `policy`, `constraint` or `boundary` node, or any node classified `guardrail`. A guardrail can name the check files that enforce it with `check` references, for example `{"kind":"check","path":"architecture/checks/platform-is-feature-neutral.yaml"}`. Check files are read by the optional Architecture Audit package (`ag audit`); AG itself only confirms that the file exists and that the reference is on a guardrail node. Check references are not allowed on other nodes or on relationships.

`ag context --guardrail <id>` and `ag context --file <check file>` show the check files with their guardrail, so read them before changing code the rule covers. A check file records how a rule is checked, not that the code passes it; only running the audit says that, and only for the structure it can see.

## Make shared boundaries visible

Optional `modules` group related responsibilities inside the same canonical graph. Each module has an ID, name, description, and lists of imported and exported node IDs. A node can name its `module`. A relationship crossing modules requires the source module to import its target and the target module to export that node. This makes shared boundaries reviewable. For the complete shape and additional relationship kinds, read `node_modules/@billbliss/architecture-graph/docs/reference.md` from the consuming project root.
