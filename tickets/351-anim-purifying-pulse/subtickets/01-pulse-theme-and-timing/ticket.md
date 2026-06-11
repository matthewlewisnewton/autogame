# Purifying Pulse — pulse/cleanse theme polish + instant-resolution timing sync

Polish the `purifying_pulse` spell animation so it reads unmistakably as a
"Purifying Pulse": a cleansing wave that visibly *pulses* outward from the cast
origin plus an upward *purifying* rise (corruption being lifted away), all in the
mint/teal/white holy palette. The card resolves instantly server-side
(`heal_and_cleanse`, AoE heal in `radius`, no projectile/DoT/windUp), so all VFX
and the heal cue must fire synchronously at cast and the heal sound must only
play for the locally-relevant player.

## Acceptance Criteria

- `renderPurifyingPulse(data, ctx)` (game/client/cardRenderers.js) and the VFX
  helpers it calls fire **synchronously within the render call** — no
  `setTimeout`, no `ctx.scheduleAfter`, no projectile-travel delay — matching the
  server's instant `heal_and_cleanse` resolution (the server emits `cardUsed`
  once, with no travel phase).
- The heal VFX reads as a **pulse**: it spawns **at least two** concentric,
  outward-expanding heal-wave rings (sequential/staggered, not a single ring), so
  the effect visibly pulses outward to the card's `radius`.
- A distinct **purifying rise** element lifts upward (white→mint sparkle/column),
  separate from the ground heal rings, reading as a cleanse/corruption-lift — not
  just a flat ground ring.
- The outermost heal wave expands to `data.radius`. When `data.radius` is
  `undefined` the renderer is a **no-op** (no VFX spawned, no sound played).
- Palette stays in the existing purifying family — heal mint `0x6ee7b7` /
  emissive `0x34d399`, cleanse white `0xffffff` / teal `0x5eead4`. The renderer
  must **never** emit Divine Grace's gold (`0xfde68a` / `0xfbbf24`).
- The heal **sound plays only when locally relevant**: when the local player
  (`ctx.myId`) is the caster (`data.playerId`) or appears in `data.healedTargets`
  (each entry `{ playerId, hpGained, cleansed }`). A pure spectator who was not
  healed does not hear the heal cue.
- Only `purifying_pulse`'s renderer + its `CARD_RENDERERS` registration and its
  own VFX helper(s)/constants in `game/client/renderer.js` change. No other card
  renderer, no server file, and no shared card data are modified.
- The ctx-interface doc comment block at the top of cardRenderers.js stays
  accurate if any helper signature changes.
- No perf regression: VFX remain driven by the existing `activeEffects` queue
  (no new requestAnimationFrame loop, no unbounded/leaking effects, no new
  per-frame allocations).
- `cd game && pnpm test` passes (server + client suites).

## Technical Specs

- `game/client/cardRenderers.js`
  - `renderPurifyingPulse` (~line 710): keep the `data.radius === undefined`
    early-return guard. Drive a multi-wave pulse + upward cleanse rise via `ctx`
    helpers, and gate `ctx.playSound('heal')` on local relevance
    (`data.playerId === ctx.myId || data.healedTargets?.some(t => t.playerId === ctx.myId)`).
  - Registration line ~1821 (`purifying_pulse: renderPurifyingPulse`) stays.
  - Update the ctx-interface comment (lines ~19–21) only if helper signatures
    change.
- `game/client/renderer.js`
  - `spawnPurifyingPulseHealRing` / `spawnCleanseBurstEffect` /
    `spawnPurifyingPulseEffect` (~lines 4765–4818) and the palette constants
    `PURIFYING_HEAL_COLOR` / `PURIFYING_HEAL_EMISSIVE` / `CLEANSE_BURST_*`
    (~lines 4752–4758). Emit the staggered multi-wave pulse (e.g. 2–3 rings
    offset by a small fixed delay encoded as per-effect `createdAt` / `delay`,
    not via `setTimeout` in the renderer call path) and an upward cleanse rise.
    Reuse existing ring/spark primitives; push onto `activeEffects` with a
    bounded `duration` exactly as the current helpers do.
- `game/client/test/cardRenderers.test.js`
  - Extend the existing `purifying_pulse` tests (~line 1676) and the
    divine_grace-vs-purifying_pulse contrast test (~line 1626) to assert: ≥2
    heal-wave rings, a distinct cleanse-rise call, synchronous resolution (spy
    `setTimeout` — not called), heal-sound gating by `ctx.myId` vs
    `data.healedTargets`/`data.playerId`, no-gold palette, and the
    `radius`-undefined no-op.

## Verification: code
