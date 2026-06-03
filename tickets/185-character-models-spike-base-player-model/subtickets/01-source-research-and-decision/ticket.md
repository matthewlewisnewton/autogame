# Source research and model decision note

Research permissively licensed low-poly rigged humanoid bases (CC0 preferred:
Quaternius Universal Base Characters, Kenney, Sketchfab CC0/CC-BY filters, etc.)
and decide whether to **source** a pack model or **author** a custom Blender base.
Record the outcome in a short decision note under this ticket directory so later
sub-tickets and tickets 186–188 share one canonical choice.

## Acceptance Criteria

- `tickets/185-character-models-spike-base-player-model/DECISION.md` exists and
  states: chosen source (pack name + URL) **or** “authored in Blender”; license
  (CC0 / CC-BY / project-owned); target triangle budget; intended export path
  (`game/client/public/models/player.glb`).
- The note documents anchor/scale conventions to be used by all follow-on work:
  **feet at model y = 0**, **forward = −Z**, target **height ≈ 1.8** world units,
  horizontal footprint within **`PLAYER_RADIUS = 0.5`** (`game/server/simulation.js`).
- The note lists the six proportion dimensions that must become glTF morph targets
  (exact names, no aliases): `height`, `headSize`, `torsoWidth`, `armLength`,
  `legLength`, `shoulderWidth`.
- At least two candidate sources were considered (with license + rough poly count);
  the chosen path includes a one-sentence rationale.

## Technical Specs

- **Create** `tickets/185-character-models-spike-base-player-model/DECISION.md`
  only — no game code or binary assets in this sub-ticket.
- Use web search / vendor pages to verify redistribution terms before recommending
  a pack; do not commit ripped or commercial-game assets.
- Align recommendations with downstream tickets 186–188 (server `proportions{}`,
  client morph mapping, customization sliders) so the six keys above are the
  contract vocabulary.

## Verification: code
