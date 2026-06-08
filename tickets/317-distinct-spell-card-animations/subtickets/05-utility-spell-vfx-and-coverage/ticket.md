# Utility spell VFX and full spell renderer coverage

Give the remaining utility/support spells bespoke cast visuals and add a registry coverage test proving no spell card still resolves to the generic burst default.

## Acceptance Criteria

- `astral_guardian`, `mana_prism`, `sacrificial_altar`, and `chrono_trigger` are registered in `CARD_RENDERERS` with bespoke renderers (not `renderGenericSpellBurst`).
- `renderAstralGuardian` composes shield/summon flair: `spawnTelegraphRing` at `data.radius` with indigo accent (`0x818cf8`) plus `spawnParticleBurst` at origin; may retain a small `spawnSummonEffect` for the minion spawn ring if distinct from generic burst styling.
- `renderManaPrism` places a pulsing prism telegraph: `spawnTelegraphRing` at `data.radius` (1) with arcane violet/cyan accent and `spawnParticleBurst` at origin.
- `renderSacrificialAltar` renders a large ritual ring at `data.radius` via `spawnTelegraphRing` plus `spawnParticleBurst` (gold/red ritual palette) at origin.
- `renderChronoTrigger` renders a time-ripple at `data.origin` using `spawnTelegraphRing` (fixed small radius when `data.radius` absent) and `spawnParticleBurst`; no-ops safely when only `origin` is present.
- New vitest case iterates every `type: 'spell'` entry in `CARD_DEFS` and asserts `resolveRenderers(cardId)` does not include `renderGenericSpellBurst` (compare by function reference or export a test-only `SPELL_TYPE_DEFAULT_RENDERER` alias).
- Existing spell renderer tests (`healing_font`, `divine_grace`, `purifying_pulse`, `telepipe`, `chain_lightning`, `ice_ball`, etc.) still pass.
- `pnpm test:quick` passes.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderAstralGuardian`, `renderManaPrism`, `renderSacrificialAltar`, `renderChronoTrigger`.
  - Register all four in `CARD_RENDERERS`.
  - Optionally export `TYPE_DEFAULT_RENDERERS.spell` (or a named alias) for the coverage test to reference.
- `game/client/test/cardRenderers.test.js`:
  - Add per-card tests for the four utility spells.
  - Add `every spell card has a bespoke renderer` coverage test importing `CARD_DEFS` from `cards.js`.

Payload reference: astral_guardian `{ origin, radius, shieldGranted, minionId }`; mana_prism `{ origin, radius: 1 }`; sacrificial_altar `{ origin, radius, sacrificedMinionId }`; chrono_trigger `{ origin, restoredCharges }` (no radius).

## Verification: code
