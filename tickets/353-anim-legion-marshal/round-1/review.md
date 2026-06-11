# Senior Review — 353-anim-legion-marshal

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `pageerrors: []`, servers started on :5177, scene
  initialized, both clients connected and reached gameplay.
- `console.log`: clean — only benign Vite connect lines, two `409 Conflict`
  resource loads (lobby create/join race, not game code), and normal
  `[initScene]` / `[launchBooth]` logs. No `pageerror` / `[fatal]` / uncaught
  exceptions from game code.
- No `harness_failure` block.

Game starts and loads cleanly. Gate passes.

## Scope of change
`git diff 640a95c0..HEAD` touches exactly the in-scope surface:
`game/client/cardRenderers.js` (renderUndeadCommander + ctx doc),
`game/client/renderer.js` (new `spawnLegionMarshalRallyEffect` primitive +
`isLegionMarshalColumn` update branch), the ctx plumbing in `main.js`,
`socketHandlers/cardHandlers.js`, `socketHandlers/socketHandlerCtx.js`, and the
two client test files. No server, shared, or unrelated client files changed.

## Acceptance criteria

### 1. Visual unmistakably reads as "Legion Marshal" (undead commander, creature)
PASS. `renderUndeadCommander` now composes a themed rally:
- A new `spawnLegionMarshalRallyEffect` — expanding bone-white (`0xe4e4e7`) /
  necrotic-purple (`0xa855f7`) ground ring plus a rising bone-shard/necrotic
  wisp column and a particle burst at the cast origin.
- A commander summon-in flourish (`spawnMinionSummonInEffect`, radius 1.6).
- Per summoned skeleton: a summon-in flourish, a ground particle burst, and a
  necrotic tether arc (`spawnLightningArc`) from the commander to each skeleton.
The "marshal rallying a legion" reading — central commander summon plus tethered
skeletons radiating outward — matches the name/theme well. Palette is consistent
with the existing `UNDEAD_COMMANDER_COLOR/EMISSIVE` constants.

### 2. Built on 315 primitives; per-card touch only
PASS. Reuses `spawnLightningArc`, `spawnParticleBurst`,
`spawnMinionSummonInEffect`; the one new primitive
(`spawnLegionMarshalRallyEffect`) follows the established
`spawnEtherSiphonEffect` column pattern and is registered through the standard
ctx chain (`renderer → main → socketHandlerCtx → cardHandlers`). All ctx
accessors are wired through; verified the imports/exports match.

### 3. Timing synced to server effect resolution
PASS. `undead_commander` has **no** `windUpMs` (verified in `cardDefs.json` and
`cardStats.json`), so it is an instant cast — no 307/315 charge telegraph is
required, and a test asserts `windUpMs ?? 0 <= 0`. The renderer fires on the
`cardUsed` broadcast, whose payload (`cardEffects.js:1398-1399`) carries the real
`minionId` and `summonedMinions[]` (with server-assigned positions), so the
flourishes and tethers land on the actual spawn coordinates at resolution time.
Effect durations use `SUMMON_EFFECT_DURATION`, matching sibling summon VFX.

### 4. No perf regression
PASS. The ring uses the shared `radius` update path (expand + fade + dispose);
the column update branch (`isLegionMarshalColumn`) does scalar math only — no
per-frame allocation — and disposes geometry/material via `disposeEffectObject`
on expiry. The `vfx-primitives.test.js` test confirms both meshes are removed
from `activeEffects` and `dispose()` is called after duration.

### 5. Robustness / graceful degradation
PASS. Every optional ctx call is guarded (`if (ctx.spawnLegionMarshalRallyEffect)`
etc.), and a dedicated test
(`degrades gracefully when Legion Marshal VFX primitives are absent`) confirms
`renderCardUsed` does not throw and emits no fallback `spawnSummonEffect` when
the primitives are missing.

### 6. Client tests
PASS. `cardRenderers.test.js` (190) + `vfx-primitives.test.js` (24) = 214 tests
pass locally. Coverage includes rally call args, commander + skeleton flourish
ordering/positions, tether endpoints, ground bursts, palette, default radius,
color/duration overrides, and cleanup.

## Debug scenarios
No `?debugScenario` entry point was added or changed by this ticket (the
existing `debugScenarios.js` reference to `undead_commander` predates the
baseline and is untouched). N/A.

## Design consistency
`docs/design.md` has no card-specific VFX constraints for this card; the change
follows the established per-card animation foundation and does not regress the
requirements foundation.

## Remaining gaps
None blocking. One minor non-blocking observation filed to `nits.md` (column
VFX pattern duplicated across per-card primitives).

VERDICT: PASS
