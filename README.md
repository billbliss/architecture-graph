# Architecture Graph

Keep the reasons behind your software's design close to the code.

As a project grows, it gets harder to answer simple questions: who owns this responsibility? Which part decides what a value means? What must stay true when we change this interface? The answers often live across design documents, old discussions, and someone's memory. Developers and AI coding agents end up rediscovering them—or making different assumptions.

Architecture Graph (AG) gives those answers a small, shared home in your repository. It records the important parts of your design and how they relate, so the next change can start with the intended architecture in view.

## What you get

- **Useful context before a change.** Find the responsibilities, rules, and decisions connected to the area you are working on.
- **A design that can grow with the project.** Begin with requirements and proposals before code exists. Keep unanswered questions visible, then connect the design to real files as you build.
- **Less repeated explanation.** Generate a readable briefing that helps developers and coding agents work from the same understanding.
- **Checks that catch broken records.** Find references to missing files, conflicting ownership declarations, and guidance that no longer matches the graph.

AG is useful when important design decisions are becoming difficult to remember or explain consistently. A tiny program you can understand at a glance usually does not need it. The [hello-world example](examples/hello-world/README.md) deliberately uses a tiny program to make the workflow easy to see.

AG records what the software is intended to do. It does not prove that the code follows that intent; application tests and review still matter.

## Getting started: three separate steps

1. **Install the toolkit in your project.** This adds the `ag` command, which reads and checks the graph.
2. **Optionally add the Codex skill.** This teaches Codex how to help build and maintain the graph. It comes inside the toolkit download; it is not another service or subscription.
3. **Create your project's first graph.** Read the project's requirements and design documents, then record the important responsibilities, rules, and open questions. You or Codex do this work; installation alone does not do it.

The toolkit currently comes as a downloadable `.tgz` package from GitHub Actions, or you can build it from this repository. There is no npm registry release yet. You need Node.js 22 or later and npm. You do not need Visual Studio or the project AG originally came from.

**[Follow the installation and first-graph guide →](docs/getting-started.md)**

## Where to go next

- [Try the hello-world example](examples/hello-world/README.md) to see a design evolve alongside working code.
- [Use AG with Codex](docs/skill-installation.md) to turn your documents into a useful starting graph.
- [Look up commands and file formats](docs/reference.md) when you need the details.
- [Understand the limits and upgrades](docs/compatibility.md) to know what the checks do—and what they cannot tell you.
- [Download or build a package](docs/github-packaging.md) for your team.

The [project history](docs/history/README.md) records how AG was created. It is optional background, not part of learning to use the toolkit.

Version **0.1.0** · [MIT licensed](LICENSE)
