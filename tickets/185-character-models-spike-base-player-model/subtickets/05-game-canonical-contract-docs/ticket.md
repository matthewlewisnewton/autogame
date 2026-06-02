# 05 — Game canonical contract docs (scope-fixed)

Publish and commit the canonical model contract downstream tickets (186–188,
190) reference. All deliverables live under `game/` because implementer scope
is `game/**` only (`tickets/**` is denied by `scope_audit`).

## Acceptance Criteria

- `game/docs/MODEL_SPIKE.md` is committed and includes:
  - Source vs authored decision, license, poly budget, and export tool versions.
  - Anchor/scale conventions (feet `y = 0`, forward −Z, height 1.8, footprint
    ≤ `PLAYER_RADIUS` 0.5) with how they were measured on the committed asset.
  - The six proportion keys and recommended morph influence ranges for server
    clamping in ticket 186.
  - Pointers to `game/client/public/models/player.glb` and `CREDITS.md`.
- `game/client/public/models/README.md` is committed and states the **verbatim**
  contract future code must follow:
  - Proportion keys: `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`,
    `shoulderWidth` (1:1 across server `proportions{}`, glTF morph names, slider
    ids).
  - Model path: `player.glb`; `modelId` default `"player"`.
  - Orientation/scale rules matching `MODEL_SPIKE.md`.
- `game/tickets/185-character-models-spike-base-player-model/spike-decision.md` is
  committed, **not draft**: ≤1 screen; summarizes source choice, license, poly
  budget, and anchor conventions; links to `game/docs/MODEL_SPIKE.md` and
  `game/client/public/models/README.md`.
- No doc links to `tickets/185-character-models-spike-base-player-model/spike-decision.md`
  at repo root (that path is out of implementer scope and must not appear in ACs
  or cross-links).
- `game/client/public/models/CREDITS.md` `player.glb` row matches the finalized
  spike (consistent license URL and status).
- `game/client/test/playerModel.glb.test.js` still passes (six morph names,
  height ~1.8, footprint ≤ 0.5).
- No renderer or gameplay behavior changes in this sub-ticket.

## Technical Specs

- **Commit/finalize:** `game/docs/MODEL_SPIKE.md`, `game/client/public/models/README.md`
- **Finalize:** `game/tickets/185-character-models-spike-base-player-model/spike-decision.md`
- **Verify/update:** `game/client/public/models/CREDITS.md` (policy cross-links only if needed)
- **Do not create or modify** anything under repo-root `tickets/185-character-models-spike-base-player-model/` except this sub-ticket’s own `subtickets/05-*/` folder.
- Align wording with beads canonical contract on tickets 186/187/188 (same six
  keys and conventions). Use existing content from passed sub-tickets 02–03
  where possible; do not re-export `player.glb`.

## Verification: code
