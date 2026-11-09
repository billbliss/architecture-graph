# Drift pattern: shadow authority

Scoring rules have one authority in production. The experimentation harness keeps its own copy of the rules for trials. Here a production handler imports the harness copy, so a second authority now decides production scores.

The graph declares the single authority and passes `ag validate`. `ag audit` fails with a `forbidden_reachability` finding from the production entry point `src/server/main.ts` to `src/harness/trial-rules.ts`. The duplicated rules themselves are not a structural finding; they need the later semantic sweep.
