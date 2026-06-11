# Phase Stalker deploy reads as a dimensional "phase-in"

Polish the Phase Stalker (`null_crawler`) deploy/summon VFX so the creature
unmistakably reads as a predatory stalker *phasing in* from another dimension —
a flickering/rifting materialization — rather than the generic creature summon
flourish. Visual-theme half of the ticket; touches only this card's deploy
render function.

## Acceptance Criteria

- `renderNullCrawlerSummon` in `game/client/cardRenderers.js` produces a
  layered "phase-in" materialization that is visibly distinct from the generic
  creature summon: in addition to the existing tight cyan telegraph ring + ground
  swirl, it adds a phase-flicker beat (e.g. a second, quick pulsing telegraph
  ring and/or a converging rift particle burst) that suggests the creature
  blinking into phase.
- All new VFX go through the shared 315 primitives exposed on `ctx`
  (`spawnSummonEffect`, `spawnTelegraphRing`, `spawnParticleBurst`,
  `scheduleAfter`, etc.); no ad-hoc `THREE.*` geometry is created inside the
  render function.
- The deploy keeps the card's cyan identity: colors stay consistent with the
  `null_crawler` accent (`#22d3ee` / `NULL_CRAWLER_SUMMON_COLOR` `0x22d3ee`,
  emissive `0x67e8f9`) and the renderer still does NOT call
  `spawnMinionSummonInEffect` (preserves the distinct tight-cyan look).
- The function still no-ops on non-deploy payloads: it returns early when
  `data.minionId` is absent or `data.specialEffect === 'phase_beam'`.
- The renderer never throws when an optional primitive helper
  (`spawnTelegraphRing`, `spawnParticleBurst`) is missing from `ctx`.
- A client test in `game/client/test/cardRenderers.test.js` asserts the new
  phase-in layering (the additional telegraph ring / particle layer and its
  cyan styling) for a `null_crawler` deploy payload.

## Technical Specs

- `game/client/cardRenderers.js` — extend `renderNullCrawlerSummon` (around the
  existing implementation near `NULL_CRAWLER_SUMMON_COLOR` / `..._EMISSIVE`
  constants). Reuse the constants already defined; add the phase-flicker layer
  using existing `ctx` primitives. Keep the existing registration
  `null_crawler: [renderNullCrawlerSummon, renderPhaseBeam]` unchanged.
- `game/client/test/cardRenderers.test.js` — extend the existing
  "Phase Stalker deploy …" test (or add an adjacent test) to cover the new
  layer; keep the existing assertions (tight ring at radius `0.72`,
  cyan particle burst, no `spawnMinionSummonInEffect`) passing.
- Do NOT touch the beam/attack path (`renderPhaseBeam`) or any other card's
  renderer.

## Verification: code
