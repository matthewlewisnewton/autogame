# Canonical model contract documentation

Turn the spike decision into durable project docs so server fields, glTF morph
targets, and UI slider ids stay aligned 1:1 across tickets 186–188. This
sub-ticket does not add or change `player.glb` — it only documents the contract.

## Acceptance Criteria

- `game/docs/MODEL_SPIKE.md` exists and summarizes: chosen base asset (per
  `DECISION.md`), license, poly budget, feet-at-y=0 / −Z forward / ~1.8 height /
  `PLAYER_RADIUS` footprint rules, and the six proportion keys with server clamp
  range **0.75–1.25** (default **1.0** each).
- `game/client/public/models/README.md` exists and explains how to replace
  `player.glb`, how morph-target names must match proportion keys exactly, and a
  short Blender export checklist (apply transforms, −Z forward, feet on ground).
- Both docs state that downstream code maps `proportions[key]` to the glTF morph
  target of the **same name** (no renaming layer).
- `game/client/public/models/CREDITS.md` player row is updated from “parked” to
  reflect the chosen source/license (file may still be absent until sub-ticket 03).

## Technical Specs

- **Create** `game/docs/MODEL_SPIKE.md` — spike summary + canonical naming/ranges.
- **Create** `game/client/public/models/README.md` — artist/engineer replacement guide.
- **Edit** `game/client/public/models/CREDITS.md` — update the `player.glb` row
  (source, license, URL, status) per `DECISION.md`; do not commit `player.glb` here.
- Do **not** set `MODEL_REGISTRY.player` or change `renderer.js` (ticket 187 wires
  the model into gameplay).

## Verification: code
