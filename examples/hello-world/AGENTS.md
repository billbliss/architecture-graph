# Preserve the purpose of this example

This example shows how a recorded design helps with a later change. Its key decision is that the formatter chooses the greeting text and the interface prints it.

Before changing that responsibility or the formatting rules, run `npm run ag -- context --file src/formatter.js` (or use the affected file) and read the returned design. Update `architecture/graph.yaml` alongside the implementation when the design changes.

Run `npm test`, then `npm run ag -- validate`, `npm run ag -- generate`, and `npm run ag -- check`. Edit the graph to change the design; regenerate the briefing rather than editing it directly. A passing AG check says the records are consistent, not that the program behaves correctly.
