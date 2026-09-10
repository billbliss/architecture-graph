# Add AG to your project

The goal is to give your project a shared record of its important design decisions. The intended workflow uses a coding agent to retrieve and maintain that record, with you directing and reviewing the work. Installing a tool is only the first part. The useful result is a small graph that you and your coding agent can consult before making changes.

AG works with any programming language. Running its commands requires Node.js 22 or later and npm, even when your application uses another language. For a project without Node tooling, this adds a development toolchain and npm dependency files; it does not change the application’s runtime. Read [language support and toolchain impact](languages-and-toolchain.md) before deciding whether that overhead fits your project.

AG has three pieces:

| Piece | What it does | Where it lives |
| --- | --- | --- |
| Toolkit | Provides commands to read the graph, check it, and generate guidance | Installed in your project's `node_modules` |
| Coding-agent skill | Gives Claude Code or Codex a method for creating and maintaining the graph | Installed into your project's `.claude/skills` or `.agents/skills` |
| Your graph | Records your project's responsibilities, rules, relationships, and open decisions | Usually `architecture/graph.yaml` in your repository |

Plan to use Claude Code or Codex for ongoing maintenance. Manual commands remain useful for inspection, troubleshooting and CI; maintaining the graph entirely by hand requires sustained extra discipline. Adding the skill does not automatically create a graph or change your application.

## 1. Prepare your tools

Use Claude Code or Codex, Node.js 22 or later, and npm. Your application can use any language. Go to the root of the project you want to model. If it has no `package.json`, run `npm init -y` to create a manifest for development tools.

## 2. Install it in the project you want to model

The npm installation command for this release is:

```sh
npm install --save-dev @billbliss/architecture-graph@0.3.1
./node_modules/.bin/ag --version
```

For a local build, use [tarball installation](github-packaging.md). npm installs the toolkit's dependencies as well. Initial installation requires registry access unless the packages are cached. The version command should print `0.3.1`; installation does not infer your design.

## 3. Bootstrap the graph with your coding agent

Install the bundled skill where your agent reads project skills:

```sh
./node_modules/.bin/ag skill install --agent claude
```

Use `--agent codex` for Codex, or `--agent claude,codex` for both. The command writes to `.claude/skills` or `.agents/skills` and refuses to replace an existing copy; review local changes first, then repeat with `--force`. Marketplace distribution is still being validated—see [using AG with a coding agent](skill-installation.md).

Open this project in your agent, then ask:

> Use the architecture-graph skill to read our requirements and design documents and create a small initial architecture graph. Explain the responsibilities and boundaries you found. Keep proposals and unanswered questions explicit. Add a short instruction to our project instructions file so future architectural changes consult and maintain the graph.

Point the agent to the documents that matter. Review the result together: does it capture the decisions you want the next developer to understand? This is what **bootstrapping** means here—building the first useful design record from the material you already have. The skill guides the agent; the command-line toolkit does not extract architecture from documents on its own.

See [using AG with a coding agent](skill-installation.md) for follow-up prompts and the project instruction.

For the underlying commands and a small YAML example, see [manual operation](manual-operation.md). Use it to understand or troubleshoot the agent’s work.

## 4. Check and use the graph

Have the agent run these checks after adding the initial design, and review its summary:

```sh
./node_modules/.bin/ag validate
./node_modules/.bin/ag generate
./node_modules/.bin/ag check
./node_modules/.bin/ag summary
```

`validate` finds problems in the records, such as a relationship pointing to something that does not exist. `generate` creates a briefing and summary under `architecture/generated`. `check` tells you whether those generated files match the graph. `summary` shows what is modeled and which questions remain open.

Before a later change, have the agent retrieve context for the affected idea or source file. For example:

```sh
./node_modules/.bin/ag context --id capability:welcome
```

Use an ID from your project’s graph; `capability:welcome` is only an example. The agent should read the related responsibilities and rules, make the change, update the declarations and run application tests and AG checks. Review decisions and behavior rather than treating a green graph check as approval.

## What to keep in version control

Keep the graph, configuration, project instructions, and the installed skill folder alongside your code and design documents. Also keep `package.json` and `package-lock.json` so teammates can run `npm ci`. If you installed from a tarball, retain that archive in `vendor/` and ensure version control includes it. Do not commit `node_modules`.

For a first adoption, keeping the generated briefing in version control makes changes easy to review. Check it before regenerating when you want to detect stale output; generating first replaces the old output. The [reference](reference.md) explains the alternative of recreating it during a build.

You are ready when the graph helps someone understand a real design decision—not merely when the checks pass.
