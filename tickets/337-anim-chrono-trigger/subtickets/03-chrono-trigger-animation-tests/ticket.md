# Chrono Trigger animation tests and regression guard

Add focused client tests that lock in Chrono Trigger's primitive dispatch, instant server-synced timing, adjacent-slot charge-restore flares keyed off the `restoredCharges` array, and visual distinctness from Mana Prism and Sacrificial Altar so future card-animation passes cannot silently regress this card. Depends on sub-tickets 01 and 02.

## Acceptance Criteria

- `cardRenderers.test.js` asserts `resolveRenderers('chrono_trigger')` returns exactly one renderer (`renderChronoTrigger`).
- Updated `chrono_trigger` render tests verify:
  - `spawnChronoTriggerEffect` is called with `(origin, radius, style)` using amber/cyan accent colors (`0xf59e0b` / `0x67e8f9` emissive).
  - All VFX fire **synchronously** at cast (not deferred via `scheduleAfter`); spy/assert `scheduleAfter` is not called for a standard cast payload.
  - When `data.restoredCharges` is `[{ slotIndex: 0, cardId: 'iron_sword', amount: 2 }, { slotIndex: 2, cardId: 'flame_blade', amount: 1 }]` with `slotIndex: 1` and `direction: { x: 1, z: 0 }`, per-slot charge-restore flares fire at the correct left/right world offsets (perpendicular to direction).
  - When `data.restoredCharges` is `[]`, only the center `spawnChronoTriggerEffect` fires (no adjacent-slot bursts/arcs).
  - When `data.origin` is absent, renderer is a no-op (no primitives called).
  - Renderer helper-call signature differs from `renderManaPrism` and `renderSacrificialAltar` for equivalent utility payloads (distinct primitive mix / palette).
  - Renderer does **not** call generic-only `spawnTelegraphRing` as the primary cast read (time-ripple primitive is the centerpiece).
- A test documents that `CARD_DEFS.chrono_trigger` has **no** positive `windUpMs` (instant cast; 307 charge telegraph correctly absent).
- Existing graceful-degradation coverage for utility spells still passes without throwing when optional primitives are absent.
- `pnpm test:quick` passes with no perf-regression patterns (no new per-frame allocations in test-covered paths).

## Technical Specs

- **`game/client/test/cardRenderers.test.js`**:
  - Extend `makeCtx` if needed so `spawnChronoTriggerEffect` is recorded (add to the default mock ctx alongside existing primitives).
  - Replace/extend the existing `chrono_trigger` tests (~L2537–2565 utility-spell block and ~L3707–3753 `describe('chrono_trigger')` block) with cases for: `spawnChronoTriggerEffect` dispatch, synchronous resolution, `restoredCharges` array per-slot flares, empty-array center-only path, origin-absent no-op, and `windUpMs` absence.
  - Import `CARD_DEFS` from `../cards.js` as needed.
  - Add distinctness assertion comparing `chrono_trigger` vs `mana_prism` vs `sacrificial_altar` renderer outputs.
- **`game/client/test/vfx-primitives.test.js`**: sub-ticket 01 owns primitive-level tests; this ticket only extends `cardRenderers.test.js` unless a gap remains after 01 lands.
- Depends on sub-tickets 01 and 02.

## Verification: code
