# Client Chain Lightning arc rendering

Render visible lightning arcs along the server-provided `chainSegments` when the `chain_lightning` spell is cast. Depends on sub-ticket 02 emitting segment endpoints on `CARD_USED`.

## Acceptance Criteria

- When `chain_lightning` is played, the client draws a brief cyan lightning arc along **each** segment in `data.chainSegments` (caster → primary enemy → optional chain targets), not merely a single directional projectile sphere.
- Arcs are positioned at a sensible Y height above the floor (consistent with other attack effects, ~1.0–1.5) and fade out within the standard attack-effect duration.
- `game/client/cardRenderers.js` registers `chain_lightning` with a dedicated renderer (may refactor/extend the existing `renderChainLightning` used by `thunderbird` so both share arc drawing when `chainSegments` is present).
- Enemy hit sparks / hit sound still fire via the common `renderCardUsed` post-effects when `hits` is non-empty.
- `game/client/test/cardRenderers.test.js` includes a test that a `chain_lightning` payload with two `chainSegments` invokes the arc spawn helper twice (mock ctx).
- Existing `thunderbird` chain-lightning renderer test continues to pass (no regression).

## Technical Specs

- **`game/client/renderer.js`**:
  - Add `spawnLightningArc(from, to, style?)` (or extend `spawnChainLightningEffect`) that creates a short-lived `THREE.Line` or tube geometry between two `{x,z}` points with emissive cyan material; animate opacity fade in `updateAttackEffects`.
  - Accept optional style overrides (color/emissive) for reuse by thunderbird.
- **`game/client/main.js`**: expose the new helper on the `renderCardUsed` ctx bundle (same pattern as `spawnChainLightningEffect`).
- **`game/client/cardRenderers.js`**:
  - Implement `renderChainLightningArcs(data, ctx)` iterating `data.chainSegments` and calling the arc helper; fall back to legacy single-bolt behavior when segments are absent.
  - Register `chain_lightning: renderChainLightningArcs` in `CARD_RENDERERS`.
  - Optionally update `thunderbird: renderChainLightning` to call the shared arc helper when `data.chainSegments` is present on minion attacks (only if server/minion path can supply segments — otherwise leave thunderbird on legacy visuals).
- **`game/client/test/cardRenderers.test.js`**: add chain_lightning arc test with mocked `spawnLightningArc` / `spawnChainLightningEffect`.
- Do **not** change server combat logic in this sub-ticket.

## Verification: code
