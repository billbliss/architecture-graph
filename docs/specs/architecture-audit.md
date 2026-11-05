# Architecture Audit

**Status:** Proposed. Core graph and configuration format: **1** (one additive reference kind, `check`). Audit files have their own versioned formats.

## Problem

AG records what the architecture is meant to be, but it never compares that record with the code. A project can declare that its generic platform does not depend on feature code, or that one entry point reaches exactly one execution path, and keep passing `ag validate` while the code does the opposite.

[How working software drifts from its architecture](../drift-patterns.md) describes seven patterns observed in a real project that had a graph and thousands of passing tests. Most of them are structural: an import in the wrong direction, an entry point that reaches a module it must not reach, a second implementation of a role that should have one. Structural problems like these can be detected cheaply and mechanically.

This specification adds Architecture Audit, an optional package that runs structural checks against the code and reports violations as findings. Existing violations can be recorded in a baseline, so a project can adopt a check without first fixing everything it finds. New violations fail; baselined ones stay visible until they are fixed.

## Goals and non-goals

Goals:

- Catch, on every pull request, the structural drift patterns that are cheap to detect: specifics in the platform, blended result, shadow authority reached from production, and permanent bridges left reachable.
- Make the checks adoptable on a codebase that already has drift.
- Put each rule's check in front of an agent before it changes the code, not only after.
- Never report "pass" for code the audit could not analyze.
- Keep core AG's promise: core AG does not read source code. Only the optional audit package does.

Non-goals:

- Proving that the architecture is correct, or that the code behaves as the graph says. The audit checks structure: which files import which, and what an entry point can reach.
- Resisting deliberate forgery. Findings are advisory evidence for developers and agents, not certificates.
- Replacing tests or review. Behavioral bugs, design gaps and [decorative identity](../drift-patterns.md#decorative-identity) remain theirs.
- Choosing where findings are tracked. The audit writes a report; a project decides whether findings go to an issue tracker, a chat channel or nowhere.
- Analyzing every language in the first version. Version 1 supports TypeScript and JavaScript.

## Lessons carried over

An earlier, proof-based approach in the source project established three ideas worth keeping and several costs worth avoiding. This design keeps:

- **Negative space.** Checks evaluate the whole declared scope on every run, so adding a new file that violates a rule is caught even though no previously checked file changed.
- **Independent expectations.** What a check expects is declared in a check file, not derived from the code being checked. A check's scope is discovered from the file system and imports; it is never a list of the files expected to pass.
- **Fail on incomplete analysis.** An import the audit cannot resolve, or syntax it does not support, is reported as a finding. It is never silently skipped.

It deliberately avoids:

- **Zero-violation gates.** The baseline lets a check be adopted on day one.
- **Forgery resistance and self-proof.** Results are not signed, hashed into evidence chains or re-admitted.
- **Premature caching.** Version 1 checks run on the whole scope in seconds. Incremental caching is designed for later, not built first.
- **Projections that show pass status.** Generated guidance shows which rules have checks, not whether they passed, because a stored result goes stale as soon as the code changes.

## Terms

A **check** is a structural rule, declared in a check file referenced by a guardrail node. A **finding** is one violation reported by a check. A finding's **key** is a readable string that identifies it stably across runs. The **baseline** is a reviewed file in the repository listing findings that are known and accepted for now, each with a reason. A **tripwire** is a check whose new findings fail `ag audit --tripwires`, intended for every pull request. An **audited** check runs in the full audit and reports findings without blocking. The **report** is the JSON output of a run.

## Two packages

| Package | Role | Reads source code |
| --- | --- | --- |
| `@billbliss/architecture-graph` (core) | Graph format, validation, context, generation, viewer core. Knows that a guardrail has check files, not what they contain | No |
| `@billbliss/architecture-graph-audit` (optional) | Check file format, source discovery, checks, findings, baseline, report | Yes |

The audit package depends on core and uses its public library API to load the project and find check references. Core never imports the audit package. When a user runs `ag audit`, core looks for the audit package in the project. If it is installed, core hands the command to it. If not, core prints how to install it and exits with an error. Core has no other knowledge of the audit.

Both packages live in this repository and are released together, with matching versions. TypeScript is an ordinary dependency of the audit package, so projects that do not install the audit never install it.

AG's own graph enforces this split with a tripwire once the audit exists: core source must not reach the audit package or `typescript`.

## Core format change: the `check` reference kind

`references[].kind` gains `check`. A check reference names a check file. It is allowed only on guardrail nodes: `policy`, `constraint` and `boundary` nodes, and nodes classified `guardrail`. It is not allowed on relationships.

```yaml
- id: constraint:platform-is-feature-neutral
  kind: constraint
  name: The platform is feature-neutral
  description: The generic reporting platform never depends on feature code; features plug in through registered contracts.
  status: implemented
  references:
    - kind: design
      path: docs/platform.md
    - kind: check
      path: architecture/checks/platform-is-feature-neutral.yaml
```

Core checks only that the file exists, as it does for every reference, and that the reference is on a guardrail node. It does not parse the file. A check reference does not satisfy `implemented` status; only an `implementation` reference does.

Because check files are ordinary references:

- `ag context --file architecture/checks/platform-is-feature-neutral.yaml` returns the guardrail;
- `ag context --guardrail` lists the guardrail's check files, which an agent can read;
- generated `guidance.md` says how many guardrails have check files, without saying whether they pass;
- the viewer can show a guardrail's check files the way it shows a contract's schema and examples.

## Audit files

### Check files

A check file holds one or more checks for the guardrail that references it. Check IDs use the `check:` prefix and must be unique across all check files.

```yaml
checkVersion: "1"
checks:
  - id: check:platform-independent-of-features
    kind: forbidden_dependency
    mode: tripwire
    description: The generic platform must not import feature code.
    from: [module:platform]
    to: [module:features]
```

```yaml
checkVersion: "1"
checks:
  - id: check:report-route-single-path
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
| `kind` | `forbidden_dependency` or `forbidden_reachability` in version 1 |
| `mode` | `tripwire` or `audited` |
| `description` | What the check enforces, in plain language |

A **selector** names code. It is either a graph module ID, which expands to that module's paths in the audit configuration, or a repository-relative glob. Selectors never name expected results.

`forbidden_dependency` takes `from` and `to` selectors. Any runtime import from a file matched by `from` to a file matched by `to` is a finding.

`forbidden_reachability` takes `entries`, a list of repository-relative files, and `forbidden` selectors. It may also take `forbiddenPackages`, a list of package-specifier patterns such as `node:*` or `typescript`. Any forbidden file or package reachable from an entry through runtime imports is a finding.

### Audit configuration

`ag.audit.json` sits next to `ag.config.json`; `--audit-config` overrides the location.

```json
{
  "auditVersion": "1",
  "baseline": "architecture/audit-baseline.yaml",
  "typescript": [
    { "paths": ["src/**"], "tsconfig": "tsconfig.json" },
    { "paths": ["web/**"], "tsconfig": "web/tsconfig.json" }
  ],
  "modules": {
    "module:platform": ["src/platform/**"],
    "module:features": ["src/features/**"],
    "module:legacy-runners": ["src/legacy/**"]
  }
}
```

- `typescript` names the exact TypeScript configuration whose `baseUrl` and `paths` aliases apply to each part of the code. Each analyzed file must match exactly one entry. The audit never searches for a nearby configuration.
- `modules` maps graph module IDs to source globs. Every key must be a module declared in the graph, and a file may belong to at most one module.
- Mapping modules to source paths is an audit concern, so it lives here rather than in the graph.

## Validation

`ag validate` (core) checks only that check references point at existing files on guardrail nodes.

`ag audit validate` checks the audit files:

- check files match their format;
- check IDs are unique;
- module IDs in selectors and in `modules` exist in the graph;
- entry files exist;
- globs are well formed and repository-relative;
- module paths do not overlap;
- the baseline and `tsconfig` files exist.

Every `ag audit` run performs the same validation first.

## Running the audit

```text
ag audit [--tripwires] [--check ID] [--audit-config FILE] [--json] [--output FILE] [--base-baseline FILE]
ag audit validate
ag audit baseline accept --finding KEY --reason TEXT
ag audit baseline prune
```

`ag audit` runs every check. `--tripwires` runs only checks in `tripwire` mode. `--check` runs one check. `--output` writes the full report to a file, for use as a CI artifact or by other tools.

Each finding is classified against the baseline:

- **new**: not in the baseline;
- **baselined**: in the baseline;
- **resolved**: a baseline entry whose finding no longer occurs.

Exit codes:

| Code | Meaning |
| --- | --- |
| 0 | No new findings and no resolved baseline entries |
| 1 | Invalid input, configuration or audit files, or the audit package is not installed |
| 3 | New findings, resolved baseline entries that must be pruned, or baseline growth rejected by `--base-baseline` |

Failing on resolved entries is what makes the baseline shrink: when a change fixes a violation, the same change must remove its baseline entry. Otherwise the violation could return later and pass as baselined.

## Discovery: TypeScript and JavaScript

Version 1 analyzes `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs` and `.cjs` files using the TypeScript compiler API.

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

## Findings and the report

Every finding has a kind, a key, the check that produced it, a message, and evidence.

| Kind | Key | Evidence |
| --- | --- | --- |
| `forbidden_dependency` | `<check>|dep|<from file>-><to file>` | The import line and specifier |
| `forbidden_reachability` | `<check>|reach|<entry>-><target>` | The shortest import path from entry to target |
| `unresolved_import` | `<check>|unresolved|<file>|<specifier>` | The line, specifier and reason |

A reachability key deliberately omits the intermediate path, so refactoring the modules in between does not change the finding's identity. Renaming or moving the entry or target file does change it; the old entry resolves and a new finding appears, which is the correct prompt to re-review it.

The report contains every finding with its classification, plus what the run covered: checks run, files parsed, external terminals and unresolved imports. Its format is published as a JSON Schema in the audit package, so any tool can consume it. Reports are not committed and are not used as input to later runs.

## The baseline

The baseline is a YAML file in the repository, written by `ag audit baseline` and reviewed like code. It is versioned with the code it describes because it decides whether a pull request passes. No issue tracker or external service is involved.

```yaml
baselineVersion: "1"
findings:
  - key: check:report-route-single-path|reach|src/routes/create-report.ts->src/experiments/runner.ts
    reason: The fine-grained variant still runs through the experiment runner. Removed when the shared execution path lands.
    added: 2026-11-05
```

`baseline accept` adds one current finding and requires a reason. `baseline prune` removes resolved entries. There is no command that accepts every current finding at once: adopting a check on an existing codebase means reviewing what it found.

### Controlling baseline growth

Accepting a finding is the easiest way to make a failing tripwire pass. An agent that hits a tripwire can accept the finding in the same pull request, and the only trace is a few added lines in the baseline file. That is exactly the "route around the obstacle" behavior the audit exists to catch. Three layers, from lightest to strictest:

1. **Agent instructions.** The bundled skill tells agents never to accept findings themselves: a new finding is a design question for the user. This guides behavior but enforces nothing.
2. **Required review.** A project can require a specific reviewer for changes to the baseline file, for example with a CODEOWNERS entry on GitHub. AG documents this; it does not configure any hosting provider.
3. **CI comparison.** `--base-baseline FILE` compares the current baseline with another copy, typically the base branch's, which CI can obtain with `git show`. Added entries fail the run. A project that uses this decides how deliberate additions are approved, for example in a separate pull request that changes only the baseline.

## Agent workflow and context

- An agent planning a change sees a guardrail's check files through `ag context`, so it learns both the rule and how the rule is enforced.
- In projects with the audit installed, the bundled skill adds `ag audit --tripwires` to the agent's definition of done for any change touching a checked module. It tells the agent to treat a new finding as a design question, not an obstacle to route around.
- When an agent adds a module boundary, or a guardrail whose wording is universal ("only", "exactly one", "never", "no fallback"), the skill suggests a check file, or an explicit note in the guardrail's description that the rule is unchecked.

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

AG's own graph will use the audit on itself: one tripwire checks that the browser-safe core (`src/core.ts`) cannot reach `src/node.ts` or any `node:*` package, a property tested today only by bundling, and another checks that core source cannot reach the audit package or `typescript`.

## Later versions

These are directions, not commitments. Each needs its own specification update before it is built.

- **Version 2: declarations and duplication.**
  - Export inventory checks: exactly N exported declarations in a scope match a selector, or none may (for example, a function whose name matches `register*` in a registry module).
  - Clone detection within declared scopes.
  - An advisory listing guardrails whose wording is universal but that have no check.
- **Version 3: the asynchronous audit.**
  - A merge-triggered or scheduled job runs every check plus a semantic duplication sweep, in which an agent compares a module's responsibilities against the graph and reports suspected duplication as advisory findings in the same report format.
  - Findings reach a tracker only through the project's choice: a CI step that consumes the report, or a command hook (for example `--on-new-finding CMD`) that receives each new finding as JSON. AG provides stable keys for deduplication and no built-in destination.
  - Incremental runs, if full runs become slow, re-check only the checks whose scope changed. The cache key must cover the whole scope's file listing (negative space), not only the files previously reached.
- **Later: callable flow.** Following which implementation a call can actually select, through aliases, parameters and registries, was explored in the source project and is substantially harder. It is deferred until module-level checks have proven useful.
- **Other languages** through a discovery-adapter interface. Version 1 keeps that interface internal.

## What this does not establish

A clean audit means that, within the declared scopes and the supported import grammar, no forbidden import or reachable forbidden module was found, apart from baselined ones. It does not mean that:

- the code behaves as the graph says;
- an allowed path is correct;
- no duplicate logic exists under different names;
- code reached only through constructs reported as unresolved is analyzed;
- the checks cover everything important.

Module reachability is not call reachability: an imported module may be reachable even if the forbidden function in it is never called. The audit reports reachability anyway, because that is the dependency that makes a future call possible.

Core AG's statement about itself is unchanged: core validation checks declarations and file existence, not code.

## Changes to make

Core:

1. `src/schema.ts`: add the `check` reference kind. Regenerate the published JSON schema.
2. `src/validation.ts`: check references only on guardrail nodes, never on relationships.
3. `src/cli.ts`: `ag audit` hands off to the audit package if it is installed, and otherwise explains how to install it.
4. Generated guidance: count guardrails with check files.
5. Viewer: show check files on guardrail panels, as file contents.

Audit package:

6. A new package in this repository, released with core, depending on core and `typescript`.
7. The check file, audit configuration, baseline and report formats, with published JSON Schemas.
8. TypeScript discovery, selector expansion, the two check kinds, finding keys, baseline classification, `--base-baseline`, and the commands above.
9. Tests. Each drift pattern in the version 1 table gets a fixture that passes `ag validate` and fails `ag audit` for the right reason. Each discovery rule gets a negative control: type-only imports ignored, aliases resolved, an unresolved dynamic import reported, and unreachable unsupported syntax ignored.

Both:

10. Skill: the workflow rules above, conditioned on the audit being installed.
11. AG's own graph: this specification as `decision:architecture-audit` (proposed), and the two self-checks once implemented.
12. Documentation: reference, compatibility, packaging, and the CI guide (run `ag audit --tripwires` in pull requests).

## Open questions

- **Package name and command.** The proposal uses `@billbliss/architecture-graph-audit`, run as `ag audit`. A separate `ag-audit` command would avoid core's hand-off, at the cost of a second command for users to learn.
- **Release coupling.** The proposal releases both packages together with matching versions. Independent versions would let the audit change faster, at the cost of a compatibility range between them.
- **Report hook.** Version 3's `--on-new-finding` hook runs a project-chosen command. Decide whether a hook belongs in the audit at all, or whether consuming the report in CI is enough.
