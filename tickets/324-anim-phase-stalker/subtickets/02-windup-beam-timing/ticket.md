# Phase Stalker wind-up + beam: phase-rift look, server-synced timing

Polish the Phase Stalker attack cycle so the wind-up telegraph and the resolved
beam read as a dimensional phase/void rift AND their timing lines up with the
server. The server (`game/server/simulation.js`, `null_crawler` branch) charges
for `attackWindupMs` (default 1000) and then resolves the beam as an **instant
hitscan** (`collectPhaseBeamHits` at wind-up completion); the client should
match that — a wind-up telegraph that lasts exactly the wind-up, then a fast
beam flash whose impacts land on the same beat as the server damage.

## Acceptance Criteria

- The `null_crawler` wind-up telegraph created in
  `game/client/renderer/minionSync.js` (the `minion.attackState === 'windup'`
  branch / `createNullCrawlerTelegraph`) drives its corridor + ring lifetime
  from `minion.attackWindupMs` (fallback `1000`) so the telegraph charges for
  exactly the server wind-up window, and is disposed when wind-up ends.
- The wind-up telegraph corridor is oriented along the locked wind-up direction
  (`minion.windupDirX/windupDirZ`) so it points where the beam will fire.
- `renderPhaseBeam` in `game/client/cardRenderers.js` resolves on receipt of the
  `phase_beam` breath as a near-instant beam (matching the server hitscan): it
  keeps `effect: 'returning_projectile'` with `returnPasses: 0` and tightens the
  beam so the flash + terminus burst + hit sparks read as a single quick strike
  rather than a slow multi-second projectile that lags the already-applied
  server damage (e.g. a short `travelMs`/duration or hitscan-style corridor).
- Per-hit impact sparks spawn at each reported enemy hit position
  (`data.hits[].enemyId` → `ctx.enemyMeshes()`), so on-screen impacts line up
  with the server's damage tick.
- The beam reads as a phase/void rift: a distinct themed color treatment (e.g. a
  void-purple rift accent layered behind/along the corridor) while the cyan card
  accent (`#22d3ee`, emissive `0x06b6d4`) stays the primary identity.
- All VFX go through the shared 315 primitives (`spawnAttackEffect`,
  `spawnProjectileTrail`, `spawnParticleBurst`, `spawnHitSpark`,
  `spawnTelegraphRing`); no perf regression — the wind-up telegraph mesh is
  disposed on wind-up end and no per-frame mesh/particle leak is introduced.
- `renderPhaseBeam` still no-ops when `data.origin` is missing and does not throw
  when optional helpers (`spawnProjectileTrail`, `spawnParticleBurst`,
  `spawnHitSpark`) are absent from `ctx`.
- Client tests in `game/client/test/cardRenderers.test.js` (beam) and any
  existing minion-sync test cover: telegraph lifetime derived from
  `attackWindupMs`, `returnPasses: 0`, and one hit spark per reported hit.

## Technical Specs

- `game/client/cardRenderers.js` — `renderPhaseBeam`: keep the existing
  corridor/trail/terminus/hit-spark structure; add the phase-rift color layer
  and tighten the beam timing (pass a short `travelMs`/`duration` so the
  visible strike matches the instant server hit). Registration
  `null_crawler: [renderNullCrawlerSummon, renderPhaseBeam]` stays unchanged.
- `game/client/renderer/minionSync.js` — confine edits to the
  `minion.type === 'null_crawler'` wind-up branch and
  `createNullCrawlerTelegraph` / `updateNullCrawlerTelegraph`; drive telegraph
  durations from `minion.attackWindupMs`. Do not alter other minion types'
  branches.
- Server is authoritative and unchanged: `game/server/simulation.js` resolves
  the beam at wind-up completion and pushes the `phase_beam` breath — the client
  only needs to match its timing, not re-time the hit.
- `game/client/test/cardRenderers.test.js` — extend the existing
  "Phase Stalker beam …" tests; keep the existing corridor/trail/terminus/
  hit-spark assertions passing.

## Verification: code
