# Adding Claude Code support to the bundled skill — 0.3.0

This records what changed when the toolkit grew from a Codex-only skill to one skill folder serving both Claude Code and Codex, and what was and was not checked. It is a review record for the 0.3.0 change, not installation instructions. For those, see [using AG with a coding agent](../skill-installation.md).

Implemented in a Claude (Cowork) session against a working tree at commit `a0b644d`. Everything below was left uncommitted for review.

## The problem

The skill folder and its documentation assumed Codex: they named `.agents/skills` as the only install location and `AGENTS.md` as the only project instructions file, and the install step was a `cp -R` a reader had to transcribe correctly. Claude Code reads project skills from `.claude/skills` and takes project instructions from `CLAUDE.md`, so nothing in the toolkit told a Claude Code user what to do.

## Decisions

**One skill folder, not one per agent.** `skills/architecture-graph/` stays the single source. The only agent-specific content in `SKILL.md` was the name of the project instructions file, which now reads "`AGENTS.md` for Codex, `CLAUDE.md` for Claude Code". Two tailored copies would have doubled the maintenance cost of every future modeling-guidance change for one sentence of difference.

**A command, not just documentation.** `ag skill install` replaces the copy-paste instructions. Documentation alone would have been a smaller change, but the copy step has a real failure mode—copying `SKILL.md` without `references/modeling.md`, or silently overwriting a team's local edits—and a command can refuse rather than destroy. The manual `cp -R` remains documented for people who prefer it.

**Plugin manifests as an alternative, not a replacement.** `.claude-plugin/` makes the repository installable as a Claude Code plugin, which suits a team that wants the skill everywhere without committing it to each project. It does not install the `ag` command, and it does not pin the skill version alongside the toolkit, so the copy-into-the-project route stays the documented default.

**No agent-specific vocabulary in the skill itself.** The skill says what to do, not how a particular agent is invoked. Invocation syntax (`$architecture-graph` for Codex, `/architecture-graph` for Claude Code) lives in the documentation, where it can change without touching the skill.

## What changed

### New files

| File | Purpose |
| --- | --- |
| `src/skills.ts` | `installSkill()`, the agent-to-directory table, and bundled-skill resolution |
| `.claude-plugin/plugin.json` | Claude Code plugin manifest; version tracks the toolkit |
| `.claude-plugin/marketplace.json` | Marketplace entry pointing at the repository root |
| `docs/history/claude-skill-support.md` | This record |

Claude Code discovers a plugin's skills under `skills/` at the plugin root, which is where the folder already lives, so `plugin.json` declares no `skills` path.

### Modified

| File | Change |
| --- | --- |
| `skills/architecture-graph/SKILL.md` | Names both instructions files; toolkit version 0.3.0 |
| `src/cli.ts` | `skill install` subcommand; `--agent` and `--force` options; two-positional commands are now possible |
| `src/index.ts` | Exports `installSkill`, `bundledSkillPath`, `SKILL_NAME`, `SKILL_AGENTS`, `SKILL_TARGETS` and their types |
| `src/model.ts`, `package.json`, `package-lock.json`, `.claude-plugin/plugin.json` | 0.2.0 → 0.3.0 |
| `docs/skill-installation.md` | Retitled "Use AG with a coding agent"; per-agent table, CLI install, plugin route, `CLAUDE.md` reminder |
| `docs/getting-started.md` | Section 3 rewritten for either agent; tarball name and expected `--version` output |
| `docs/reference.md` | Command rows for `skill install`; `installSkill` added to the exported API list |
| `docs/compatibility.md` | Section retitled 0.3.0; upgrade step uses the command; release policy now covers new capabilities |
| `docs/development.md` | `src/skills.ts` added to the entry-point table |
| `docs/README.md`, `README.md`, `docs/github-packaging.md`, `examples/hello-world/README.md` | Agent-neutral wording; version references |
| `examples/hello-world/architecture/generated/*` | Regenerated; `toolVersion` only |
| `test/toolkit.test.js`, `test/consumer.mjs` | See below |

## The command

```
ag skill install --agent claude|codex[,...] [--root DIR] [--force]
```

`claude` writes `.claude/skills/architecture-graph`; `codex` writes `.agents/skills/architecture-graph`. Both agents can be named in one call.

Behavior worth knowing when reviewing:

- Every destination is validated and checked for a pre-existing copy **before** anything is written, so a call naming two agents cannot leave one installed and the other refused.
- An existing skill folder is refused unless `--force`. This is the same stance `ag init` takes toward existing declarations.
- Destinations go through the existing `localPath` guard, so a symlinked `.claude` or `.agents` directory is rejected rather than followed out of the project.
- The bundled folder is resolved relative to the compiled module, so it works from a clone and from `node_modules`.
- `--json` reports each installation with `agent`, `path` and `replaced`.
- Installing copies instructions. It does not create, read or change a graph, and the command output says so.

`src/skills.ts` imports only `node:fs`, `node:path`, `node:url` and the existing `localPath` helper. It adds no dependency.

## Tests

Three unit tests in `test/toolkit.test.js`:

- installing for both agents places `SKILL.md` and `references/modeling.md` in each location and reports `replaced: false`
- a locally edited skill is refused, the edit survives the refusal, and `--force` then replaces it
- an unknown agent is rejected before any directory is created

The existing version-consistency test now also asserts that `.claude-plugin/plugin.json` matches `VERSION` and that the marketplace entry points at `./`, so a future version bump that misses a manifest fails.

`test/consumer.mjs` installs the skill for both agents from the packed tarball and checks that a second install is refused, which exercises bundled-skill resolution inside a real `node_modules` layout.

## Verification

`npm run verify` passes: 23 unit tests, then the full consumer lifecycle against the packed 0.3.0 tarball. `ag check` on hello-world is clean, so the committed generated artifacts match the graph.

What this does not establish: nobody has yet installed the plugin through `/plugin marketplace add` and confirmed Claude Code loads the skill from it. The manifests match the documented schema and the version test guards them, but the end-to-end plugin path is unexercised. Reviewing that by hand is worthwhile before advertising the plugin route.

## An unrelated defect found along the way

`test/consumer.mjs` intended to install into a throwaway npm cache, falling back to `process.env.npm_config_cache` when the caller set one. npm exports its own configuration into the environment of scripts it runs, so under `npm run verify` that variable is always present and always points at the caller's real cache. The isolated cache was never used, and installs resolved from whatever metadata that cache happened to hold.

This surfaced as `ETARGET no matching version found for zod@4.6.1` on a machine whose cached package metadata predated that release, while `registry.npmjs.org/zod/4.6.1` served it with the integrity hash recorded in `package-lock.json`. The override is now `AG_NPM_CACHE`, so the default is a clean cache and the test needs network access. `docs/github-packaging.md` documents both.

One open question, unchanged by this work: `zod@4.6.1` is pinned and resolves, but npm's `latest` tag for zod was `4.5.4` at the time of writing and no 4.6.x release was listed upstream. A published version that is not tagged `latest` can indicate a rolled-back release. Worth a deliberate decision rather than leaving it to inertia.


## Follow-up review

Fresh npm registry metadata on 2026-09-09 identifies **4.6.1 as `latest`**, with publication time `2026-09-09T21:50:12.924Z`, no deprecation marker, and the same integrity hash as the checked-in lockfile. The [upstream v4.6.1 release](https://github.com/colinhacks/zod/releases/tag/v4.6.1) is also present. The pin is retained. The earlier discrepancy does not establish a rollback; cache freshness or publication timing remain possible explanations. A fresh-cache packaged consumer run passed during review, verifying current resolution separately from those historical observations.

The existing installer already supported Codex. Review added an own-property check for agent names: JavaScript prototype names such as `constructor` previously passed validation. The copied modeling guide also had a repository-relative link that broke after installation; it now directs readers to the installed toolkit documentation.

Tests now exercise Codex-only installation from the tarball, preservation of local edits, explicit replacement and JSON reporting, rejection of inherited property names, and destination preflight when another agent’s destination is occupied or symlinked. The installer preflights validation errors; it does not promise rollback for arbitrary disk failures during copying.

Marketplace installation remains a separate, unverified path. Claude Code is not installed in the review environment, so no live marketplace-add or skill-discovery test was performed. The documentation distinguishes project and plugin invocation names and marks the marketplace path as unverified. Codex’s marketplace mechanism is useful for distribution too, but the tested route here is the project-copy command.

Review validation: 25 unit tests passed, the packaged consumer lifecycle passed with a fresh npm cache, the bundled skill passed its validator, and hello-world generated output has no drift.
