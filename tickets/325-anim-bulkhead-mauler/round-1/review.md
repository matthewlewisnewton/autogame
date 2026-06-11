# Senior Review — 325-anim-bulkhead-mauler

## Runtime health
- `metrics.json`: `"ok": true`, served on :5176, `pageerrors: []`, no `harness_failure`.
- `console.log`: only two `409 Conflict` lines (benign lobby create/join auth noise).
  No `pageerror`, no `[fatal]`, no uncaught exception from game code.
- Client suite green: `cardRenderers.test.js` (265) + `vfx-primitives.test.js` (40) =
  305 passed. Game starts and loads cleanly.

The captured run is a *fallback full-flow smoke* capture — it does **not** drive
`?debugScenario=bulkhead-mauler-ready`, so the screenshots never deploy the card
and provide no visual proof of the Bulkhead Mauler VFX. Runtime health passes,
but the visual acceptance is judged from the code path below, where I found a
blocking integration defect.

## Per-criterion findings

### "Animation visibly matches its name/theme" — FAIL (deploy half broken)
The ticket and its sub-tickets define **two** animation halves:
- a **deploy/summon** VFX (sub-ticket 02): slate/amber deploy ring + rising
  bulkhead slab + summon-in flourish (`renderBulkheadMaulerSummon` →
  `spawnBulkheadMaulerDeployEffect`, `spawnMinionSummonInEffect`);
- an **attack** shockwave sweep (sub-ticket 03): ground-hugging stone wedge +
  foot debris + per-hit sparks (`renderBulkheadMaulerShockwaveSweep` →
  `spawnBulkheadMaulerShockwaveEffect`).

The **attack half is correct** in real gameplay. The **deploy half never
renders**, and a *spurious attack shockwave fires on deploy instead*. Root cause
is an event-discrimination bug:

- The card's merged def carries `specialEffect: "shockwave_sweep"`
  (`game/shared/cardStats.json:36`; `CARD_DEFS = { ...CARD_IDENTITY, ...CARD_STATS, ...overlay }`
  at `game/server/progression.js:255`).
- The creature **deploy** `CARD_USED` event therefore emits
  `specialEffect: cardDef.specialEffect` = `"shockwave_sweep"` together with
  `minionId` and `origin`, but **no** `direction`/`hits`/`attackRange`
  (`game/server/cardEffects.js:1393-1401`).
- `renderBulkheadMaulerSummon` guards with
  `if (!data.minionId || data.specialEffect === 'shockwave_sweep') return;`
  (`game/client/cardRenderers.js:1361`). On the real deploy event
  `specialEffect === 'shockwave_sweep'` is **true**, so it returns early — the
  deploy ring/slab/flourish never play.
- `renderBulkheadMaulerShockwaveSweep` guards with
  `if (data.specialEffect !== 'shockwave_sweep' || !data.origin) return;`
  (`cardRenderers.js:2452`). The deploy event satisfies this, so it **fires a
  shockwave wedge** with `directionOf(data)` defaulting to `{x:1,z:0}`
  (`cardRenderers.js:97`) and undefined `range/coneAngle` (primitive defaults).

Net effect in real play: deploying a Bulkhead Mauler plays an attack shockwave
(wrong) and skips the construct-assembly animation (missing). This contradicts
the card theme — a heavy construct should *assemble/deploy*, not emit an attack
on summon.

The established pattern (Vault/Archive Wyrm) discriminates deploy-vs-attack on
`data.breathPhase`, a field present **only** on the attack event — see
`renderWyrmSummon` (`cardRenderers.js:1931`, `if (!data.minionId || data.breathPhase ...)`)
and `renderWyrmAttack` (`cardRenderers.js:1979`, `if (data.minionId && !data.breathPhase) return;`).
The Bulkhead Mauler instead keyed on `specialEffect`, which is present on **both**
events, so the discrimination collapses.

Why the unit tests pass anyway: the summon tests construct a deploy payload that
**omits** `specialEffect` (e.g. `cardRenderers.test.js:3364-3369`), which does
not match the real server event. So the green suite does not exercise the actual
deploy payload.

### "Timing synced to server effect resolution" — PASS (attack), N/A wind-up
The attack is an instant cone (`collectConeHits`, `game/server/simulation.js:3699`),
no projectile travel and no wind-up; the attack renderer fires synchronously on
`CARD_USED` with no `scheduleAfter` deferral, and the shockwave VFX duration
(500ms ground-hugging fade) matches an instant footprint. The card has no
`windUpMs`, so the 307 charge telegraph is correctly not applicable. Timing for
the attack path is sound. (The deploy-timing question is moot until the deploy
renderer is reached at all — see above.)

### "No perf regression" — PASS
Pure additive `activeEffects` entries with bounded durations and proper
`disposeEffectObject` cleanup on expiry. No new network traffic. `enemySync.js`
swap from `spawnAttackEffect` to `spawnBulkheadMaulerShockwaveEffect` uses the
minion's real `attackRange`/`attackConeAngle` (set at deploy, `cardEffects.js:1337-1338`).

### "Client test where feasible" — PASS (but blind to the defect)
305 client tests pass; new tests cover composition, palette, guard branches and
graceful degradation. However they use idealized payloads and miss the real
deploy payload (see above) — captured as a nit.

### Debug scenario `bulkhead-mauler-ready` — PASS
- Gated: registered in `DEBUG_SCENARIOS` set (`game/server/index.js:534`) and
  `DEBUG_SCENARIO_REGISTRY` (`debugScenarios.js:4950`); URL param is the only entry.
- Reachable normally: `bulkhead_mauler` is a reward card
  (`cardDefs.json:7`, `acquisition: "reward"`); the scenario only seeds hand+mana
  and does not bypass server validation, deploy, or net-replication — the deploy
  still flows through the normal card-use path.

## Remaining gaps
1. **BLOCKING** — Bulkhead Mauler deploy/summon animation never renders in real
   gameplay; a spurious attack shockwave fires on deploy instead. The renderers
   discriminate deploy-vs-attack on `specialEffect`, which the card def stamps on
   the deploy event too. Fix by keying on an attack-only field (`direction`/`hits`),
   mirroring the wyrm's `breathPhase` pattern. Detail and fix in `gaps.md`.

VERDICT: FAIL
