# Architecture Audit for AG

`@billbliss/architecture-graph-audit` is the optional source-reading part of [Architecture Graph](https://github.com/billbliss/architecture-graph). It checks TypeScript and JavaScript imports against structural rules declared in check files, which guardrail nodes reference with `kind: check`. Run it through core's command:

```sh
npm install --save-dev @billbliss/architecture-graph @billbliss/architecture-graph-audit
ag audit validate
ag audit --tripwires
```

Findings are advisory structural evidence. A clean audit means that, within the declared scopes and the supported import grammar, no forbidden import was found apart from baselined ones. It does not show that the code behaves as the graph says, that an allowed path is correct, or that the checks cover everything important.

The check file, `ag.audit.json`, baseline and report formats are published as JSON Schemas under `schema/`. The [Architecture Audit specification](https://github.com/billbliss/architecture-graph/blob/main/docs/specs/architecture-audit.md) describes them, the commands and the exit codes.
