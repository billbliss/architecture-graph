# Add AG to your project

The goal is to give your project a shared record of its important design decisions. Installing a tool is only the first part. The useful result is a small graph that you and your coding agent can consult before making changes.

AG works with any programming language. Running its commands requires Node.js 22 or later and npm, even when your application uses another language. For a project without Node tooling, this adds a development toolchain and npm dependency files; it does not change the application’s runtime. Read [language support and toolchain impact](languages-and-toolchain.md) before deciding whether that overhead fits your project.

AG has three pieces:

| Piece | What it does | Where it lives |
| --- | --- | --- |
| Toolkit | Provides commands to read the graph, check it, and generate guidance | Installed in your project's `node_modules` |
| Coding-agent skill (optional) | Gives Claude Code or Codex a method for creating and maintaining the graph | Installed into your project's `.claude/skills` or `.agents/skills` |
| Your graph | Records your project's responsibilities, rules, relationships, and open decisions | Usually `architecture/graph.yaml` in your repository |

You can use AG without a coding agent by editing the graph yourself. Adding the skill does not automatically create a graph or change your application.

## 1. Get the package

You need Node.js 22 or later and npm. The current package is `architecture-graph-toolkit-0.3.0.tgz`, an archive npm can install. It is not yet available by package name from the npm registry.

Download a successful build from the repository's **Actions → Validate and package → Artifacts**, and extract the ZIP. See [package downloads](github-packaging.md) for details and checksum instructions.

If you already have a clone of this toolkit repository, you can create the same kind of package there:

```sh
npm ci
npm run package
```

The archive appears in `dist/`. Building the toolkit package is separate from installing it into the project where you want to use AG.

## 2. Install it in the project you want to model

Go to **your project's root directory**. Put a copy of the downloaded or built `.tgz` archive in a folder named `vendor` there. Keeping the archive with the project makes later installations repeatable.

If your project does not have a `package.json`, run `npm init -y` first. This is just a way to install the AG tooling; your application does not have to use JavaScript.

```sh
npm install --save-dev ./vendor/architecture-graph-toolkit-0.3.0.tgz
./node_modules/.bin/ag --version
```

npm installs the YAML and schema libraries along with the toolkit; an initial install needs registry access unless those dependencies are cached. The second command should print `0.3.0`. The toolkit is now installed, but it has not read your documents or created a design.

## 3. Let a coding agent help, or create the graph yourself

### With Claude Code or Codex

Install the bundled skill where your agent reads project skills:

```sh
./node_modules/.bin/ag skill install --agent claude
```

Use `--agent codex` for Codex, or `--agent claude,codex` for both. The command writes to `.claude/skills` or `.agents/skills` and refuses to replace an existing copy; review local changes first, then repeat with `--force`. Claude Code users can install the skill as a plugin instead—see [using AG with a coding agent](skill-installation.md).

Open this project in your agent, then ask:

> Use the architecture-graph skill to read our requirements and design documents and create a small initial architecture graph. Explain the responsibilities and boundaries you found. Keep proposals and unanswered questions explicit. Add a short instruction to our project instructions file so future architectural changes consult and maintain the graph.

Point the agent to the documents that matter. Review the result together: does it capture the decisions you want the next developer to understand? This is what **bootstrapping** means here—building the first useful design record from the material you already have. The skill guides the agent; the command-line toolkit does not extract architecture from documents on its own.

See [using AG with a coding agent](skill-installation.md) for follow-up prompts and the project instruction.

### Without an agent

Create the starter files:

```sh
./node_modules/.bin/ag init --id graph:my-project --title "My project architecture"
```

This creates `ag.config.json` and an **empty** `architecture/graph.yaml`. It does not scan code or decide what your architecture should be. If these files already exist, it refuses to replace them.

Read your requirements, then edit the graph's description to explain its scope. Add a few important ideas to the `nodes` array. For example:

```yaml
- id: capability:welcome
  kind: capability
  name: Welcome a person
  description: "Proposed responsibility: welcome a person by name. The wording is still undecided."
  status: proposed
  references: []
```

Replace the starter’s `nodes: []` with `nodes:` followed by this list entry, indented two spaces. Keep the other top-level fields. This adds one idea; it does not replace the whole graph. The [modeling guide](../skills/architecture-graph/references/modeling.md) explains how to connect ideas and cite existing documents. A project with no code can have a useful graph: leave planned work proposed and unanswered choices unresolved.

## 4. Check and use the graph

Once you or your agent have added the initial design:

```sh
./node_modules/.bin/ag validate
./node_modules/.bin/ag generate
./node_modules/.bin/ag check
./node_modules/.bin/ag summary
```

`validate` finds problems in the records, such as a relationship pointing to something that does not exist. `generate` creates a briefing and summary under `architecture/generated`. `check` tells you whether those generated files match the graph. `summary` shows what is modeled and which questions remain open.

Before a later change, look up the relevant idea by its ID, or a file already referenced by the graph:

```sh
./node_modules/.bin/ag context --id capability:welcome
```

Use your own ID if you did not add the manual example above. Read the related responsibilities and rules, make the change, and update the graph when the design changes. Run application tests separately, then validate, generate, and check again.

## What to keep in version control

Keep the graph, configuration, project instructions, and any installed skill folder alongside your code and design documents. Also keep `package.json`, `package-lock.json`, and the package archive in `vendor/` so teammates can run `npm ci`. If your repository ignores `.tgz` files, add an exception for that archive. Do not commit `node_modules`.

For a first adoption, keeping the generated briefing in version control makes changes easy to review. Check it before regenerating when you want to detect stale output; generating first replaces the old output. The [reference](reference.md) explains the alternative of recreating it during a build.

You are ready when the graph helps someone understand a real design decision—not merely when the checks pass.
