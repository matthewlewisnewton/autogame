# Voltaic Chain animation tests and regression guard

Add focused client tests that lock in Voltaic Chain's visual dispatch, hop timing, and primitive composition so future card-animation passes cannot silently regress this spell or Thunderbird's separate chain renderer.

## Acceptance Criteria

- `resolveRenderers('chain_lightning')` returns exactly one renderer (`renderChainLightningArcs`).
- **Multi-hop chain test** (update existing ~L3059 case): payload with two `chainSegments` and two `hits` asserts:
  - `spawnTelegraphRing` fires immediately at origin with `data.chainRadius`.
  - `spawnLightningArc` is called twice with correct `from`/`to` endpoints and `VOLTAIC_CHAIN_ARC_STYLE` (`duration: ATTACK_EFFECT_DURATION`, Voltaic accent colors).
  - Hop 0 arc + endpoint burst fire synchronously; hop 1 is deferred via `scheduleAfter` with delay `VOLTAIC_CHAIN_HOP_DELAY_MS` (80–120 ms) and `< ATTACK_EFFECT_DURATION`.
  - `runScheduled()` (or equivalent) reveals the second arc after the delay.
  - Endpoint bursts target enemy mesh positions when `enemyMeshes()` provides them.
- **Cast flourish test:** an immediate origin `spawnParticleBurst` (or equivalent cast channel) fires at t = 0 alongside the telegraph ring.
- **Legacy fallback test** (update ~L3096): payload without `chainSegments` still uses `spawnChainLightningEffect` and does not invoke `spawnLightningArc`.
- **Graceful degradation test** (~L3109): segment path with `spawnTelegraphRing` / `spawnParticleBurst` / `spawnImpactDecal` absent does not throw; `spawnLightningArc` still fires.
- **Registry isolation:** existing `thunderbird` chain-strike tests (`renderThunderbirdStrike`, `scheduleAfter` hop delays, no duplicate `enemyHit` sound) continue to pass unchanged.
- **windUpMs absence:** a test documents that merged `CARD_DEFS.chain_lightning` has no positive `windUpMs` (instant cast; 307 charge telegraph correctly absent).
- **No duplicate hit audio:** renderer path does not call `playSound('enemyHit')` — hit audio comes only from `applyHitFlashes` in `renderCardUsed`.
- `cd game && pnpm test:quick` passes (server + client vitest).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Update the existing `chain_lightning` cases (~L3059–3125) to match the sequenced-hop renderer from sub-ticket 01.
  - Use `makeCtx()` call recording with `scheduleAfter` + `runScheduled()` (existing Thunderbird pattern ~L3029–3033).
  - Provide fake `enemyMeshes` with positioned meshes for per-hop endpoint assertions.
  - Import `ATTACK_EFFECT_DURATION` from `../config.js` and `CARD_DEFS` from `../cards.js` as needed.
- **`game/client/cardRenderers.js`**: touch only if a test reveals a genuine bug in sub-ticket 01 (minimal fix).
- Do **not** weaken Thunderbird or `storm_eagle` assertions to make Voltaic Chain tests pass.

## Verification: code
