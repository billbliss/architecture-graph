# Greeting requirements

Initial release: a command-line interface accepts a name and prints `Hello, NAME!`.
An absent or whitespace-only name becomes `world`. Trim surrounding whitespace.
Keep the interface, greeting capability, and formatting responsibility separate.
The formatter owns greeting text; the interface must not independently reconstruct it.
No network, persistence, or localization in the initial release.

Open design question: should greetings eventually support multiple tones?

Subsequent change: add an explicit `formal` tone producing `Good day, NAME.`;
keep `friendly` as the default. Reject unsupported tones. The formatter remains
the sole declared text authority. Localization remains unresolved and out of scope.
