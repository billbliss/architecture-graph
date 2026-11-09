# Drift pattern: specifics in the platform

A generic reporting platform must know nothing about any particular feature; features plug in through a registered contract. Here the platform's report assembly imports the fine-grained feature's compiler directly, so feature-specific logic has moved into the shared layer.

The graph declares the rule and passes `ag validate`: declarations cannot see imports. `ag audit` fails with a `forbidden_dependency` finding from `src/platform/assemble-report.ts` to `src/features/fine-grained/compile.ts`.
