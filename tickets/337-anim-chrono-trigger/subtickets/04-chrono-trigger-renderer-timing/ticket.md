# Chrono Trigger — renderer polish and server timing sync

Upgrade `renderChronoTrigger` to compose the time-ripple primitive from sub-ticket 01 with 315 VFX helpers so the cast reads unmistakably as a temporal charge reset whose adjacent-slot restores sync to the server's instant `restoreHandCharges` resolution. Chrono Trigger has **no** `windUpMs` (instant spell cast). Sub-ticket 03 already added regression tests — this ticket must land renderer behavior that keeps `pnpm test:quick` green (`local-checks` `rc: 0`).

## Acceptance Criteria

- `renderChronoTrigger` calls `ctx.spawnChronoTriggerEffect(origin, radius, { color, emissive })` using `getAccentHex('chrono_trigger')` (`0xf59e0b`) with emissive fallback `0x67e8f9`.
- **Instant cast (t = 0):** On `CARD_USED` receipt, synchronously spawns the time-ripple primitive at the caster origin — matching the server's immediate charge-restore resolution (no projectile travel, no `scheduleAfter` delay). Timing matches `cardEffects.js` `chrono_trigger` branch where `restoreHandCharges` resolves in the same tick.
- **Adjacent-slot charge restore sync:** For each entry in `data.restoredCharges` (array of `{ slotIndex, cardId, amount }` from the server), spawn an immediate charge-restore flourish at the corresponding adjacent world position offset from the caster along the perpendicular to `directionOf(data)` (left slot = negative offset, right slot = positive offset, `CHRONO_TRIGGER_SLOT_SPACING` = 1.2). Use `ctx.spawnParticleBurst` and/or `ctx.spawnLightningArc(origin, slotPos, …)` so energy visibly flows from the caster to each restored hand slot.
- When `data.restoredCharges` is an empty array, only the center time-ripple primitive fires (no adjacent flares).
- When `data.origin` is absent, the renderer is a **no-op** (no VFX, no throw).
- Single code path only — no legacy dual-branch split (`restoredCharges !== undefined` vs not).
- `getCardDef('chrono_trigger').windUpMs` is absent or zero — renderer does not depend on the 307 wind-up charge telegraph for this card.
- `chrono_trigger: renderChronoTrigger` registration is unchanged; `mana_prism`, `sacrificial_altar`, and `deck_sifter` renderers are untouched.
- All optional ctx helpers are guarded (`if (ctx.spawnChronoTriggerEffect)` etc.).
- `spawnChronoTriggerEffect` is wired through the render ctx (`main.js` → `socketHandlerCtx` / `cardHandlers.js` `createCardRenderCtx`); the ctx comment block in `cardRenderers.js` documents the primitive.
- Depends on sub-ticket 01 (`spawnChronoTriggerEffect` export in `renderer.js`).
- **`pnpm test:quick` passes** with no changes required to sub-ticket 03's chrono_trigger test coverage unless this renderer's call signature or behavior genuinely changes (adjust tests in the same pass if needed — do not leave stale assertions).

## Technical Specs

- **`game/client/renderer.js`**: sub-ticket 01 owns primitive internals; this ticket only consumes the export.
- **`game/client/main.js`**: ensure `spawnChronoTriggerEffect` is imported from `./renderer.js` and passed on `socketHandlerCtx`.
- **`game/client/socketHandlers/cardHandlers.js`**: `createCardRenderCtx` forwards `spawnChronoTriggerEffect` to renderers.
- **`game/client/cardRenderers.js`**:
  - Update the ctx interface comment block (~L13–40) to document `spawnChronoTriggerEffect(origin, radius, style?)`.
  - Implement `renderChronoTrigger` (~L2148–2180):
    1. Guard on missing `data.origin` (early return).
    2. Resolve `origin`, `color`/`emissive` from `getAccentHex(data.cardId)` and `CHRONO_TRIGGER_*` constants.
    3. Call `ctx.spawnChronoTriggerEffect(origin, CHRONO_TRIGGER_TELEGRAPH_RADIUS, { color, emissive })` synchronously.
    4. When `Array.isArray(data.restoredCharges)` and non-empty, loop entries and spawn per-slot charge-restore flares at world positions derived from `data.slotIndex` vs `entry.slotIndex` and cast `direction`.
    5. Do **not** call `ctx.scheduleAfter` or rely on deferred timing.
  - Keep `CHRONO_TRIGGER_COLOR` / `CHRONO_TRIGGER_EMISSIVE` / `CHRONO_TRIGGER_TELEGRAPH_RADIUS` / `CHRONO_TRIGGER_SLOT_SPACING` constants aligned with sub-ticket 01 palette.
- **Server reference** (read-only): `cardEffects.js` (~L723–739) emits `CARD_USED` with `{ playerId, cardId, slotIndex, origin, restoredCharges }` at instant resolution. `restoreHandCharges` targets `[slotIndex - 1, slotIndex + 1]` with `adjacentChargeRestore: 2`. No `windUpMs`, no DoT, no projectile.
- **`game/client/test/cardRenderers.test.js`**: sub-ticket 03 owns baseline coverage; touch only if this ticket's renderer changes require assertion updates.
- Do **not** modify server code or other card renderers.

## Verification: code
