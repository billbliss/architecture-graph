# Drift pattern: blended result

Creating a report must use one computation. Here the shared totals step quietly falls back to an alternate computation for one variant, so a single report blends results from two computations.

The graph declares the single path and passes `ag validate`. `ag audit` fails with a `forbidden_reachability` finding from the report route `src/routes/create-report.ts` to `src/alternates/estimated-totals.ts`, with the import path as evidence.
