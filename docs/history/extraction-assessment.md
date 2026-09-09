# Why AG became a standalone toolkit

AG began inside Alpha Engine, where the need was broader: preserve architectural intent and develop ways to check whether implementation follows it. The standalone toolkit separates out the part another project can use immediately—remembering and retrieving the design—without taking on the original application's domain or assurance machinery.

This is a historical record of that extraction, not required reading for users.

## What was worth keeping?

The useful ideas were straightforward: distinguish what a part of the system is responsible for from where its code lives; record who decides shared meaning; give important ideas stable names; and keep authored design separate from generated summaries.

| Original idea | Choice for standalone AG |
| --- | --- |
| Responsibilities, owners, rules, and boundaries | Keep a small vocabulary for recording them |
| Checks for broken graph relationships and file references | Keep the checks without Alpha Engine's domain-specific categories |
| Authored design separate from generated views | Keep that separation, using JSON for the first release |
| Finding the design around a file or idea | Read directly from the project's graph |
| Generated briefings | Produce two small files that can be checked for staleness |
| Built-in project IDs and layout assumptions | Replace them with project-owned configuration |
| Explorer UI and application-specific behavior | Leave them out |
| Evidence execution, acceptance, and scheduling | Leave them to the separate assurance work |

The result is one Node package, one graph per configuration, a companion skill, and a small example installed like an outside project. No implementation code was copied verbatim. Compatibility with Alpha Engine's stored graph format was not promised.

JSON was chosen to avoid a parser dependency. A single graph and a small set of relationships kept the first release focused on a real adoption rather than a general graph platform. Planned work can exist without code; implemented records need real file references. Neither condition proves that the code follows the design.

## Source record

Alpha Engine was inspected without modifying it on 2026-09-09 at revision `7fcbe6b64ec6cd5bd436107a15d29818949ed4d6`. [The source record](extraction-source.json) contains file fingerprints and notes about uncommitted changes. [The retained patch](source-roadmap.patch) captures an uncommitted AG-Y roadmap update. That update helped identify assurance work to exclude; it did not supply toolkit behavior. Other ongoing AAG changes were visible but not extracted.

## Why that branch?

Several worktrees contained AG. Comparing the parts relevant to this toolkit avoided assuming that the newest assurance branch was also the best extraction source.

| Worktree branch | Revision inspected |
| --- | --- |
| AG-V | `899f40bac8cd4e8be2d0bb2be74a1e5b15b59a16` |
| AG-Y, in the main checkout directory | `7fcbe6b64ec6cd5bd436107a15d29818949ed4d6` |
| AG-AA, in the directory named ag-z | `1a17900bdfec82f4d54b3ed4fb360a8ec9ed3146` |
| AG-AB | `5a968c87f78c2cf80dbf13a696e19ad5f85f0183` |

The schema, context loader, and compiled artifacts were identical across these four. Y, AA, and AB also shared the same loader; V lacked their later explicit project-root loading and path checks. Y, AA, and AB shared the updated AG/AAG explanation, while their roadmaps reflected different assurance progress.

AG-Y therefore remained the recorded reference, checked against AA and AB. The `main` branch differed and had less of the relevant declaration work. Additional detached worktrees were inventoried but not used. [Full comparison records](worktree-comparison.json) preserve the details. This was a comparison of the reusable core, not a claim that the entire branches were equivalent.
