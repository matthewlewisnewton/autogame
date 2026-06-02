# Asset: morph targets on player.glb plus validation test

Extend the committed base humanoid with Blender shape keys exported as glTF morph
targets for every proportion dimension defined in `public/models/README.md`, and
add an automated check so later tickets can rely on the morph names being stable.

## Acceptance Criteria

- `game/client/public/models/player.glb` includes morph targets on the player body
  mesh for **every** proportion key listed in `README.md`:
  `height`, `headSize`, `torsoWidth`, `armLength`, `legLength`, `shoulderWidth`.
- Each morph target name in the `.glb` **exactly matches** the name in
  `game/client/public/models/README.md` (case-sensitive).
- Neutral pose corresponds to morph influence **0** for all targets (rest shape is
  the default avatar).
- `game/client/public/models/README.md` confirms the final morph-target list and
  notes any Blender shape-key authoring constraints (symmetry, axis limits).
- `game/client/test/playerModel.test.js` (or similar) loads/parses `player.glb`
  and asserts all expected morph target names are present (test runs under
  `pnpm test:quick`).
- No renderer wiring or in-game visual change in this sub-ticket.

## Technical Specs

- `game/client/public/models/player.glb` — re-export from Blender (or equivalent)
  with shape keys bound to the proportion morph names. Keep total morph count at
  six; use separate shape keys per dimension rather than a single catch-all scale.
- `game/client/public/models/README.md` — finalize the proportion → morph-target
  table and document export settings (glTF shape keys, apply modifiers off, Y-up).
- `game/client/test/playerModel.test.js` — NEW vitest that reads the committed
  GLB JSON chunk (Node `fs` + minimal parser or `@gltf-transform/core` if already
  available; prefer zero new deps — parsing the GLB JSON header is sufficient) and
  checks `targetNames` / mesh `targets` length against the README schema.

Morph authoring guidance: each shape key should visibly adjust its body region at
influence ±1 without breaking the feet anchor (translate the root, not individual
toe vertices, when scaling height).

## Verification: code
