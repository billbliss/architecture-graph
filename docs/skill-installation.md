# Use AG with Codex

A graph is useful only if someone keeps it meaningful. The companion skill gives Codex a repeatable way to read your design, preserve open questions, and update the graph as the software changes. It helps a future coding session start with the decisions you have already made.

The skill is a folder of instructions, included in the toolkit package. It is not a separate executable, hosted service, or Visual Studio extension. The toolkit does the mechanical checks; Codex does the reading and modeling with your review.

## Install once per project

First [install the toolkit](getting-started.md). Then, from that project's root:

```sh
mkdir -p .agents/skills
cp -R node_modules/@architecture-graph/toolkit/skills/architecture-graph .agents/skills/
```

Copy the whole folder so the modeling reference comes with it. If you already have a copy, review any local changes before replacing it. Keep its version aligned with the installed toolkit.

Codex reads project skills from `.agents/skills`. If it does not show up after copying, restart Codex. See [OpenAI's skill documentation](https://learn.chatgpt.com/docs/build-skills). Installing the folder makes the skill available; it does not run it.

## Create the first graph

Open the project in Codex and name the documents it should read:

> Use $architecture-graph to read our requirements and design documents and create an initial graph. Focus on the responsibilities, owners, and boundaries that will matter as we build. Show me where the documents disagree or leave a decision open. We do not have application code yet.

This is the bootstrap step. Codex reads your material, creates the graph if needed, and checks it. Review the proposed design before relying on it. An empty starter graph, or one that merely passes validation, is not a useful substitute for that review.

## Keep it useful during changes

For an existing project:

> Use $architecture-graph to find the design context for this change. Explain which responsibilities or rules it affects, then maintain the graph alongside the implementation.

Give future sessions a short reminder in the project's `AGENTS.md`, preserving its other instructions:

> Before changing responsibilities, ownership, shared rules, or boundaries, use `./node_modules/.bin/ag context` to read the relevant design. Update the graph when the design changes. Run application tests, then the AG `validate`, `generate`, and `check` commands. The graph records our intent; passing AG checks does not prove the code follows it.

The skill supplies the reusable method. The project owns its decisions, graph, and this short reminder. You do not need to copy this toolkit's own history or its hello-world graph into your application.
