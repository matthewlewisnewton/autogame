# Senior Review — 364-anim-telepipe

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `"pageerrors": []`, servers started, capture
  completed all five probes plus the preservation check.
- `console.log` contains only a single benign `[A:error] Failed to load
  resource: ... 409 (Conflict)` — a transient HTTP/auth resource race, not a
  `pageerror` or `[fatal]` from game code. No uncaught exceptions.
- Screenshot `01-in-dungeon.png` shows a clean dungeon render with the Telepipe
  card (cyan accent) in hand slot 1. Game starts and loads cleanly.

Runtime gate: **PASS**.

## Acceptance criteria

### "Telepipe's animation visibly matches its name/theme"
PASS. `renderTelepipe` (game/client/cardRenderers.js:1397) now fires a
portal-opening flourish: `spawnTelepipeCastEffect` (renderer.js:4574) builds an
expanding cyan ground ring + a rising open-ended warp-tube cylinder shaft +ан
an upward particle burst, layered with `spawnTelegraphRing` and a particle burst.
The cyan palette (`0x67e8f9` / `0x22d3ee`) is deliberately matched to the
persistent portal mesh in `syncTelepipeMesh`, so cast VFX and the placed portal
read as the same teleport device. Shape (ring + vertical warp tube) and color
clearly say "teleport portal" — thematically on-target.

### "timing is synced to the server effect resolution"
PASS. Server resolves telepipe synchronously on `CARD_USED`
(cardEffects.js:606-638): it sets `state.telepipe` immediately and emits
`CARD_USED { effect:'telepipe', specialEffect:'portal', origin }` with no
deferred scheduling. `cardStats.json` telepipe has **no `windUpMs`**, so the 307
wind-up charge telegraph correctly does not apply. The renderer fires
synchronously (no `scheduleAfter`), matching the instant server placement. A
unit test asserts no `scheduleAfter` and `windUpMs <= 0`.

### "no perf regression"
PASS. Pure additive VFX; every spawned effect carries a finite `duration`
(`SUMMON_EFFECT_DURATION`) and is reclaimed by `updateAttackEffects`. The
vfx-primitives test verifies all three effects are removed and their geometries
disposed after expiry. No persistent allocation, no network traffic.

### "client test where feasible"
PASS. Added renderer-level tests (cardRenderers.test.js) covering renderer
resolution, the cast/ring/burst calls with correct origin/radius/palette, the
`!data.origin` no-op guard, instant-cast (no `scheduleAfter`), and radius
default; plus primitive tests (vfx-primitives.test.js) for mesh
construction, palette, overrides, and cleanup/disposal. Ran
`vitest run cardRenderers.test.js vfx-primitives.test.js` → **182 passed**.

## Design / regression consistency

- Scope respected: diff touches only `game/client/cardRenderers.js`,
  `game/client/renderer.js` (new primitive), `game/client/main.js` (ctx
  wiring), and the two client test files. `git diff … -- game/server/` is empty.
- The persistent portal marker is unaffected — it is owned by
  `syncTelepipeMesh`/`animateTelepipePortal` (state-driven), which this ticket
  does not modify. The old `renderTelepipe` call to `spawnSummonEffect` is
  replaced by the dedicated cast flourish; the standing portal is still rendered
  from `state.telepipe`, so no regression to the evac-point marker.
- No debug scenario was added or changed by this ticket (no server diff);
  `telepipe-ready` predates the baseline and is used only by the harness capture.

## Remaining gaps

None blocking. (Minor non-blocking redundancy noted in nits.md.)

VERDICT: PASS
