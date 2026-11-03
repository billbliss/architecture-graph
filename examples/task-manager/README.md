# Task manager: a familiar design to browse

This example models a task list manager with reminders, offline sync, notifications and search. Everyone knows what a task manager does, so you can judge the architecture graph itself instead of first learning an unfamiliar system.

It is a design-stage model: there is no application code. Every record is `proposed` or `unresolved`, and references point to [the requirements](requirements.md) and to draft contract files. AG requires an `implemented` record to reference real implementation files, so marking anything implemented here would be false.

## What it shows that hello-world doesn't

| Shape | Where to look |
| --- | --- |
| One contract with several consumers | `contract:task-changed` is consumed by reminders, sync, notifications and search |
| Declared contract use | Consumers point at contracts with `consumes`, instead of only at the capability behind them |
| A two-way module dependency | Tasks reads the next reminder time from Reminders; Reminders asks Tasks to move a due time when snoozing |
| Guarantees as boundaries | "Only the task service changes tasks", "Completed tasks never fire reminders", "Offline edits are never silently lost" |
| Open questions | How repeating tasks are stored, how sync conflicts are resolved, whether reminders fire offline |

## Contract files

Each contract node references a draft JSON Schema in [`contracts/`](contracts/) and an example payload in [`contracts/examples/`](contracts/examples/). These are ordinary `design` references for now. The [contract sidecars specification](../../docs/specs/contract-sidecars.md) proposes dedicated `schema` and `example` reference kinds, with AG checking that each example matches its schema, and adopts this naming as the default location. Once that is implemented, this example will switch to the new reference kinds.

## Run it

From the repository root, after `npm run build`:

```sh
node bin/ag.js validate --config examples/task-manager/ag.config.json
node bin/ag.js check --config examples/task-manager/ag.config.json
node bin/ag.js context --config examples/task-manager/ag.config.json --id contract:task-changed
node bin/ag.js context --config examples/task-manager/ag.config.json --module module:sync
```

Validation checks the records and that referenced files exist. It does not show that the design is good or that any future implementation follows it.

## How the graph was written

The graph was authored from the requirements. Module imports and exports were derived from the cross-module relationships, so they match the edges exactly. Edit [`architecture/graph.yaml`](architecture/graph.yaml) directly from here on, then run `generate` and `check`.
