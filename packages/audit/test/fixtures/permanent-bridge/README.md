# Drift pattern: permanent bridge

The export route is moving from the legacy exporter to a new one. During the migration, a bridge adapter still sends some exports through the legacy exporter. Bridges like this tend to become permanent.

The graph declares that the route must not reach the legacy exporter, and passes `ag validate`. The known path is accepted in the baseline with the reason it remains and what removes it, so `ag audit` passes with one baselined finding and fails if the baseline entry is missing. After the cutover removes the bridge, the entry is resolved: `ag audit` fails until `ag audit baseline prune` removes it, so the bridge cannot quietly return as baselined.
