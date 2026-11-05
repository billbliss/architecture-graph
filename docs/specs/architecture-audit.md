# Architecture Audit

**Status:** Proposed. Graph and configuration format: **1** (additive: optional `checks`, module `paths`, and an optional `audit` configuration section).

## Problem

AG records what the architecture is meant to be, but it never compares that record with the code. A project can declare that its generic platform does not depend on feature code, or that one entry point reaches exactly one execution path, and keep passing `ag validate` while the code does the opposite.

[How working software drifts from its architecture](../drift-patterns.md) describes seven patterns observed in a real project that had a graph and thousands of passing tests. Most of them are structural: an import in the wrong direction, an entry point that reaches a module it must not reach, a second implementation of a role that should have one. Structural problems like these can be detected cheaply and mechanically.

This specification adds `ag audit`, which runs declared structural checks against the code and reports violations as findings. Existing violations can be recorded in a baseline, so a project can adopt a check without first fixing everything it finds. New violations fail; baselined ones stay visible until they are fixed.

## Goals and non-goals

Goals:

- Catch, on every pull request, the structural drift patterns that are cheap to detect: specifics in the platform, blended result, shadow authority reached from production, and permanent bridges left reachable.
- Make the checks adoptable on a codebase that already has drift.
- Put each rule's check in front of an agent before it changes the code, not only after.
- Never report "pass" for code the audit could not analyze.

Non-goals:

- Proving that the architecture is correct, or that the code behaves as the graph says. The audit checks structure: which files import which, and what an entry point can reach.
- Resisting deliberate forgery. Findings are advisory evidence for developers and agents, not certificates.
- Replacing tests or review. Behavioral bugs, design gaps and [decorative identity](../drift-patterns.md#decorative-identity) remain theirs.
- Analyzing every language in the first version. Version 1 supports TypeScript and JavaScript.

## Lessons carried over

An earlier, proof-based approach in the source project established three ideas worth keeping and several costs worth avoiding. This design keeps:

- **Negative space.** Checks evaluate the whole declared scope on every run, so adding a new file that violates a rule is caught even though no previously checked file changed.
- **Independent expectations.** What a check expects is declared in the graph, not derived from the code being checked. A check's scope is discovered from the file system and imports; it is never a list of the files expected to pass.
- **Fail on incomplete analysis.** An import the audit cannot resolve, or syntax it does not support, is reported as a finding. It is never silently skipped.

It deliberately avoids:

- **Zero-violation gates.** The baseline lets a check be adopted on day one.
- **Forgery resistance and self-proof.** Results are not signed, hashed into evidence chains or re-admitted.
- **Premature caching.** Version 1 checks run on the whole scope in seconds. Incremental caching is designed for later, not built first.
- **Projections that show pass status.** Generated guidance shows which rules are checked, not whether they passed, because a stored result goes stale as soon as the code changes.

## Terms

A **check** is a structural rule declared in the graph and attached to a guardrail node. A **finding** is one violation reported by a check. A finding's **key** is a readable string that identifies it stably across runs. The **baseline** is a reviewed file listing findings that are known and accepted for now, each with a reason. A **tripwire** is a check whose new findings fail `ag audit --tripwires`, intended for every pull request. An **audited** check runs in the full audit and reports findings without blocking.

## Format change

### Checks

The graph gains an optional top-level `checks` list. Each check is attached to exactly one guardrail: a `policy`, `constraint` or `boundary` node, or a node classified `guardrail`. Check IDs use the `check:` prefix and share the graph's unique ID space.

```yaml
checks:
  - id: check:platform-independent-of-features
    guardrail: constraint:platform-is-feature-neutral
    kind: forbidden_dependency
    mode: tripwire
    description: The generic platform must not import feature code.
    from: [module:platform]
    to: [module:features]
  - id: check:report-route-single-path
    guardrail: constraint:single-evaluation-path
    kind: forbidden_reachability
    mode: tripwire
    description: Creating a report must not reach the experimentation harness or the legacy runners.
    entries: [src/routes/create-report.ts]
    forbidden: [src/experiments/**, module:legacy-runners]
```

Common fields:

| Field | Meaning |
| --- | --- |
| `id` | Stable `check:` ID |
| `guardrail` | The node this check enforces. One guardrail may have several checks |
| `kind` | `forbidden_dependency` or `forbidden_reachability` in version 1 |
| `mode` | `tripwire` or `audited` |
| `description` | What the check enforces, in plain language |

A **selector** names code: either a module ID, which expands to that module's `paths`, or a repository-relative glob. Selectors never name expected results.

`forbidden_dependency` takes `from` and `to` selectors. Any runtime import from a file matched by `from` to a file matched by `to` is a finding.

`forbidden_reachability` takes `entries`, a list of repository-relative files, and `forbidden` selectors. It may also take `forbiddenPackages`, a list of package-specifier patterns such as `node:*`. Any forbidden file or package reachable from an entry through runtime imports is a finding.

### Module paths

Modules gain an optional `paths` list of repository-relative globs that say which source files belong to the module. A file may belong to at most one module; `ag validate` reports overlaps. Module `paths` are independent of the module's node `imports` and `exports`: those describe relationships between ideas, while `paths` describe where the code lives.

```yaml
modules:
  - id: module:platform
    name: Reporting platform
    description: Generic report generation, independent of any feature.
    exports: [contract:report-plan]
    imports: []
    paths: [src/platform/**]
```

### Configuration

`ag.config.json` gains an optional `audit` section:

```json
{
  "configVersion": "1",
  "graph": "architecture/graph.yaml",
  "generated": "architecture/generated",
  "audit": {
    "baseline": "architecture/audit-baseline.yaml",
    "tsconfig": "tsconfig.json"
  }
}
```

`tsconfig` names the exact TypeScript configuration whose `baseUrl` and `paths` aliases apply. The audit never searches for a nearby configuration. A project with several source domains, such as an app and a server with different aliases, may give a list of `{ "paths": [...], "tsconfig": "..." }` entries. Each analyzed file must match exactly one of them.

## What `ag validate` checks

Validation checks declarations, without reading source code:

- A check's `guardrail` exists and is a guardrail node.
- Module IDs in selectors exist and have `paths`.
- Entry files exist.
- Globs are well formed and repository-relative.
- Module `paths` do not overlap.
- The configured baseline and `tsconfig` files exist.

`ag validate` never runs a check.

## Running the audit

```text
ag audit [--tripwires] [--check ID] [--config FILE] [--json] [--output FILE]
ag audit baseline accept --finding KEY --reason TEXT
ag audit baseline prune
```

`ag audit` runs every check. `--tripwires` runs only checks in `tripwire` mode. `--check` runs one check. `--output` writes the full JSON report to a file, for use as a CI artifact.

Each finding is classified against the baseline:

- **new**: not in the baseline;
- **baselined**: in the baseline;
- **resolved**: a baseline entry whose finding no longer occurs.

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | No new findings and no resolved baseline entries |
| 1 | Invalid input, configuration or declarations |
| 3 | New findings, or resolved baseline entries that must be pruned |

Failing on resolved entries is what makes the baseline shrink: when a change fixes a violation, the same change must remove its baseline entry. Otherwise the violation could return later and pass as baselined.

## Discovery: TypeScript and JavaScript

Version 1 analyzes `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs` and `.cjs` files using the TypeScript compiler API. TypeScript is an optional peer dependency: projects that declare checks must have it installed, and `ag audit` explains how to install it if it is missing. AG's other commands do not need it.

Analysis is entry-first for reachability and file-first for dependencies:

- `forbidden_reachability` parses only files reached from its entries.
- `forbidden_dependency` parses every file matched by `from`.

Unreachable files are never parsed, so unrelated unsupported syntax elsewhere cannot block a check.

Edges:

- Static imports, side-effect imports, `export ... from`, `export * from`, `import x = require("...")`, `require("...")` with a string literal and `import("...")` with a string literal are runtime edges.
- `import type` and `export type` are not runtime edges and are ignored. Inline `type` modifiers on every imported name also make the import type-only.
- Relative specifiers resolve to source files by the usual rules: exact file, emitted-extension counterpart (a `.js` specifier to `.ts` source), then directory index. More than one candidate is an ambiguity finding.
- Non-relative specifiers are first matched against the configured aliases. An alias match must resolve inside the repository. A specifier that matches no alias is an external package terminal; it is recorded but not followed.
- A dynamic `import()` or `require()` with a non-literal argument, a resolution that escapes the repository, and an unresolvable relative import are findings of kind `unresolved_import`.
- Cycles are followed once and do not cause errors.

Unresolved imports can be baselined like any other finding. This keeps the rule that the audit never passes code it could not analyze, without making dynamic code a blocker for adoption.

## Findings

Every finding has a kind, a key, the check that produced it, a message, and evidence.

| Kind | Key | Evidence |
| --- | --- | --- |
| `forbidden_dependency` | `<check>|dep|<from file>-><to file>` | The import line and specifier |
| `forbidden_reachability` | `<check>|reach|<entry>-><target>` | The shortest import path from entry to target |
| `unresolved_import` | `<check>|unresolved|<file>|<specifier>` | The line, specifier and reason |

A reachability key deliberately omits the intermediate path, so refactoring the modules in between does not change the finding's identity. Renaming or moving the entry or target file does change it; the old entry resolves and a new finding appears, which is the correct prompt to re-review it.

## The baseline

The baseline is a YAML file written by `ag audit baseline` and reviewed like code.

```yaml
baselineVersion: "1"
findings:
  - key: check:report-route-single-path|reach|src/routes/create-report.ts->src/experiments/runner.ts
    reason: The fine-grained variant still runs through the experiment runner. Removed when the shared execution path lands.
    added: 2026-11-05
```

`baseline accept` adds one current finding and requires a reason. `baseline prune` removes resolved entries. There is no command that accepts every current finding at once: adopting a check on an existing codebase means reviewing what it found. Growth is visible in the pull request diff.

## Agent workflow and context

- `ag context` shows each guardrail's checks with their kind, mode and selectors. This means an agent planning a change sees both the rule and how it is enforced.
- The generated `guidance.md` lists which guardrails have tripwires. It does not show results, which depend on the code.
- The bundled skill adds `ag audit --tripwires` to the agent's definition of done for any change touching a checked module, and tells the agent to treat a new finding as a design question, not an obstacle to route around. Accepting a finding into the baseline is a decision for the user, not the agent.
- When an agent adds a module boundary or a guardrail whose wording is universal ("only", "exactly one", "never", "no fallback"), the skill suggests a check, or an explicit statement that the rule is unchecked.

## How the drift patterns map

| Pattern | Version 1 response |
| --- | --- |
| Specifics in the platform | `forbidden_dependency` from the platform's module to feature modules |
| Blended result | `forbidden_reachability` from the report entry point to the alternate computations |
| Shadow authority | `forbidden_reachability` from production entry points to the harness. The duplicated rules themselves need the later semantic sweep |
| Permanent bridge | `forbidden_reachability` to the old route, baselined until the cutover removes it |
| Open registry | Version 2: no exported registration function in the registry's module |
| Copy-forward | Version 2: clone detection within declared scopes |
| Decorative identity | Not structural; tests and review |

AG's own graph will use the audit on itself. For example, a tripwire checks that the browser-safe core (`src/core.ts`) cannot reach `src/node.ts` or any `node:*` package. Today that property is tested by bundling.

## Later versions

These are directions, not commitments. Each needs its own specification update before it is built.

- **Version 2: declarations and duplication.**
  - Export inventory checks: exactly N exported declarations in a scope match a selector, or none may (for example, a function whose name matches `register*` in a registry module).
  - Clone detection within declared scopes.
  - An advisory listing guardrails whose wording is universal but that have no check.
- **Version 3: the asynchronous audit.**
  - A merge-triggered or scheduled job runs every check plus a semantic duplication sweep, in which an agent compares a module's responsibilities against the graph and reports suspected duplication as advisory findings in the same format.
  - Findings are deduplicated by key, so any issue tracker can consume the JSON report. Integrating with a specific tracker is out of scope.
  - Incremental runs, if full runs become slow, re-check only the checks whose scope changed. The cache key must cover the whole scope's file listing (negative space), not only the files previously reached.
- **Later: callable flow.** Following which implementation a call can actually select, through aliases, parameters and registries, was explored in the source project and is substantially harder. It is deferred until module-level checks have proven useful.
- **Other languages** through a discovery-adapter interface. Version 1 keeps that interface internal.

## What this does not establish

A clean audit means that, within the declared scopes and the supported import grammar, no forbidden import or reachable forbidden module was found, apart from baselined ones. It does not mean that:

- the code behaves as the graph says;
- an allowed path is correct;
- no duplicate logic exists under different names;
- code reached only through constructs reported as unresolved is analyzed;
- the graph's checks cover everything important.

Module reachability is not call reachability: an imported module may be reachable even if the forbidden function in it is never called. The audit reports reachability anyway, because that is the dependency that makes a future call possible.

## Changes to make

1. `src/schema.ts`: `CheckSchema`, optional `checks` on the graph, optional `paths` on modules, and the optional `audit` configuration. Regenerate the published JSON schemas.
2. `src/validation.ts`: the declaration rules above.
3. New `src/audit/`:
   - TypeScript discovery, loading the project's `typescript` package as an optional peer;
   - selector expansion;
   - the two check kinds;
   - finding keys;
   - baseline read, classify and write.

   Keep it out of the browser-safe core.
4. `src/cli.ts`: `ag audit` and `ag audit baseline`, with the exit codes above.
5. `src/context.ts` and generated guidance: show checks attached to guardrails.
6. Skill: the workflow rules above, and how to propose a check and review findings with the user.
7. Tests. Each drift pattern in the version 1 table gets a fixture that passes `ag validate` and fails `ag audit` for the right reason. Each discovery rule gets a negative control: type-only imports ignored, aliases resolved, an unresolved dynamic import reported, and unreachable unsupported syntax ignored.
8. AG's own graph: this specification as `decision:architecture-audit` (proposed), and the core/Node tripwire once implemented.
9. Documentation: reference, compatibility, and the CI guide (run `ag audit --tripwires` in pull requests).

## Open questions

- **Where checks live.** The proposal keeps them in the graph so that agents see a rule and its check together, and the graph stays one authored file. A separate checks file would keep file globs, which change with refactoring, out of the design record. Revisit if checks make graphs noisy.
- **TypeScript as an optional peer.** This keeps AG light for projects that do not audit, at the cost of depending on the project's TypeScript version. Bundling a parser would remove that dependency and add several megabytes.
- **Blocking baseline growth.** Version 1 makes growth visible in diffs. A CI option could reject growth against the base branch's baseline. Decide after real use.
- **Should `ag check` run tripwires?** The proposal keeps `check` about generated files and makes the audit a separate command and CI step. One command would be simpler for users. Two keep each failure's meaning clear.
