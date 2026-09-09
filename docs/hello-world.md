# Hello-world proving application

The example owns its configuration, graph, requirements and code. It imports no toolkit internals and uses the same tarball installation path as other consumers.

From the toolkit root:

```sh
npm pack --pack-destination /tmp
cd examples/hello-world
npm install --save-dev /tmp/architecture-graph-toolkit-0.1.0.tgz
npm start -- Ada formal
npm test
npm run ag -- validate
npm run ag -- generate
npm run ag -- check
npm run ag -- context --file src/formatter.js
```

The CLI prints `Good day, Ada.`. The checked-in graph represents this final implementation; snapshots in `stages/` preserve the earlier declaration states. These snapshots are walkthrough inputs, not additional canonical graphs.

## Reproducible lifecycle

Run `npm run test:consumer` from the toolkit root. The driver installs a freshly packed tarball offline into a separate temporary directory (including a space in its path), with no Alpha Engine dependency. It performs these steps through the installed executable:

1. **Requirements before code.** Copy `requirements.md`, initialize AG, and replace the empty declarations with `stages/proposed.json`. No `src` directory exists. Validate, generate, and check; the tone decision is explicitly unresolved.
2. **Implement the initial contract.** Create the interface, delegating greeter, and friendly formatter. Run the CLI and verify `Hello, Ada!`. Load `stages/implemented.json` with references to those real files, validate and generate.
3. **Retrieve change context.** Query `src/formatter.js`. The neighborhood includes the greeting contract, its declared authority, and the tone decision before making the change.
4. **Evolve together.** Add formal tone and reject unsupported tones, update the contract and decision declarations to the final graph, and run application tests. `check` detects outdated guidance. Regenerate and check again.
5. **Inject graph errors.** Individually introduce a dangling endpoint, duplicate identifier, implemented declaration without an implementation reference, and nonexistent source path. Each validation exits 1. Restore the real graph.
6. **Inject generated drift.** Replace guidance with stale text. `check` exits 2 and leaves the file untouched; generate restores consistency.
7. **Demonstrate the limit.** Replace the real formatter with one returning `WRONG`. The declarations still reference a real file; AG validation and generated checks pass, but application tests fail. Thus valid declarations do not prove implementation conformance.
8. **Verify packaging.** Import the installed package's public ESM interface. Install the same tarball into the checked-in example without altering its manifest and run its checks.

The temporary directory is removed afterward, including the intentionally broken implementation. The checked-in example remains working. See `validation-results.md` for the recorded run. These tests demonstrate functionality and limits; they are not AAG evidence.
