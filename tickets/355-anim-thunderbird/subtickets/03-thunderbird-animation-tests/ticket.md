# Thunderbird animation test coverage + regression guard

Lock in the Thunderbird summon and chain-strike polish from sub-tickets 01–02 with focused `cardRenderers.test.js` coverage and a quick-suite green run. Ensure Voltaic Chain and Stormwing Drone renderers are unchanged.

## Acceptance Criteria

- `resolveRenderers('thunderbird')` returns exactly **two** renderer functions; the second is `renderThunderbirdStrike` (not the shared `renderChainLightning`).
- **Summon test** (extends sub-ticket 01): `renderCardUsed` with `{ cardId: 'thunderbird', minionId, origin, hits: [] }` asserts `spawnMinionSummonInEffect` with Thunderbird palette and at least one supplementary storm-cue primitive call; `spawnLightningArc` / chain primitives are **not** invoked.
- **Single-target strike test**: payload with one hit and no `chainSegments` asserts `spawnChainLightningEffect` (or arc fallback) fires from minion origin, endpoint burst at the struck enemy mesh when `enemyMeshes` is provided, **no** `playSound('enemyHit')` from the renderer itself (only from `applyHitFlashes` post-pass), and exactly one origin flare primitive.
- **Multi-hop chain test**: payload with two `chainSegments` and two `hits` asserts `spawnLightningArc` is called twice with correct `from`/`to` endpoints, endpoint `spawnParticleBurst` (or `spawnImpactDecal`) per hop, and `scheduleAfter` is used for hop index ≥ 1 with delay `< ATTACK_EFFECT_DURATION`.
- **Registry isolation**: existing `chain_lightning` spell tests (`renderChainLightningArcs`, telegraph ring) and `storm_eagle` summon/strike tests continue to pass unchanged.
- **Graceful degradation**: a thunderbird strike payload with `spawnLightningArc: undefined` does not throw (guarded path).
- `cd game && pnpm test:quick` passes (server + client vitest).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Update/replace the existing thunderbird cases (~L2571–2619): align with `renderThunderbirdStrike` API, fix the `enemyHit` sound count expectation (renderer no longer doubles the sound), add `scheduleAfter` recording via `makeCtx` if not already present.
  - Add an explicit `resolveRenderers('thunderbird')` identity check for `renderThunderbirdStrike`.
  - Use `makeCtx()` call recording; provide fake `enemyMeshes` with positioned meshes for per-hit burst assertions.
- **`game/client/cardRenderers.js`**: touch only if a test reveals a genuine bug in sub-tickets 01–02 (minimal fix).
- Do **not** weaken assertions on `chain_lightning` or `storm_eagle` cases to make thunderbird tests pass.

## Verification: code
