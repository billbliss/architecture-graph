# Use AG with any language—and account for its toolchain

AG is designed for projects in any programming language, including projects that combine languages or have only design documents so far. It records responsibilities, ownership, contracts, boundaries and decisions. Those ideas apply equally to a Python service, a Rust application, a C# backend or a JavaScript frontend.

The toolkit is implemented in TypeScript, but using it does not require TypeScript knowledge. Its references name local files regardless of language. AG does not parse your application's code or depend on a particular language's type system. Developers and coding agents interpret the code and maintain the declarations; the toolkit checks the records and retrieves relevant context.

For example, a Python project could record that a billing service owns invoice calculation and must preserve rounding rules defined in a shared module. AG can surface those rules before a change and check that the referenced files exist. Python tests and review still establish whether invoice calculation follows those rules.

## What changes in your toolchain

**AG is language-independent, with a Node-based toolchain.** It currently requires Node.js 22 or later and npm wherever you run its commands. Consumers install ready-to-run JavaScript; they do not need a TypeScript compiler.

| Area | Practical impact |
| --- | --- |
| Developer setup | Install Node/npm if the machine does not already have a suitable version. Install AG in the project, alongside its existing tools. |
| Repository files | Add a `package.json` and npm lockfile if absent, plus AG's configuration and graph. With today's tarball distribution, keep the installed archive in `vendor/` so teammates and CI can reproduce the installation. |
| Daily work | Run AG commands alongside your native build and test commands when the design changes. The application keeps its existing language and build system. |
| CI | Set up Node and install the locked npm dependencies in jobs that run AG. Other jobs can continue using only the application's native tools. |
| Updates | Maintain AG and its npm dependencies separately from the application's dependencies. Dependency review policies may also apply to these development tools. |
| Production | Using AG as a development tool does not require Node in the deployed application. Keep it in development dependencies and out of production packaging unless the deployment itself runs AG. |

A repository containing `pyproject.toml`, `Cargo.toml`, or a solution file can also have a small `package.json` used solely for AG. Installing AG does not require converting the application into an npm project or changing its source files. Ignore `node_modules` in version control; commit the package manifest and lockfile. The [installation guide](getting-started.md) walks through this setup.

The tarball contains AG, but npm also installs its YAML and schema dependencies. A first installation needs registry access unless those dependencies are already cached. A future npm registry release would simplify acquiring and updating AG; it would not remove the Node requirement. There is currently no standalone executable or native Python, Rust or .NET distribution.

## Is the overhead worth it?

If the team already uses Node for frontend work or other development tools, the extra setup is usually modest. If AG introduces the team's first Node toolchain, account for runtime installation, version management, another lockfile and dependency updates. That can be noticeable, especially in environments where new runtimes need approval.

For a large project whose design is difficult to keep in view, those costs may be justified by less repeated investigation and more consistent changes. For a small project that is easy to understand, both the toolchain and graph maintenance can cost more than they save. Start with the architectural decisions worth preserving, rather than cataloging every file.

Moving generation to [GitHub Actions](indexing-and-ci.md) can reduce repeated local generation work. People who only read the generated Markdown need no Node installation. Anyone running local validation or context queries still needs the toolkit and Node, even when the indexes were produced in CI.

The [hello-world example](../examples/hello-world/README.md) uses JavaScript to keep its demonstration small. Its workflow—record intent, retrieve context, update the design alongside code, and check both—is applicable in other languages.
