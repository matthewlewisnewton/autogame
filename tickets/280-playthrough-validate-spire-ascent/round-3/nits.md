## Improve Spire Validation Screenshot Framing

The Spire validation assertions and probes are solid, but a few screenshots are more cluttered than ideal for later human triage: the hub image still has a booth/forge panel open, and the boss-defeated and victory captures are effectively the same run-summary overlay. Cleaner framing would make future visual reviews easier without changing the validation logic.

### Acceptance Criteria
- The Spire validation capture closes transient hub panels before the hub screenshot, when possible.
- The boss-defeated/victory screenshots either capture distinct meaningful states or the findings file explicitly notes that immediate victory makes them equivalent.
