# How working software drifts from its architecture

This document records the drift patterns that motivated AG's planned Architecture Audit. Each one was observed in a real project, not imagined. They are written up here so the problems have names, so the features that address them have a stated reason to exist, and so the limits of those features are clear.

## Where these patterns come from

The source is a large private application, developed over many months mostly by AI coding agents working from written specifications. The project had an architecture graph that declared owners, authorities and rules. It had thousands of passing tests. Its agents retrieved architectural context before making changes.

The architecture drifted anyway. Nothing failed: the software compiled, the tests passed, and every part looked reasonable on its own. The drift became visible only when a feature needed two related parts of the system to agree and they turned out to be separate implementations of the same responsibility.

The examples below describe that project in general terms. Its domain and internal names do not matter; the patterns recur in any system large enough that no single person or agent holds all of it in mind.

## The underlying failure: locally compliant, globally inconsistent

Every pattern below is a case of one failure. A change can be correct within its own scope, follow the declared design for the part it touches, and pass every test, while the system as a whole stops having a single answer to a question it is supposed to answer once.

Tests and declarations do not catch this because they ask the wrong question. A test shows that a correct path exists. A declaration says which path is intended. Neither shows that the intended path is the only one, or that every supported entry point reaches it. "A compliant path exists" is a much weaker statement than "this is the only path, and everything uses it."

Coding agents make the failure more frequent. An agent works toward an observable completion condition: the feature works and the tests pass. The shortest route there is often a wrapper, a copied piece of orchestration, a fallback or a new registry, all of which satisfy the immediate goal while adding a second way to do something the system should do once. The agent can truthfully report that its path works. Nothing asks it whether it has created a second one.

## The patterns

### Blended result

**What it is.** One output assembled from several independent computations of the same thing, with no single computation responsible for the answer.

**What happened.** A report that users saw as one coherent result was produced by four separate passes over the same data: a diagnostic run, a stateful simulation, a projection derived from the diagnostic run, and a replay of recorded events. Each pass was tested and looked correct. The final report took some figures from each. When the passes disagreed, nothing noticed, because no part of the system owned the complete answer.

**Why it was missed.** The graph declared which component was meant to own the result, but nothing compared that declaration with what the report's entry point actually reached. Each pass had tests; the combination did not.

### Shadow authority

**What it is.** An older, experimental or secondary path that keeps its own private copy of rules the system is supposed to define in one place.

**What happened.** The application had a coarse and a fine-grained variant of its central calculation. The fine-grained variant was not built on the main implementation. It lived inside an experimentation harness, with its own setup, its own selection rules, its own timing loop and its own output assembly. It also searched the whole data window for events, which allowed it to see data from the future: a correctness bug as well as an architectural one. The two variants were presented as two views of one calculation. In fact they were two calculations that happened to share some inputs.

**Why it was missed.** The harness predated the architecture graph's rules and was never treated as part of production, but production code had come to depend on it. The duplicated rules had different names and structure from the originals, so nothing that matched code by name or shape would have found them.

### Specifics in the platform

**What it is.** Logic specific to one feature, pushed down into a shared or generic layer so that two paths can be made to look unified.

**What happened.** The first attempt to merge the two variants above added feature-specific compilation and variant-selection logic to the generic reporting platform, a layer that was meant to know nothing about any particular feature. The attempt would have passed its tests. It was rolled back after review recognized that the generic layer had become a new place where the feature's meaning was decided.

**Why it was missed by automation.** The graph declared the generic layer and the feature as separate parts, with the dependency pointing one way. Nothing checked the code's actual imports against that declared direction.

### Copy-forward

**What it is.** Supporting code duplicated into a new path instead of shared with the old one.

**What happened.** The same attempt copied existing data-acquisition and chart-building code into the new path. Each copy worked. The project now had two places to fix every future data or charting bug, and two chances for them to diverge.

### Open registry

**What it is.** A registry whose membership is decided at runtime by whatever code registers into it, rather than fixed where the registry is defined.

**What happened.** A registry of execution capabilities accepted registrations through a public function. Any module could add an entry, so the set of capabilities depended on which modules happened to load and in what order. The fix replaced registration with a fixed, frozen list defined alongside the registry, and removed the registration module.

**Why it matters.** An open registry is how a second implementation slips in without anyone editing the original: it registers itself. The original code is unchanged, so a review of the original finds nothing.

### Decorative identity

**What it is.** Identifiers, digests or evidence records that describe what happened but are not used to decide anything.

**What happened.** The rolled-back unification attempt recorded identities for its inputs and results. They looked like integrity checks, but no code path rejected anything when they did not match. They gave the appearance of verification without its substance.

**Why it matters.** This pattern cannot be detected structurally: the identities exist, are well formed and are stored correctly. It needs review, or a test that changes an input and expects a rejection.

### Permanent bridge

**What it is.** A migration that adds wrappers, adapters or compatibility routes so the new path can work, while the old path stays reachable.

**What happened.** Once a new execution path existed, an assessment of the cutover found that switching to it directly would have required new wrappers and bridges. The generic seams the new path needed did not exist yet, and the fine-grained assembly was still embedded in the experimentation harness. Proceeding would have left both routes live, joined by bridges, with no point at which the old one was removed.

**Why it matters.** "The new path works" is not the end of a migration. A migration ends when the old path is gone, and that is a statement about absence, which tests do not make.

## What did not work: proving everything

The project's first response was to make the architecture graph executable with proofs. Each architectural claim was checked against an exhaustive enumeration of a bounded part of the codebase. Results were bound to content hashes of everything they depended on, including the absence of files, so adding a new file in scope invalidated them. Adversarial tests confirmed that deliberately deceptive implementations were rejected for the right reason. Gates stopped further work until every claim passed.

The ideas were sound and it worked for what it checked. It also consumed months with no product features delivered. Several problems compounded:

- **Zero tolerance blocked adoption.** Existing drift had to be fully eliminated before work could continue, so discovering a problem halted everything until it was fixed.
- **The proof system had to prove itself.** Each improvement to the checking machinery needed its own specification, adversarial tests and self-checks, and each gap found in the machinery became more machinery.
- **It defended against the wrong adversary.** Much of the cost went into resisting forged evidence: results edited and their hashes recomputed. The real adversary was a goal-seeking agent taking a shortcut, not someone forging proof records.
- **Full validation took hours.** A single late fix restarted a multi-hour acceptance run.

Three ideas from that effort are worth keeping:

- **Negative space.** A claim such as "there is exactly one registry" must be re-checked when any file in its scope is added, not only when the original registry changes.
- **Independent expectations.** The code being checked must not define what it is checked against.
- **Fail on incomplete discovery.** If a check cannot see part of its scope, for example because of dynamic imports, the result is "unknown," never "pass."

## How AG responds

Architecture Audit is planned and not yet implemented; its specification will cite this document. Its design follows from the patterns and from the failed first attempt:

| Pattern | Response | How cheap |
| --- | --- | --- |
| Specifics in the platform | Check code imports against the module dependencies the graph declares | Seconds, on every pull request |
| Blended result, Shadow authority, Permanent bridge | Forbidden reachability: from declared entry points, these modules must not be reachable | Seconds, on every pull request |
| Open registry | Single authority: exactly one module plays this role, and it exposes no registration function | Seconds, on every pull request |
| Copy-forward | Clone detection within declared scopes | Fast enough for pull requests |
| Shadow authority (duplicated rules under different names) | An asynchronous sweep for semantic duplication, reported as advisory findings | Asynchronous; noisy by nature |
| Decorative identity | Not detectable structurally; review and tests | — |

Two features make these checks adoptable on a codebase that already has drift:

- **A baseline that can only shrink.** Existing violations are recorded, each with a stable identity and a reason. A check fails only on violations that are not in the baseline, and entries are removed as they are fixed. New divergence is blocked immediately; old divergence is tracked and paid down without halting other work.
- **Prevention before detection.** A guardrail in the graph can say how it is checked. `ag context` then shows the rule, and the check behind it, to an agent planning a change, before any code is written.

## What no check replaces

Some of the problems above were design gaps: the seams a migration needed did not exist yet. No check creates a design. Some were behavioral, such as reading data from the future, and belong in tests. Some, like decorative identity, need a reviewer who asks what a value is actually used for.

The claim AG aims for is narrow: new structural divergence fails the pull request, and existing divergence is visible and tracked. It does not claim the architecture is proven correct.
