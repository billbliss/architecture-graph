# Companion Codex skill

The npm tarball bundles `skills/architecture-graph` alongside the matching toolkit. After installing the package in a consumer, copy the skill into that repository's Codex discovery directory:

```sh
mkdir -p .agents/skills
cp -R node_modules/@architecture-graph/toolkit/skills/architecture-graph .agents/skills/
```

If a skill already exists there, review its version and any local changes before replacing it. This copies the whole folder, including its modeling reference. Keep tooling and skill versions aligned when upgrading. A project can commit the copied skill for its developers.

Codex discovers repository skills under `.agents/skills`; the skill entry point is `SKILL.md` with name and description metadata. See [OpenAI's skill documentation](https://learn.chatgpt.com/docs/build-skills). This workflow works with Codex independently of Visual Studio. Discovery and behavioral testing in a fresh Codex session remain a manual adoption check; package tests verify the distributed files and command interfaces.

Suggested prompts:

> Use $architecture-graph to read our requirements and design documents and bootstrap a proportionate graph. Preserve contradictions and open decisions; there is no implementation yet.

> Use $architecture-graph to retrieve context for the formatting change, maintain declarations alongside code, and validate the resulting graph and generated guidance.

Add a small project-specific instruction to the consuming project's AGENTS.md, preserving its existing content:

> Before changing responsibilities, ownership, authorities, contracts or boundaries, retrieve context using `./node_modules/.bin/ag context`. Maintain the configured graph alongside implementation. Run relevant application checks, `ag validate`, `ag generate`, and `ag check`. Canonical declarations belong to this project; generated guidance is derived. Structural validation does not establish implementation conformance.

Replace bare `ag` in project instructions with your npm script or installed executable path if it is not on PATH. `init` intentionally does not change AGENTS.md or install a skill automatically.
