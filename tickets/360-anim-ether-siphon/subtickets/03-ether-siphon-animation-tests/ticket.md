# Ether Siphon animation tests and regression guard

Add focused client tests that lock in Ether Siphon's primitive dispatch, instant server-synced timing, per-hit drain arcs, magic-stone absorption flourish, and visual distinctness from Signal Familiar and Soul Drain so future card-animation passes cannot silently regress this card. Depends on sub-tickets 01 and 02.

## Acceptance Criteria

- `cardRenderers.test.js` asserts `resolveRenderers('mana_leach')` returns exactly one renderer (`renderManaLeach`).
- Updated `mana_leach` render tests verify:
  - `spawnEtherSiphonEffect` is called with `(origin, radius, style)` using violet accent colors (`0xa855f7` / `0x9333ea` emissive).
  - `spawnTelegraphRing` and `spawnParticleBurst` fire **synchronously** at cast (not deferred via `scheduleAfter`).
  - When `data.hits` contains enemy ids present in a stub `enemyMeshes()` map, per-hit drain arcs fire immediately (`spawnLightningArc` from enemy position to origin) plus hit sparks/bursts at enemy positions.
  - When `data.magicStonesGained > 0`, an additional absorption flourish (`spawnParticleBurst` and/or `spawnImpactDecal`) fires at the caster origin.
  - Renderer helper-call signature differs from `renderBattleFamiliar` and `renderSoulDrain` for the same `{ origin, radius, hits: [] }` payload (distinct palette/count/spread/primitive mix).
  - Renderer still does **not** call `spawnSummonEffect` (no generic accent summon ring).
- A test documents that `CARD_DEFS.mana_leach` has **no** positive `windUpMs` (instant cast; 315 charge telegraph correctly absent).
- Existing graceful-degradation test for arcane radial spells (`battle_familiar`, `mana_leach`, `soul_drain` with optional primitives absent) still passes without throwing.
- `pnpm test:quick` passes with no perf-regression patterns (no new per-frame allocations in test-covered paths).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Extend `makeCtx` if needed so `spawnEtherSiphonEffect` is recorded (add to the default mock ctx alongside existing primitives).
  - Replace/extend the existing `mana_leach` test (~L1097–1115) with cases for: `spawnEtherSiphonEffect` dispatch, synchronous cast primitives, per-hit `spawnLightningArc` drain tendrils (stub `enemyMeshes` returning `{ enemyId: { position: { x, y, z } } }`), MS-gain absorption flourish, and `windUpMs` absence.
  - Add a distinctness assertion comparing `mana_leach` vs `battle_familiar` vs `soul_drain` renderer outputs for equivalent payloads.
  - Import `CARD_DEFS` from `../cards.js` as needed.
- **`game/client/test/vfx-primitives.test.js`**: sub-ticket 01 owns primitive-level tests; this ticket only extends `cardRenderers.test.js` unless a gap remains after 01 lands.
- Depends on sub-tickets 01 and 02.

## Verification: code
