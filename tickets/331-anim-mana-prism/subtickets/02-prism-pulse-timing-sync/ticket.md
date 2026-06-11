# Mana Prism — lingering pulse timing synced to server stone emission

The Mana Prism server effect places a resource minion that lives
`durationSeconds` (12s) and emits `magicStonePulse` (+10) magic stones every
`pulseIntervalMs` (2000ms). Make the client cast animation telegraph this
lingering, pulsing behavior so the visual rhythm lines up with the server's
stone-emission cadence, using the established `scheduleAfter` tick pattern.

## Acceptance Criteria

- `renderManaPrism` in `game/client/cardRenderers.js` reads the Mana Prism
  pulse cadence and lifetime from the client card stats
  (`CARD_DEFS.mana_prism.pulseIntervalMs`, `.durationSeconds`,
  `.magicStonePulse`) rather than hard-coding them, with safe fallbacks
  (2000ms / 12s / 10) if a field is missing.
- On the cast path, `renderManaPrism` schedules one stone-emission pulse VFX per
  server pulse via `ctx.scheduleAfter(pulseIntervalMs * n, …)`, for the number
  of pulses that fit within `durationSeconds`
  (`floor(durationSeconds*1000 / pulseIntervalMs)` ticks), so the on-screen
  pulses fire in lockstep with the server `addMagicStones` cadence.
- Each scheduled pulse spawns a short stone-gain flourish at the prism origin
  (e.g. a violet/cyan telegraph ring + an upward mote/particle burst) that reads
  as "the prism just emitted mana", distinct from the initial cast flourish.
- The number of scheduled pulses and the interval are exactly derived from the
  server values (6 pulses at 2000ms over 12s by default) — verifiable in the
  diff — so timing cannot silently drift from the server effect.
- All scheduled-pulse calls are guarded so they no-op gracefully when
  `ctx.scheduleAfter` or the spawn primitives are absent (minimal-ctx test must
  not throw), matching the existing Wyrmflare/Inferno Pillar pattern.
- Client unit tests in `game/client/test/cardRenderers.test.js` assert that with
  a fake-timer / capturing `scheduleAfter`, `renderManaPrism` schedules the
  expected pulse count at the expected interval and each pulse emits its VFX.
- `pnpm test` (vitest server+client) passes; no perf regression (pulses are a
  bounded, finite schedule with no open-ended intervals).

## Technical Specs

- `game/client/cardRenderers.js`: in `renderManaPrism` (the
  `data.radius !== undefined` cast branch added/used in sub-ticket 01), after
  the initial cast flourish, compute
  `const stats = CARD_DEFS.mana_prism;`
  `const interval = stats?.pulseIntervalMs ?? 2000;`
  `const durationMs = (stats?.durationSeconds ?? 12) * 1000;`
  `const pulses = Math.floor(durationMs / interval);`
  then loop `for (let n = 1; n <= pulses; n += 1) ctx.scheduleAfter?.(interval * n, () => { …pulse VFX… });`.
  Model the loop exactly on `renderDragonsBreath` / `renderInfernoPillar`'s
  `scheduleAfter(dotIntervalMs * tick, …)` tick loop. `CARD_DEFS` is already
  imported at the top of the file.
- Pulse VFX: reuse `ctx.spawnTelegraphRing` (small radius) and
  `ctx.spawnParticleBurst` (upward-biased mote burst) in violet/cyan
  (`MANA_PRISM_COLOR` / `MANA_PRISM_EMISSIVE`); keep counts modest so six
  staggered pulses stay cheap.
- `game/client/test/cardRenderers.test.js`: in the `mana_prism` blocks, provide
  a `scheduleAfter` mock on `makeCtx` that records `(ms, fn)` pairs (or runs
  them immediately), and assert the recorded delays equal `[2000, 4000, …,
  12000]` (6 entries) and that invoking the callbacks spawns the pulse ring +
  burst. Do not change server code or the CARD_USED payload — all values come
  from the shared client card stats.

## Verification: code
