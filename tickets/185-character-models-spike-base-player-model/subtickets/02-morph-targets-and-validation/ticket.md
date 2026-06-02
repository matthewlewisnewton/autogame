# Asset: morph targets on player.glb plus validation test

Extend the committed base humanoid with Blender shape keys (or an equivalent export)
as glTF morph targets for every proportion dimension, and add an automated check so
tickets 186–188 can rely on stable morph names matching server `proportions.<key>`.

## Acceptance Criteria

- `game/client/public/models/player.glb` includes morph targets on the player **body**
  primitive for **every** proportion key in `README.md`:
  `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`.
- Each morph target name in the `.glb` **exactly matches** the README table
  (case-sensitive, 1:1 with future server field `proportions.<key>`).
- Neutral pose corresponds to morph influence **0** for all targets (rest shape is the
  default avatar at influence 0).
- `game/client/public/models/README.md` finalizes the proportion → morph-target table,
  Blender authoring constraints (symmetry, feet anchor, visor excluded), and glTF
  export notes (`extras.targetNames`, Y-up).
- `game/client/test/playerModel.test.js` loads/parses `player.glb` and asserts all
  six morph target names are present (runs under `pnpm test:quick`).
- Optional maintainer script `game/client/scripts/inject-player-morph-targets.mjs` is
  allowed if Blender re-export is impractical; re-run must be idempotent and documented
  in README.
- No renderer wiring or in-game visual change in this sub-ticket.

## Technical Specs

- `game/client/public/models/player.glb` — re-export or programmatically extend with
  six separate shape keys (not one global scale). Apply deltas on **`PlayerBody`**
  (or equivalent body primitive) only; leave visor/accent primitive without morphs.
- `game/client/public/models/README.md` — complete **Proportion morph targets** section
  with keys, glTF names, default 0, clamp range −1…1, and authoring rules (feet stay
  on ground for `height`, symmetric X for width/arms/shoulders).
- `game/client/test/playerModel.test.js` — NEW vitest: read committed GLB (prefer
  zero new deps — parse JSON chunk from GLB buffer) and assert `targetNames` / mesh
  `targets` count matches the six keys.
- `game/client/scripts/inject-player-morph-targets.mjs` — optional one-shot maintainer
  script (document run command in README comment header).

Morph authoring: each shape key should visibly adjust its body region at ±1 without
breaking the feet anchor (scale height about sole Y, not per-toe shear).

## Verification: code
