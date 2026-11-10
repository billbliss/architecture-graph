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

The audit package depends on core and uses only core's public library API to load the project and find check references. It never imports core's internal files. Core never imports the audit package statically. TypeScript is an ordinary dependency of the audit package, so projects that do not install the audit never install it.

### The `ag audit` hand-off

Users run the audit as `ag audit`; there is no second command. The hand-off contract is deliberately narrow:

1. Core lists `audit` in `ag --help` whether or not the audit is installed.
2. Core resolves the project as for every other command, honoring `--config`. `--config` may come before `audit` (`ag --config FILE audit ...`) or after it (`ag audit --config FILE ...`). When it comes after, core reads it and leaves it in `args`; the audit treats `configPath` as authoritative and accepts and ignores `--config` in its own arguments. No other global option before `audit` is recognized.
3. Core looks for `@billbliss/architecture-graph-audit` from the project's root, not from wherever `ag` itself is installed. A globally installed `ag` therefore uses the project's audit package, and `npx` runs behave the same way.
4. If the package is missing, core prints how to install it and exits with code 1.
5. Core calls the package's one exported entry point, `runAudit(args, { configPath, protocol })`. `args` are everything after `audit`, passed through unparsed. Core's own argument checks do not apply to them. Besides `--config`, core reads only whether `--json` is present, to format its own hand-off errors as JSON; it removes nothing from `args`. `runAudit` returns, or resolves to, the process exit code, an integer from 0 to 255. Any other result is treated as a failed run: core reports that the audit returned no exit code and exits 1, so an audit never passes by accident.
6. `protocol` is the hand-off protocol number, starting at 1 and independent of either package's version. The audit declares which protocol numbers it supports. On a mismatch, it fails with a message naming the versions needed, such as "this audit needs AG 0.6 or later," and exits with code 1.

Core has no other knowledge of the audit: about thirty lines of hand-off code, the package name and the protocol number. It never loads TypeScript or reads source.

### Releases

Both packages live in this repository and are, at first, released together with matching versions. That is a working practice, not a requirement. Compatibility is explicit, so independent releases need no redesign later:

- The audit declares the core versions it supports as a peer dependency range, for example `^0.5.0`, and npm warns when the installed core is outside it.
- The hand-off protocol number, not matching versions, decides whether core and the audit can work together.
- The audit uses only core's public library API, so core's internals can change without breaking it.

AG's own graph enforces this split with tripwires once the audit exists:

- core source must not reach the audit package or `typescript`;
- audit source may import core only through its public entry points.

### Packaging and development

The repository uses npm workspaces (npm 7 or later). Developers never use `npm link`.

- The root `package.json` remains the core package and adds `"workspaces": ["packages/audit"]`. Core does not move into a subfolder.
- The audit package lives in `packages/audit/` with its own `package.json`, source, tests and build.
- One `npm install` at the root installs both packages and links the audit to the local core, so changes to core are visible to the audit immediately.
- Core's `files` list continues to decide what its tarball contains, so the audit's code and TypeScript never enter core's published package.
- The audit's `exports` entry for `.` includes a `default` (or `require`) condition. Core finds the package with `createRequire(...).resolve` from the project root, which does not match an `import`-only export.
- Commands run per package (`npm test --workspace packages/audit`) or for both (`npm test --workspaces`).
- Core builds first: the audit's TypeScript build depends on core's compiled output and type declarations, so the root build script builds core and then the audit.

Users never see the workspace. They install two ordinary published packages:

```sh
npm install --save-dev @billbliss/architecture-graph @billbliss/architecture-graph-audit
```

Development, testing and trying the audit in another project from a local tarball need none of the release changes below. Only the audit's first publication does.

#### Release pipeline changes

The release workflow currently packages, tests and publishes one tarball. Before the audit's first release it must:

- package both workspaces, recording a checksum and source commit for each tarball, as it does today for core;
- run the packaged-consumer tests with both tarballs installed together, covering the hand-off, and with core alone, covering the "audit not installed" message;
- publish core first, then the audit, each through npm trusted publishing with the existing approval gate;
- check, on a rerun, each package's registry bytes independently, as it does today for core;
- verify a clean install of both packages by name after publication.

Each package needs its own trusted-publisher entry on npmjs.com. If npm requires a package to exist before a trusted publisher can be configured, the audit's first version is published manually once, and every later release goes through the workflow. Confirm npm's current behavior when preparing that release, and update `docs/publishing.md` with the outcome.

## Core format change: the `check` reference kind

### One definition of a guardrail

Core uses one definition everywhere: a **guardrail node** is a `policy`, `constraint` or `boundary` node, or any node classified `guardrail`. Before this specification, core was inconsistent:

- The guardrail index, and therefore `ag context --guardrail`, used that definition.
- The validator allowed `guarded_by` to target only the three rule kinds.

A node classified `guardrail`, such as a validation workflow, was listed as a guardrail, but nothing could be declared `guarded_by` it, so `ag context --guardrail` could not show what it guards. The fix widens the `guarded_by` target rule to every guardrail node. It only accepts graphs that were previously rejected, and it can ship before the rest of this specification. `governed_by` and `constrained_by` keep their existing target rules.

### The `check` reference kind

`references[].kind` gains `check`. A check reference names a check file. It is allowed only on guardrail nodes as defined above. It is not allowed on relationships.

```yaml
- id: constraint:platform-is-feature-neutral
  kind: constraint
  name: The platform is feature-neutral
  description: The generic reporting platform never depends on feature code; features plug in through registered contracts.
  status: implemented
  references:
    - kind: design
      path: docs/platform.md
    - kind: implementation
      path: src/platform/feature-registry.ts
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

`forbidden_reachability` takes `entries`, a list of repository-relative files, and `forbidden` selectors. It may also take `forbiddenPackages`, a list of package-specifier patterns such as `node:*` or `typescript`. Any forbidden file or package reachable from an entry through runtime imports is a finding. Each entry must be a TypeScript or JavaScript source file.

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
- `modules` maps graph module IDs to source globs. Every key must be a module declared in the graph, and a file may belong to at most one module. A graph can declare modules without assigning nodes to them, so adopting the audit does not require reorganizing an existing graph into modules. Globs work as selectors without any modules at all.
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

The baseline file is required even when it has no entries, so adopting the audit starts with an empty baseline (`baselineVersion: "1"` and `findings: []`). A missing baseline is invalid input, not an implicitly empty one.

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

The audit's view of the file system is the files git would consider: inside a git work tree, tracked files plus untracked files that are not ignored, listed with `git ls-files`; outside one, every regular file. In both cases symlinks are not followed and `node_modules` and `.git` are excluded. Inside a work tree, if git is missing or cannot list the files, the run fails with a configuration error rather than reading every file instead, so what the audit sees never changes silently.

Analysis is entry-first for reachability and file-first for dependencies:

- `forbidden_reachability` parses only files reached from its entries.
- `forbidden_dependency` parses every file matched by `from`.

Unreachable files are never parsed, so unrelated unsupported syntax elsewhere cannot block a check. A file that is parsed but cannot be analyzed because of unsupported or invalid syntax is a finding of kind `unresolved_import` with the specifier `<syntax>`, so its key is `<check>|unresolved|<file>|<syntax>`.

Reachability continues through a forbidden file, so every forbidden file and package reachable from an entry is reported, not only the first one found on each path. A reached file that is not a supported source file is a terminal: it can be forbidden, but it is not parsed and has no edges.

Edges:

- Static imports, side-effect imports, `export ... from`, `export * from`, `import x = require("...")`, `require("...")` with a string literal and `import("...")` with a string literal are runtime edges.
- `import type` and `export type` are not runtime edges and are ignored. Inline `type` modifiers on every imported name also make the import type-only.
- Relative specifiers resolve to source files by the usual rules: exact file, emitted-extension counterpart (a `.js` specifier to `.ts` source), then directory index. These are ordered steps: the first step that finds a file wins, and more than one candidate within that step is an ambiguity finding.
- Non-relative specifiers are first matched against the configured aliases. An alias match must resolve inside the repository. A configured `baseUrl` acts as an alias root, with or without `paths`: a specifier that resolves to a file under it is followed. A specifier that matches no alias is an external package terminal; it is recorded but not followed.
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

AG's own graph will use the audit on itself. One tripwire checks that the browser-safe core (`src/core.ts`) cannot reach `src/node.ts` or any `node:*` package, a property tested today only by bundling. Others check the package split described in [Two packages](#two-packages).

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
2. `src/validation.ts`: use the shared guardrail-node definition for `guarded_by` targets (shippable on its own, ahead of the rest) and for check references, which are never allowed on relationships.
3. `src/cli.ts`: the `ag audit` hand-off as specified, including resolution from the project root, unparsed argument pass-through and the protocol number.
4. Generated guidance: count guardrails with check files.
5. Viewer: show check files on guardrail panels, as file contents.

Audit package:

6. A new workspace package in `packages/audit/`, released with core at first. It depends on `typescript`, declares core as a peer dependency range, and exports `runAudit`. Add the root `workspaces` entry and build order.
7. The check file, audit configuration, baseline and report formats, with published JSON Schemas.
8. TypeScript discovery, selector expansion, the two check kinds, finding keys, baseline classification, `--base-baseline`, and the commands above.
9. Tests:
   - hand-off: package missing, protocol mismatch, global `ag` with a project-local audit, and argument pass-through;
   - each drift pattern in the version 1 table gets a fixture that passes `ag validate` and fails `ag audit` for the right reason;
   - each discovery rule gets a negative control: type-only imports ignored, aliases resolved, an unresolved dynamic import reported, and unreachable unsupported syntax ignored.

Both:

10. Skill: the workflow rules above, conditioned on the audit being installed.
11. AG's own graph: this specification as `decision:architecture-audit` (proposed), and the two self-checks once implemented.
12. Documentation: reference, compatibility, packaging, development (workspaces), publishing (two packages), and the CI guide (run `ag audit --tripwires` in pull requests).
13. Release pipeline: the changes in [Release pipeline changes](#release-pipeline-changes), completed before the audit's first publication but not needed to develop or test it.

## Decisions

- **One command.** The audit runs as `ag audit` through core's hand-off, not as a separate `ag-audit` command. One command keeps conventions such as `--config` shared and keeps agent instructions simple. The cost is the narrow hand-off contract above.
- **Released together at first, independent later if needed.** Matching versions are a starting practice. The peer dependency range, the hand-off protocol number and public-API-only access make compatibility explicit, so the packages can be released independently later without redesign.

## Open questions

- **Report hook.** Version 3's `--on-new-finding` hook runs a project-chosen command. Decide whether a hook belongs in the audit at all, or whether consuming the report in CI is enough.
- **By-design exceptions.** Permanent, by-design exceptions (for example, the hand-off's non-literal import) currently live in the baseline. Decide whether v2 needs a per-check exception list, with reasons, separate from the baseline of debt.
