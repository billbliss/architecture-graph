# Use AG with a coding agent

AG’s practical adoption model relies on a coding agent to keep the graph meaningful throughout development. People direct the architecture and review changes; the agent makes retrieval and record maintenance part of the normal coding workflow. The companion skill gives a coding agent a repeatable way to read your design, preserve open questions, and update the graph as the software changes. It helps a future coding session start with the decisions you have already made.

The skill is a folder of instructions, included in the toolkit package. It is not a separate executable, hosted service, or Visual Studio extension. The toolkit does the mechanical checks; the agent does the reading and modeling with your review.

One folder serves both agents. Each reads project skills from its own directory:

| Agent | Skill directory | Project instructions file |
| --- | --- | --- |
| Claude Code | `.claude/skills` | `CLAUDE.md` |
| Codex | `.agents/skills` | `AGENTS.md` |

## Install once per project

First [install the toolkit](getting-started.md). Then, from that project's root, choose **one** command for the agent or agents you use:

```sh
./node_modules/.bin/ag skill install --agent claude
./node_modules/.bin/ag skill install --agent codex
./node_modules/.bin/ag skill install --agent claude,codex
```

For Codex, `--agent codex` writes `.agents/skills/architecture-graph`, including `SKILL.md` and its references. It does not install a Claude skill or modify `AGENTS.md`. Use `--root /path/to/project` to target a different project.

The command copies the whole folder, so the modeling reference comes with it. It refuses to replace an existing copy; review your local changes first, then repeat with `--force`. Keep the copy's version aligned with the installed toolkit.

If you prefer to copy the folder yourself:

```sh
mkdir -p .claude/skills
cp -R node_modules/@billbliss/architecture-graph/skills/architecture-graph .claude/skills/
```

Use `.agents/skills` instead for Codex. If the skill does not show up after installing, restart the agent. Installing the folder makes the skill available; it does not run it, and it does not create a graph.

See [Claude Code's skill documentation](https://code.claude.com/docs/en/skills) or [OpenAI's skill documentation](https://learn.chatgpt.com/docs/build-skills) for how each agent loads project skills.

## Marketplace distribution is in preparation

Claude Code plugin and marketplace manifests are included for future testing and distribution. This route has not been validated end to end and is not a supported public installation path yet. Use the project installation command above for now.

Maintainers can follow the [publishing preparation guide](publishing.md) to validate the marketplace route before announcing it. A plugin would distribute the skill independently of the toolkit; it would not replace installing the `ag` command in each project.

## Is a marketplace useful for Codex too?

Yes: a marketplace helps distribute and update a shared skill across projects or a team. Codex supports plugin marketplaces, including a compatibility location for `.claude-plugin/marketplace.json`. Sharing the skill content does not by itself establish that a Claude plugin installs and loads correctly in Codex. The complete marketplace route for this repository remains unverified; use `ag skill install --agent codex` for the tested project installation.

A marketplace distributes agent instructions independently of the toolkit installed in each project. Keep their versions aligned, and avoid enabling a plugin copy alongside a project copy of the same skill. The project-copy route keeps the skill reviewable and versioned alongside the code; a marketplace is useful when centralized distribution matters more. Neither route replaces toolkit installation.

See [OpenAI’s plugin packaging and marketplace documentation](https://developers.openai.com/plugins/build/plugins) for supported manifests and distribution routes. The Claude `/plugin marketplace add` command is not a Codex command.

## Create the first graph

Open the project in your agent and name the documents it should read:

> Use the architecture-graph skill to read our requirements and design documents and create an initial graph. Focus on the responsibilities, owners, and boundaries that will matter as we build. Show me where the documents disagree or leave a decision open. We do not have application code yet.

In Codex, refer to the skill as `$architecture-graph`. In Claude Code, name it as above or invoke a project-installed skill with `/architecture-graph`. The plugin-installed skill is namespaced as `/architecture-graph:architecture-graph`.

This is the bootstrap step. The agent reads your material, creates the graph if needed, and checks it. Review the proposed design before relying on it. An empty starter graph, or one that merely passes validation, is not a useful substitute for that review.

## Keep it useful during changes

For an existing project:

> Use the architecture-graph skill to find the design context for this change. Explain which responsibilities or rules it affects, then maintain the graph alongside the implementation.

Give future sessions a short reminder in the project's instructions file—`CLAUDE.md` for Claude Code, `AGENTS.md` for Codex—preserving its other instructions:

> Before changing responsibilities, ownership, shared rules, or boundaries, use `./node_modules/.bin/ag context` to read the relevant design. Update the graph when the design changes. Run application tests, then the AG `validate`, `generate`, and `check` commands. The graph records our intent; passing AG checks does not prove the code follows it.

The same wording works in either file. If your project uses both agents, keep the reminder in both.

The skill supplies the reusable method. The project owns its decisions, graph, and this short reminder. You do not need to copy this toolkit's own history or its hello-world graph into your application.
