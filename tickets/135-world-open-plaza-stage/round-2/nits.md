## Add Open Plaza Capture Coverage

Round 2 used the fallback `sloped-dungeon` capture, so the automated screenshot set proves runtime health but does not directly exercise the new `open-plaza-arena` shortcut or `arena_trials` quest visually. A feature-specific capture would make future regressions easier to catch without reading the tests.

### Acceptance Criteria
- The capture plan includes an `open-plaza-arena` or normal `arena_trials` scenario screenshot showing the plaza, cover pieces, and sloped platforms.
