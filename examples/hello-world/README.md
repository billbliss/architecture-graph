# Hello-world: see what AG adds to a change

This example uses JavaScript for a small runnable demonstration. AG works with any programming language; adopting it elsewhere adds Node/npm as development tooling. See [language support and toolchain impact](../../docs/languages-and-toolchain.md).

You would not normally use an architecture graph for Hello World. The program is too small to need one: a reader can understand it faster than they can maintain a separate model.

This example is deliberately small so the lesson stays visible. It shows how a design decision can be recorded before code exists, retrieved before a change, and kept up to date afterward. In a larger application, those same steps help a developer or coding agent avoid rediscovering—or accidentally overriding—decisions spread across many files.

## The decision worth preserving

This application greets a person. Its design says that the formatter decides the wording; the command-line interface simply prints the result. Keeping that responsibility in one place makes a wording change predictable.

The example then adds a formal greeting. Before changing code, AG can bring back the relevant formatting rule, the component responsible for it, and the earlier open question about tone. That is the value being illustrated: begin the change with the reasons behind the design in view.

There is an interface, a greeting service, and a formatter here to make those relationships visible. This is a teaching example, not a recommended way to structure every small program.

## Run it

From the root of a clone of the Architecture Graph repository:

```sh
npm run package
cd examples/hello-world
npm install --no-save --package-lock=false ../../dist/billbliss-architecture-graph-0.3.0.tgz
npm start -- Ada formal
npm test
npm run ag -- context --file src/formatter.js
```

The application prints `Good day, Ada.`. The context command shows the design around the formatter. The graph also groups the interface and greeting behavior into two logical modules in the same YAML file. Those groups make their import/export relationship visible.

The example uses the installed package's public commands, just as another project would. Its graph and configuration belong to this folder.

The graph is already populated, so **do not run `ag init` here**. To add AG to your own project instead, follow [getting started](../../docs/getting-started.md).

## Read the story in three stages

Start with [the requirements](requirements.md), then compare:

| Stage | What it shows |
| --- | --- |
| [Proposed design](stages/proposed.json) | The intended responsibilities before source code exists, with tone still an open question |
| [First implementation](stages/implemented.json) | The same ideas connected to actual files |
| [Current graph](architecture/graph.yaml) | Formal tone has been implemented; localization remains unanswered |

The files in `stages/` are saved teaching examples. `architecture/graph.yaml` is the design record used by this application today. The [generated briefing](architecture/generated/guidance.md) is a readable view of it.

After changing the graph, run:

```sh
npm run ag -- validate
npm run ag -- generate
npm run ag -- check
```

These commands check the records, refresh the briefing, and confirm that it matches the graph. Application tests still have a separate job: checking what the software actually does.

## Watch the complete lifecycle, including failures

From the toolkit repository root, run `npm run test:consumer`. It creates a temporary project, installs a package and its runtime dependencies, and walks through the whole story:

1. Model the requirements before any application source exists.
2. Implement the first greeting and add references to the real files.
3. Retrieve the formatter's design context before adding formal tone.
4. Update code, graph, and generated guidance together.
5. Demonstrate that AG catches missing relationship targets, duplicate IDs, and missing implementation references.
6. Detect an out-of-date briefing and regenerate it.
7. Replace the formatter with broken code: AG checks still pass, but application tests fail.

That last step is intentional. AG can preserve a clear statement of the intended design; it cannot prove that the implementation follows it. The temporary project, including the broken code, is removed afterward. This checked-in example remains working.
