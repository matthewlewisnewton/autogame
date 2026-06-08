# Permafrost Lance renderer polish and server timing sync

Upgrade `renderPermafrostLance` to compose the new lance attack effect with 315 VFX primitives so the cast reads unmistakably as a forward ice lance and its animation timing matches the server's instant `frost_nova`-branch resolution (no `windUpMs`, no projectile travel delay on the server).

## Acceptance Criteria

- `renderPermafrostLance` calls `ctx.spawnAttackEffect` with `effect: 'permafrost_lance'`, `range: data.radius`, and accent-derived icy colors — the primary visible lance projectile.
- A narrow cast telegraph (`spawnTelegraphRing` at `origin` with radius ≈ `data.radius * 0.55`) fires at cast time, distinct from Cryo Burst's full-radius ring.
- `spawnProjectileTrail` uses explicit `travelMs: ATTACK_EFFECT_DURATION` (import from `config.js`, 600 ms) so the frost streak duration matches the lance projectile travel window, not the slower `ice_ball` default (1200 ms).
- Impact visuals (`spawnImpactDecal` + `spawnParticleBurst`) spawn at the lance tip (`pointAlong(origin, direction, data.radius)`) on the same frame as the cast (server applies freeze + damage instantly when `CARD_USED` arrives); no `scheduleAfter` delay before impact.
- `permafrost_lance` remains registered in `CARD_RENDERERS`; `frost_nova` renderer is untouched.
- `CARD_DEFS.permafrost_lance` has no `windUpMs` — this card does not use the 307 wind-up charge telegraph (instant cast only).
- Renderer guards optional ctx helpers (`if (ctx.spawnImpactDecal)` etc.) so partial ctx objects do not throw.
- Depends on sub-ticket 01 (`permafrost_lance` attack-effect branch must exist).

## Technical Specs

- **`game/client/cardRenderers.js`**:
  - Import `ATTACK_EFFECT_DURATION` from `./config.js`.
  - Rewrite `renderPermafrostLance` (~lines 476–497) to:
    1. Guard on `data.radius` and `data.origin` (keep existing early return pattern).
    2. Resolve `origin`, `direction` (`directionOf(data)`), `color`/`emissive` from `getAccentHex`.
    3. `spawnTelegraphRing(origin, data.radius * 0.55, { color, emissive })`.
    4. `spawnAttackEffect(origin, direction, { effect: 'permafrost_lance', range: data.radius, color, emissive, duration: ATTACK_EFFECT_DURATION })`.
    5. `spawnProjectileTrail(origin, direction, { range: data.radius, color, emissive, travelMs: ATTACK_EFFECT_DURATION })`.
    6. Compute `tip = pointAlong(origin, direction, data.radius)`; call `spawnImpactDecal(tip, …)` and `spawnParticleBurst(tip, { count: ~10–14, spread: ~1.2, … })`.
  - Keep `permafrost_lance: renderPermafrostLance` registration unchanged.
- **Server reference** (read-only): `permafrost_lance` uses `effect: 'frost_nova'` in `cardStats.json` — instant radial freeze at cast with `radius: 6`, `freezeDurationMs: 2000`, no `windUpMs`, no `projectileTravelMs`. Client impact must align with immediate `CARD_USED` delivery; ongoing freeze visuals on enemies are driven by server `frozenUntil` state, not this renderer.
- **Payload reference**: server `CARD_USED` for this card emits `{ origin, radius, hits, frozen: true }` without `direction`; renderer uses `directionOf(data)` (defaults `{ x: 1, z: 0 }` when absent). Do not modify server code in this ticket.
- Do **not** add tests in this sub-ticket (owned by sub-ticket 03).

## Verification: code
