# 02-economy-card-vfx

Add distinct VFX for draw/charge-economy utility cards (deck_sifter, chrono_trigger, mana_prism) that currently fall back to generic type defaults with no card-specific visual identity.

## Acceptance Criteria

- **deck_sifter** (draw card weapon): spawns a fan of ghost card silhouettes rising from the caster using `spawnParticleBurst()` with a parchment/gold palette, signaling a draw action
- **chrono_trigger** (adjacent charge restore): spawns a `spawnTelegraphRing()` around the caster with a temporal amber/gold palette and two `spawnParticleBurst()` bursts at adjacent hand-slot positions to visualize charge restoration
- **mana_prism** (mana pulse minion): spawns a `spawnSummonEffect()` ring plus a small crystal mesh at the placement point using `spawnParticleBurst()` with a violet/cyan palette to distinguish it from combat minions
- All three cards registered in `CARD_RENDERERS` with dedicated renderer functions
- Unit tests verify each renderer calls expected spawn functions with correct style parameters

## Technical Specs

- **`game/client/cardRenderers.js`**: Add `renderDeckSifter()`, `renderChronoTrigger()`, `renderManaPrism()` functions and register them in `CARD_RENDERERS`. Each composes existing 315 primitives (`spawnParticleBurst`, `spawnTelegraphRing`, `spawnSummonEffect`) with card-specific color palettes derived from `getAccentHex()`.
- **`game/client/test/cardRenderers.test.js`**: Add test cases for `resolveRenderers('deck_sifter')`, `resolveRenderers('chrono_trigger')`, `resolveRenderers('mana_prism')` returning non-empty arrays; and mock-context tests verifying each renderer invokes expected spawn functions.

## Verification: code
