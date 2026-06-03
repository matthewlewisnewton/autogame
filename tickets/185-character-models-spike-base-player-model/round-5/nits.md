## Reconcile base-mesh name across spike docs

`game/docs/MODEL_SPIKE.md` lists the chosen **Base mesh** as `Regular_Male`, but
`game/docs/SPIKE_DECISION.md`, `CREDITS.md`, the committed `player.glb`, and the
contract test (`client/test/playerModel.test.js`, which asserts mesh name
`SuperHero_Male`) all use `SuperHero_Male`. The inconsistency is confusing for a
downstream implementer deciding which mesh to re-export from. Both are CC0 from
the same Quaternius pack, so this is documentation-only.

### Acceptance Criteria
- `MODEL_SPIKE.md` and `SPIKE_DECISION.md` agree on a single committed base-mesh
  name that matches the mesh name asserted in `playerModel.test.js`.
- The triangle-budget tiers stated in both docs are consistent (or one defers to
  the other) rather than each restating slightly different target numbers.

## Pointer from ticket dir to the decision note

The beads AC for ticket 185 asks for the decision note "written to the ticket
dir", but the note lives at `game/docs/SPIKE_DECISION.md` (a more durable home).
If strict discoverability from the ticket folder matters, leave a one-line
pointer so future readers of the ticket dir can find the record.

### Acceptance Criteria
- A short pointer (e.g. in the ticket folder or decompose notes) links to
  `game/docs/SPIKE_DECISION.md` as the canonical decision record for ticket 185.
