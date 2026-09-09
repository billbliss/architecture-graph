# Record the decisions worth remembering

A useful graph helps answer questions that are otherwise easy to lose: who owns this responsibility, where does shared meaning come from, and what must remain true across a boundary? Keep the graph focused on those questions rather than turning it into an inventory of every source file.

## Choose the idea before its label

A **component** is where behavior lives; a **capability** is the responsibility it provides. A **contract** describes an obligation, such as a greeting format or an API response rule. An **authority** relationship records which part decides the meaning others should preserve.

Other supported kinds are `actor`, `artifact`, `transform`, `surface`, `policy`, `boundary`, and `decision`. Use a decision to keep a question, its alternatives, and eventual resolution visible. Prefer a clear description to adding more entries just because the vocabulary allows them.

## Say what is known

Every idea and relationship has a status:

- `proposed`: intended or suggested design; implementation is not being asserted.
- `implemented`: the author says it is implemented and supplies a real implementation reference.
- `unresolved`: a question or alternative remains open.

AG does not decide these statuses for you. An agreed design decision may remain proposed until implemented; explain its disposition in the description. Do not hide uncertainty by supplying a fictitious source file.

References point to existing project files, for example `{"kind":"design","path":"requirements.md"}`. Use `implementation` for actual implementation files. An optional `description` can explain what to read there. Proposed and unresolved entries can have an empty reference list; describe any inference honestly. Implemented entries need at least one implementation reference.

## Connect ideas for a reason

Every relationship needs a description explaining why the connection matters.

| Relationship | Meaning and supported direction |
| --- | --- |
| `owns` | An actor or component owns an idea; declared ownership has one owner and no cycles |
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

Each node has `id`, `kind`, `name`, `description`, `status`, and `references`. IDs use `kind:stable-slug`, such as `capability:greet`. Each relationship has `id`, `kind`, `from`, `to`, `description`, `status`, and `references`; its ID normally starts with `relationship:`. IDs must be unique across the graph. Keep them stable when source files move.

References must use local paths within the project, without symlinks, parent traversal, URLs, or wildcards. See `schema/graph.schema.json` in the installed toolkit for the full accepted shape. Unknown fields are errors.

These rules catch broken records. They cannot establish whether the graph covers everything important, whether all design statements agree in meaning, or whether the program respects its boundaries.
