# Renderer consults model registry with procedural fallback

Wire the `MODEL_REGISTRY` / `loadModel` plumbing from sub-ticket 01 into the four
client mesh-creation paths (player, enemy, minion, loot). Each consults the
registry: if a model path is set AND it loads, the cloned model is used in place
of the primitive; otherwise the EXISTING procedural mesh is used. Because every
registry path is `null` this ticket, the game must render pixel-identically to
before.

## Acceptance Criteria

- `renderer.js` imports `MODEL_REGISTRY` / `loadModel` / `modelPathFor` from
  `./models.js`.
- Player avatar (`createPlayerAvatar`), `createEnemyMesh`, `createMinionMesh`,
  and loot (`createLootMesh`) each consult the registry for their entity key
  before/while building their mesh.
- When the registry path for an entity is `null`/absent, the function returns the
  current procedural mesh built exactly as today (no behavior or appearance
  change) — this is the only path exercised in this ticket.
- When a registry path IS present (future state), the code path kicks off
  `loadModel(path)` and, on success, swaps in / attaches the cloned model in
  place of the procedural primitive; the procedural mesh is still created first
  and returned synchronously so the render loop never blocks on async loading.
- Failure/absence is resilient: a rejected or `null` `loadModel` result leaves the
  procedural mesh in place and only logs a warning — it never throws, never
  removes the entity, and never stalls `animate()`.
- With NO `.glb` files present, the game starts, loads cleanly, and renders
  EXACTLY as before (all primitives); two players can join and move.
- Existing server + client unit tests still pass.

## Technical Specs

- `game/client/renderer.js` only (plus consuming `./models.js`):
  - Add `import { MODEL_REGISTRY, loadModel, modelPathFor } from './models.js';`.
  - `createPlayerAvatar(cosmetic, isSelf)` (~line 1165): key `'player'`. Build the
    procedural `group` as today; if `modelPathFor('player')` is set, call
    `loadModel(...)` and on success add/replace the model into the group, else
    leave procedural. Return the group synchronously.
  - `createEnemyMesh(type)` (~line 1577): key = `type`. Same pattern around the
    existing geometry/material build.
  - `createMinionMesh(minionType)` (~line 253): key = `minionType`.
  - `createLootMesh(item)` (~line 652): key = the loot type used for that item.
  - Factor the "build procedural, then optionally async-swap from registry"
    logic into a small shared helper if it reduces duplication, but keep each
    function returning its mesh/group synchronously.
  - Do NOT change any geometry, material, color, scale, or position values — the
    procedural branch must stay byte-identical in behavior to current code.
- No `.glb` files are added; `MODEL_REGISTRY` values stay `null`.

## Verification: code
