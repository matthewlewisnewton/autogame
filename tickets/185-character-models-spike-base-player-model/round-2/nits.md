## Align committed base-mesh wording in MODEL_SPIKE.md

`game/docs/MODEL_SPIKE.md` line 15 still lists the base mesh as `Regular_Male`, while the
committed asset, `SPIKE_DECISION.md`, and `CREDITS.md` identify `SuperHero_Male` (the doc even
explains on line 102 that `Regular_Male` is a paid-tier variant that was not used). The stale
table row could mislead tickets 186–188.

### Acceptance Criteria
- `game/docs/MODEL_SPIKE.md` names the same committed base mesh (`SuperHero_Male`) as
  `game/docs/SPIKE_DECISION.md` and `game/client/public/models/CREDITS.md`.

## Mirror the spike decision note into the ticket directory

The beads acceptance criteria for `autogame-0yf` ask for the decision note "written to the
ticket dir". The full decision content exists and is well-placed at
`game/docs/SPIKE_DECISION.md` (the durable home referenced by downstream tickets), so this is
not blocking — but adding a short pointer/copy under the ticket directory would satisfy the
literal AC wording and aid future audits.

### Acceptance Criteria
- A decision note (or a pointer to `game/docs/SPIKE_DECISION.md`) exists under
  `tickets/185-character-models-spike-base-player-model/`.

## Assert player footprint in the contract test

`client/test/playerModel.test.js` checks height, feet-y, morph names, and triangle count, but
does not assert the `PLAYER_RADIUS = 0.5` foot footprint that `SPIKE_DECISION.md` documents as
a hard convention. Adding it would make that contract harder to regress in tickets 186–188.

### Acceptance Criteria
- `client/test/playerModel.test.js` fails if vertices near the feet exceed the documented
  `PLAYER_RADIUS = 0.5` footprint.
