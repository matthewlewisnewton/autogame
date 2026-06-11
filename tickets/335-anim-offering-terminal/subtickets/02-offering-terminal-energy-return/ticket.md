# Offering Terminal energy return: golden siphon and reward feedback

After the ritual cast and minion consumption (sub-ticket 01), the Offering
Terminal returns energy to the caster — 100 Magic Stones and 2 restored weapon
charges. Add a golden energy siphon/flow effect traveling from the altar origin
toward the caster, and a brief reward-flash at the origin to visually acknowledge
the MS gain and charge restore. The server resolves this instantly (no wind-up,
no travel), so all spawns remain synchronous.

This is sub-ticket 02 of 335-anim-offering-terminal. It builds on sub-ticket 01's
ritual cast visual and adds the "what did I get" feedback layer.

## Acceptance Criteria

- `renderSacrificialAltar` spawns a golden energy-return effect after the ritual
  cast primitives from sub-ticket 01:
  - A golden particle trail or upward energy column at the altar origin that
    reads as energy flowing back to the caster — e.g. a
    `ctx.spawnProjectileTrail` from origin pointing upward or a second,
    gold-only `ctx.spawnParticleBurst` with higher `count` and vertical-leaning
    `spread` to read as an upward siphon.
  - A brief golden reward-flash decal at the origin — a small, bright gold
    `ctx.spawnImpactDecal` (radius ~0.6–1.0, bright gold color 0xfde047 or
    similar, short duration) that reads as the "reward materialized" moment.
- The energy-return effect uses a distinct golden palette from the red
  consumption burst in sub-ticket 01 (e.g. `color: 0xfde047`,
  `emissive: 0xfbbf24`) so the siphon reads as gain, not loss.
- The reward effects fire only when the payload indicates a successful sacrifice
  (`data.magicStonesGained` is a positive number and/or
  `data.restoredCharges` is present and positive). When the sacrifice fails
  (e.g. payload lacks these fields or values are zero), skip the reward layer
  but still fire the ritual cast from sub-ticket 01.
- All spawns happen synchronously inside `renderSacrificialAltar` — no
  `setTimeout`, no `scheduleAfter`, no Promise/async delay — matching the
  server emitting `CARD_USED` immediately in the sacrificial_altar branch.
- The renderer degrades gracefully when new ctx primitives are absent (each
  call guarded with `if (ctx.spawnXxx)`).
- A client test asserts the reward effects are spawned when the payload carries
  `magicStonesGained > 0` and `restoredCharges > 0`, and that no reward effects
  fire when those fields are absent or zero.
- Full client + server vitest suite passes; no perf regression.

## Technical Specs

- `game/client/cardRenderers.js`: in `renderSacrificialAltar`, after the ritual
  cast primitives from sub-ticket 01, add the reward-feedback layer:
  - Gate behind `data.magicStonesGained && data.magicStonesGained > 0` (or
    `data.restoredCharges && data.restoredCharges > 0`).
  - Golden upward siphon: `ctx.spawnParticleBurst(origin, { color: 0xfde047,
    emissive: 0xfbbf24, count: 20, spread: 2.8 })` — a denser, brighter gold
    burst that reads as energy flowing back. Optionally add a vertical
    `ctx.spawnProjectileTrail(origin, { x: 0, z: 0 }, { color: 0xfde047,
    emissive: 0xfbbf24, range: 3 })` if a directional trail is available.
  - Reward flash: `ctx.spawnImpactDecal(origin, { color: 0xfde047,
    emissive: 0xfbbf24, radius: 0.8 })` — a small bright gold decal at the
    altar base reading as "reward materialized".
- The `CARD_USED` payload for `sacrificial_altar`
  (`game/server/cardEffects.js` ~693) carries `{ origin, radius,
  sacrificedMinionId, magicStonesGained, restoredCharges }` — read from these;
  do NOT modify the server or add payload fields.
- `game/client/test/cardRenderers.test.js`: add tests:
  - With `{ magicStonesGained: 100, restoredCharges: 2, sacrificedMinionId:
    'minion-X', radius: 10, origin }`: assert golden siphon burst and reward
    decal are present with gold palette.
  - With `{ magicStonesGained: 0, restoredCharges: 0, radius: 10, origin }`
    (or fields absent): assert no golden reward effects fire (only ritual cast
    from sub-ticket 01).
- Build on sub-ticket 01's renderer; do not regress its ritual cast behavior or
  its tests. Do NOT touch the server, other card renderers, or shared stats.

## Verification: code
