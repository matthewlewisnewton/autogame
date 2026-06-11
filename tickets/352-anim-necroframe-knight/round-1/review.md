# Senior Review — 352-anim-necroframe-knight

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `capturePlanValid: true`, `pageerrors: []`, no
  `harness_failure` block. Scene initialized, canvas present, gameplay reached
  (`phase: "playing"`, both players ready).
- `console.log`: clean. Only Vite connect lines, `[initScene]`, and
  `[launchBooth]`. The two `409 (Conflict)` resource lines are benign init-time
  socket/asset contention, not game-code errors — no `pageerror`, no `[fatal]`,
  no uncaught exceptions.
- Game starts and loads cleanly. Gate passes.

Note: the capture is the deterministic fallback smoke flow (deck does not
include `skeleton_knight`), so screenshots prove the game runs but do not show
this card's VFX directly. The animation behavior is instead fully covered by
deterministic unit tests (below), which is appropriate for a per-card VFX
polish ticket.

## Per-criterion findings

### 1. Visual matches name/theme
PASS. `renderNecroframeKnightSummon` (game/client/cardRenderers.js:1003) renders
an undead bone-knight rising to guard:
- Bone-white body (`0xe4e4e7`) + necrotic-purple glow (`0xa855f7`) — the exact
  palette of its evolution `undead_commander` (NECROFRAME_KNIGHT_COLOR/EMISSIVE
  at lines 55-56 mirror UNDEAD_COMMANDER_COLOR/EMISSIVE), so the base taunt-wall
  reads as the same lineage.
- A `spawnMinionSummonInEffect` summon-in flourish, a necrotic `spawnTelegraphRing`
  wrapping it, and a rising ground-level bone-shard `spawnParticleBurst`
  (y:0.35). This reads unmistakably as an undead knight materializing — on theme
  for a creature/taunt card named "Necroframe Knight".

### 2. Timing synced to server effect
PASS. Server-side `skeleton_knight` (cardStats.json:250, cardDefs.json:34) is a
creature with `effect: "skeleton_knight"`, `taunt`, and **no `windUpMs`** — the
regression test `card_windup_regression.test.js` confirms it resolves instantly
and spawns a minion. Therefore no wind-up/charge telegraph is required (none
added — correct). The summon flourish is bound to `MINION_SUMMON_IN_MS` (750ms),
and the bone-shard burst is staggered at `round(750 * 0.4) = 300ms`, capped well
within the materialize window so it lands before the mesh finishes. Timing is
consistent with the instant-resolve summon.

### 3. No perf regression
PASS. The renderer is a small, one-shot effect fired only on the initial summon
(guarded on `data.minionId`). It reuses existing pooled VFX primitives; no loops,
no per-frame allocation. Registered once for `skeleton_knight` in
`CARD_RENDERERS`.

### 4. Client test where feasible
PASS. Three new tests added (cardRenderers.test.js):
- summon renders bone-white/purple flourish + telegraph ring + staggered
  shard burst proven `< MINION_SUMMON_IN_MS`;
- stays sound-only (no flourish) when `minionId` absent and never throws;
- degrades gracefully when optional ctx helpers (`spawnTelegraphRing`,
  `spawnParticleBurst`, `scheduleAfter`) are absent.
Plus a `resolveRenderers` assertion that the card uses its bespoke renderer, not
the generic creature default. Full suite: **193 passed**.

### Scope & integration
PASS. Diff touches only `game/client/cardRenderers.js` (this card's render fn +
registration) and its test file — exactly the declared scope. No other per-card
beads are affected. Every optional helper is guarded, so the renderer is robust
against a minimal ctx. No debug scenarios added.

### Design consistency
PASS. Reuses the 315 shared VFX primitives and the per-card registration pattern;
palette deliberately matched to the evolution chain. No regression to the
foundation.

## Remaining gaps
None. The captured run is clean, all acceptance criteria are robustly met, and
the client tests pass.

VERDICT: PASS