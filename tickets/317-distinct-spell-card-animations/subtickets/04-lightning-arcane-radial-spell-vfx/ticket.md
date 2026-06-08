# Lightning and arcane radial spell distinct VFX

Upgrade Voltaic Chain with cast/impact primitives and give Signal Familiar, Ether Siphon, and Soul Drain bespoke arcane/lightning renderers so radial damage spells no longer share the generic accent burst.

## Acceptance Criteria

- `battle_familiar`, `mana_leach`, and `soul_drain` are registered in `CARD_RENDERERS` with bespoke renderers (not `renderGenericSpellBurst`).
- `renderChainLightningArcs` is enhanced: when `data.chainSegments` is present, add `spawnTelegraphRing` at cast origin and `spawnParticleBurst` (or `spawnImpactDecal`) at each segment endpoint; legacy no-segments path still calls `spawnChainLightningEffect` without throwing.
- `renderBattleFamiliar` uses arcane cast flair: `spawnTelegraphRing` + `spawnParticleBurst` at origin with accent tint (distinct from mana-leach styling).
- `renderManaLeach` uses purple drain theme (`0xa855f7`): telegraph ring at `data.radius` plus particle burst; optionally accent-themed `spawnSummonEffect` only if needed for readability — must differ from `renderBattleFamiliar` helper signature.
- `renderSoulDrain` uses evolved drain theme (`0xe879f9`) with heal-adjacent flourish (e.g. second smaller burst or `spawnImpactDecal`) so it is not identical to `renderManaLeach`; plays no extra sounds (heal audio remains in common post-effects if applicable).
- All new/changed renderers guard optional ctx helpers.
- Vitest tests cover all four card ids and the enhanced chain-lightning segment path.
- `pnpm test:quick` passes.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderBattleFamiliar`, `renderManaLeach`, `renderSoulDrain`.
  - Enhance `renderChainLightningArcs` and `spawnChainSegmentArcs` (~lines 195–212).
  - Register the three radial spells in `CARD_RENDERERS`.
- `game/client/test/cardRenderers.test.js`:
  - Add dispatch tests for `battle_familiar`, `mana_leach`, `soul_drain`.
  - Extend chain-lightning segment test to assert new cast/impact primitives.

Payload reference (radial fallback in `cardEffects.js`): `{ origin, radius: SUMMON_RADIUS, hits, specialEffect?, magicStonesGained?, hpHealed? }`.

## Verification: code
