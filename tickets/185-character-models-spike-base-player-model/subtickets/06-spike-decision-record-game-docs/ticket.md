# Spike decision record in `game/docs`

Sub-ticket **01** failed because its deliverable path (`tickets/.../DECISION.md`) is
outside the implementer scope (`game/**` only; `tickets/**` edits are reverted by
`scope_audit`). Publish the same decision record under `game/docs/` and point
existing spike docs at that path so tickets **186–188** and the committed
`player.glb` share one canonical source comparison + final choice.

## Acceptance Criteria

- `game/docs/SPIKE_DECISION.md` exists and states: chosen source (pack name +
  URL) **or** “authored in Blender”; license (CC0 / CC-BY / project-owned); target
  triangle budget; intended export path (`game/client/public/models/player.glb`).
- The file documents anchor/scale conventions for all follow-on work: **feet at
  model y = 0**, **forward = −Z**, target **height ≈ 1.8** world units,
  horizontal footprint within **`PLAYER_RADIUS = 0.5`**
  (`game/server/simulation.js`).
- The file lists the six proportion dimensions that must become glTF morph targets
  (exact names, no aliases): `height`, `headSize`, `torsoWidth`, `armLength`,
  `legLength`, `shoulderWidth`.
- At least two candidate sources are compared (license + rough poly count each);
  the chosen path includes a one-sentence rationale aligned with the committed
  spike asset (Quaternius CC0 base, `SuperHero_Male` mesh, ≤ 18k tris per
  `game/docs/MODEL_SPIKE.md`).
- `game/docs/MODEL_SPIKE.md` “Related docs” / intro links reference
  `game/docs/SPIKE_DECISION.md` instead of `tickets/.../DECISION.md` (remove
  “when present” wording).
- `game/client/public/models/README.md` step 1 references `game/docs/SPIKE_DECISION.md`
  for alternatives considered (not a ticket-tree path).
- No changes to `player.glb`, `renderer.js`, `MODEL_REGISTRY`, or server simulation.

## Technical Specs

- **Create** `game/docs/SPIKE_DECISION.md` — decision-only markdown; synthesize from
  `game/docs/MODEL_SPIKE.md`, `game/client/public/models/CREDITS.md`, and the
  committed `player.glb` contract (sub-tickets **03–05**). Include a candidates
  table (e.g. Quaternius Universal Base Characters, KayKit/Kenney low-poly, custom
  Blender, Sketchfab one-offs) with license and approximate triangle counts.
- **Edit** `game/docs/MODEL_SPIKE.md` — replace pointers to
  `tickets/185-character-models-spike-base-player-model/DECISION.md` with
  `game/docs/SPIKE_DECISION.md` (intro + Related docs).
- **Edit** `game/client/public/models/README.md` — update the “Source” bullet to
  link `../../../docs/SPIKE_DECISION.md`.
- Do **not** write under `tickets/` (out of implementer scope). Do **not** modify
  passed sub-ticket folders **02–05** or their artifacts.

## Verification: code
