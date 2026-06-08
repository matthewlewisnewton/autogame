# Stormwing Drone / Thunderbird lightning attack and summon VFX

`storm_eagle` and `thunderbird` currently deal damage in `simulation.js` without emitting `_pendingMinionBreaths` `cardUsed` payloads, so attack visuals rely on the renderer HP-drop fallback — which covers `thunderbird` but not `storm_eagle` (falls through to generic `spawnHitSpark`). Wire proper lightning attack events and distinct summon/attack renderers using 315 primitives (`spawnLightningArc`, `spawnChainLightningEffect`, `spawnParticleBurst`).

## Acceptance Criteria

- `game/server/simulation.js`: when `storm_eagle` or `thunderbird` lands a ranged hit, push a `_pendingMinionBreaths` entry mirroring other minion attacks (`playerId`, `cardId`, `minionId`, `origin`, `direction`, `hits`). `thunderbird` entries include `specialEffect: 'chain_lightning'` and a `chainSegments` array (minion → first target → chained targets) so the client can draw arcs.
- `game/client/cardRenderers.js`: register `storm_eagle` renderer (single-target `spawnLightningArc` from minion origin to primary hit enemy position, plus accent `spawnParticleBurst` at impact); enhance `thunderbird` / `renderChainLightning` to prefer `chainSegments` arcs (already partially implemented for the spell) and add a sky-blue summon flourish distinct from `storm_eagle`.
- `game/client/renderer.js` HP-drop fallback adds a `storm_eagle` branch (cyan bolt via `spawnLightningArc` or `spawnChainLightningEffect`) so attacks still read if a `cardUsed` event is missed; keep existing `thunderbird` fallback behavior.
- Server test in `game/server/test/new_card_pack.test.js` (or a focused minion VFX test) asserts `_pendingMinionBreaths` length/content after an eagle/thunderbird tick in range.
- Client tests in `game/client/test/cardRenderers.test.js` cover `storm_eagle` attack and summon renderers and `thunderbird` multi-arc chain payload.
- Attack interval gating from ticket 315 remains intact (no extra hits per tick).

## Technical Specs

- `game/server/simulation.js`: in the `storm_eagle` / `thunderbird` block (~line 2885), after `damageEnemy`, build direction toward the target, collect hit records, and `push` to `_gameState._pendingMinionBreaths`; for thunderbird chains, append segment endpoints for each chained enemy.
- `game/client/cardRenderers.js`: add `renderStormEagleStrike` and `renderStormEagleSummon` (or combined), register `storm_eagle`; extend `renderChainLightning` / `thunderbird` registry for chain segment arcs + summon styling.
- `game/client/renderer.js`: extend minion-damage fallback (~line 5649) with `fromStormEagle` lightning branch.
- `game/server/test/new_card_pack.test.js`: assert pending breath queue payloads for eagle/thunderbird attacks.
- `game/client/test/cardRenderers.test.js`: new cases with `makeCtx` call recording.

## Verification: code
