# Filmcraft: an early intended adoption

Filmcraft motivated an important requirement for AG: a project should be able to preserve useful architectural thinking before application code exists. Its starting material was described as requirements and high-level design documents.

This was an adoption plan, not an implemented Filmcraft graph. Those documents were not supplied during the toolkit's initial development, so no Filmcraft architecture was inferred or asserted. Other projects do not need this plan to use AG; follow [getting started](../getting-started.md) instead.

## What a first adoption should accomplish

A Filmcraft maintainer should be able to ask about one planned workflow and recover its responsibilities, shared rules, and unanswered questions without rereading every document.

Start by installing the toolkit and optional skill in Filmcraft's repository. Read the actual documents and record the few ideas that matter most. Keep the difference between an agreed design and an inference visible. Where documents disagree, record the choice still to be made instead of inventing a resolution or source file.

Review that first graph with someone who knows the project. Does it help explain what is being built and why? A passing check cannot answer that question. Once the model is useful, generate its briefing and add a short project instruction to consult it before design changes.

As code arrives, connect those existing ideas to real files and update their status. Keep stable names when files move so earlier decisions remain findable. Application tests remain separate from AG's record checks; assurance integration can wait until there is an implementation and a concrete need for it.
