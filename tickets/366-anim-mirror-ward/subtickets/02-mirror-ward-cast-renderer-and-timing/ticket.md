# Mirror Ward — cast renderer, lingering ward timing, and registration

Replace the shared `renderSelfEnchantment` path for `mirror_ward` with a
dedicated `renderMirrorWard` renderer that composes the new mirror-ward
primitives. Cast VFX must fire synchronously when the server emits `CARD_USED`
(instant resolution — `mirror_ward` has no `windUpMs`) and the lingering ward
shell must persist for the server's `ttlMs` (20 s).

## Acceptance Criteria

- `mirror_ward` resolves to `renderMirrorWard` in `CARD_RENDERERS`; it no longer
  uses `renderSelfEnchantment`. `spike_trap` / `cinder_snare` remain on
  `renderGroundEnchantment` unchanged.
- `renderMirrorWard` guards on `data.target === 'self'` for the **cast** path
  (when `data.reflectTriggered` is absent/false) and no-ops for non-self targets.
- On cast (`CARD_USED` from `cardEffects.js` enchantment branch):
  - VFX fire **synchronously** inside `renderMirrorWard` — no `scheduleAfter`,
    no artificial delay. Confirms timing matches the server's instant
    `armSelfEnchantment` resolution (no `windUpMs` on this card).
  - `ctx.spawnMirrorWardShellEffect` is called at the caster origin with
    `radius` = `getCardDef('mirror_ward').reflectRange` (11) and
    `duration` = `getCardDef('mirror_ward').ttlMs` (20000) so the lingering ward
    matches server TTL.
  - A cast flourish also fires: `spawnTelegraphRing` at the same radius (short
    `SUMMON_EFFECT_DURATION` pulse) plus `spawnParticleBurst` (mirror palette,
    modest count/spread).
- `main.js` `cardRenderCtx` exposes `spawnMirrorWardShellEffect` and
  `spawnMirrorWardReflectBurst` from `renderer.js`.
- `getCardDef('mirror_ward').windUpMs` is absent or zero — renderer does not
  depend on the 307 wind-up charge telegraph for this card.
- Depends on sub-ticket 01 (`spawnMirrorWardShellEffect` must exist).
- Do **not** add tests in this sub-ticket (owned by sub-ticket 03).

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Import `getCardDef` from `./cards.js` and `SUMMON_EFFECT_DURATION` from
    `./config.js`.
  - Add `renderMirrorWard(data, ctx)` with mirror palette constants; keep
    `renderSelfEnchantment` for any future self-enchantments but remove
    `mirror_ward` from sharing it.
  - Cast branch (no `data.reflectTriggered`):
    1. Early return unless `data.target === 'self'` and `data.origin`.
    2. `origin = originOf(data)`.
    3. `const def = getCardDef('mirror_ward')`; `radius = def.reflectRange`;
       `lingerMs = def.ttlMs`.
    4. `ctx.spawnMirrorWardShellEffect(origin, radius, { duration: lingerMs, … })`.
    5. `ctx.spawnTelegraphRing(origin, radius, { duration: SUMMON_EFFECT_DURATION, … })`.
    6. `ctx.spawnParticleBurst({ x: origin.x, y: 1.0, z: origin.z }, { count: ~12, spread: ~1.6, … })`.
  - Change `CARD_RENDERERS.mirror_ward` from `renderSelfEnchantment` to
    `renderMirrorWard`.
  - Leave the reflect-trigger branch for sub-ticket 03 (may stub with a comment
    or no-op until 03 lands).
- **`game/client/main.js`**: import and wire
  `spawnMirrorWardShellEffect` / `spawnMirrorWardReflectBurst` on `cardRenderCtx`.
- **Server reference (read-only)**: `cardEffects.js` emits `CARD_USED` for
  `mirror_ward` with `{ playerId, cardId, effect, target: 'self', origin }` at
  cast time after `armSelfEnchantment`; no `windUpMs` gate. Do not modify server
  in this sub-ticket.

## Verification: code
