# A greeting that can change without duplicated rules

This tiny application helps illustrate one useful design decision: greeting text should be decided in one place, so a wording change does not require several parts of the application to agree independently.

## Start with a friendly greeting

A person enters a name at the command line and receives `Hello, NAME!`. Remove surrounding whitespace from the name. If no name is supplied, or it contains only whitespace, use `world`.

For the purposes of this example, keep accepting input, providing the greeting, and formatting its text separate. The formatter decides the words; the interface prints the result without rebuilding it. The extra structure makes the AG relationships easy to see—it is not necessary for a real Hello World.

The initial version needs no network, saved data, or translation. Leave this question open: should someone be able to choose a different greeting tone?

## Then add a formal tone

Support an explicit `formal` tone that returns `Good day, NAME.`. Keep `friendly` as the default, and reject unsupported tones rather than silently choosing one.

The formatter should still decide the text. Whether to support other languages remains an open question and is outside this implementation.
