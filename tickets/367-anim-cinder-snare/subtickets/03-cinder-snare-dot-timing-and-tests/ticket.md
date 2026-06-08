# Cinder Snare DoT cadence timing and test coverage

Align Cinder Snare's client placement animation timing with the server effect
contract: instant ground placement on `cardUsed` (no `windUpMs` on this card,
unlike Spike Trap's 500 ms wind-up), then a lingering ember pulse cadence that
matches the inferno DoT the trap spawns on trigger (`dotTicks: 4`,
`dotIntervalMs: 500` from `CARD_DEFS.cinder_snare` / `cardStats.json`).

## Acceptance Criteria

- `renderCinderSnare` reads `dotTicks` and `dotIntervalMs` from
  `CARD_DEFS.cinder_snare` (fallback 4 and 500) — do not hardcode divergent
  values.
- Placement burst (telegraph ring + decal + initial burst from sub-ticket 02)
  fires at **t = 0 ms** when `cardUsed` arrives.
- Additional smolder pulses fire via `ctx.scheduleAfter` at
  `i * dotIntervalMs` for `i = 1 … dotTicks - 1` (delays **500, 1000, 1500**
  ms for the default stats). Each scheduled callback emits at least one cinder
  primitive (`spawnParticleBurst` and/or a subtle `spawnTelegraphRing` pulse)
  so the client previews the server's 500 ms DoT tick rhythm.
- No extra client-side wind-up delay is added in the renderer: `cinder_snare`
  has no `windUpMs` stat; `cardUsed` fires on immediate placement (contrast
  `spike_trap.windUpMs === 500`, which is handled by the existing 315 charge
  telegraph in `renderer.js`).
- Tests in `game/client/test/cardRenderers.test.js`:
  - Firing `cinder_snare` produces `scheduleAfter` delays of `[500, 1000, 1500]`
    (three follow-up pulses after the t = 0 placement burst).
  - Assert `CARD_DEFS.cinder_snare.dotTicks === 4` and
    `CARD_DEFS.cinder_snare.dotIntervalMs === 500` to document the server
    timing contract.
  - Assert `CARD_DEFS.cinder_snare.windUpMs` is `undefined` (no wind-up on
    this enchantment).
- Existing client + server vitest suites still pass; no per-frame allocation
  regressions.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Import `CARD_DEFS` (already imported) and read
    `const { dotTicks = 4, dotIntervalMs = 500 } = CARD_DEFS.cinder_snare`.
  - After the t = 0 placement VFX bundle in `renderCinderSnare`, loop
    `for (let i = 1; i < dotTicks; i++)` and wrap each follow-up ember pulse in
    `ctx.scheduleAfter(dotIntervalMs * i, () => { … })`.
  - Keep all scheduled pulses inside the same helper or inline closure so they
    share the cinder palette constants from sub-tickets 01–02.
  - Do not modify server code or `cardEffects.js` payloads; timing values come
    from the shared `CARD_DEFS` mirror of `cardStats.json`.
- `game/client/test/cardRenderers.test.js`:
  - Add dedicated `cinder_snare` timing tests with a recording ctx that captures
    `scheduleAfter` calls (same pattern as `excalibur_photon` / photon barrage
    tests).
  - Verify scheduled callbacks invoke at least one VFX primitive when invoked
    manually in the test (optional but preferred).

## Verification: code
