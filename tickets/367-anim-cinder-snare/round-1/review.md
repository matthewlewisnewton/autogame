# Senior Review — 367-anim-cinder-snare

## Runtime health (gate)

PASS. `metrics.json` reports `"ok": true`, `pageerrors: []`, and the dev servers
started (capture URL `http://localhost:5174/`, scene initialized, both players
reached `phase: "playing"`). `pageerrors.json` is empty. `console.log` contains
only two `409 (Conflict)` resource lines from the auth/lobby create-join flow —
benign network noise unrelated to this card's code, not a `pageerror` or
`[fatal]`. No game-code exception in the trace. The game starts and loads
cleanly.

Note: the capture used the deterministic fallback smoke plan (`capturePlanSource:
"fallback"`), and the seeded deck did not contain `cinder_snare`, so the snare
animation itself is not in the four screenshots. The visual was verified at the
sub-ticket QA stage; runtime health here confirms the renderer swap did not break
boot or gameplay, and the unit tests (below) pin the behavior.

## Acceptance criteria

### "Animation visibly matches its name/theme"
MET. `cinder_snare` was remapped from the generic `renderGroundEnchantment`
(orange `0xf87171`/`0xef4444` summon preview) to a dedicated `renderCinderSnare`
(`game/client/cardRenderers.js:1330`). It composes 315 primitives into a fiery
ground hazard: a scorch ring + ember/fire column (`spawnInfernoPillarEffect`), a
telegraph ring at the hazard radius, a 12-particle ember burst, an impact decal,
and per-tick ember pulses. It is themed to the card's own accent `#f97316`
(`getAccentHex('cinder_snare')`, matching `CARD_ACCENT_STYLE.cinder_snare`) with
an inferno-red `0xff3b00` emissive — visibly distinct from `spike_trap`'s
steel/blood-red look, which is asserted in tests.

### "Timing synced to the server effect resolution"
MET. The card carries no `windUpMs`, so the server emits `CARD_USED` at cast; the
renderer correspondingly fires the placement VFX synchronously (no projectile/
setTimeout gating on the initial burst), with only the lingering smolder deferred
via `scheduleAfter`. The lingering cadence is derived from the server stats
(`cardStats.json`: `dotTicks: 4`, `dotIntervalMs: 500`, `ttlMs: 30000`,
`radius: 2.5`) via `getCardDef`, not hardcoded: ember pulses are scheduled at
`dotIntervalMs * tick` for each of `dotTicks`, the inferno effect's `duration` is
the snare's `ttlMs`, and the radius drives both the ring and the effect. Server
DoT ticks every 500ms × 4 (confirmed in `enchantment.test.js`) line up with the
client pulses.

### "No perf regression"
MET. Reuses existing 315 primitives; the only long-lived objects are the two
thermal-column meshes (ring + shaft), each a single mesh updated in
`updateAttackEffects` with no per-frame allocation, fading/disposing at `ttlMs`.
Negligible cost even with the 30s lifetime.

### "Client test where feasible"
MET. Five new tests in `game/client/test/cardRenderers.test.js` cover: distinct
dispatch vs `spike_trap`, themed accent at origin/radius, stat-derived cadence/
duration, synchronous placement (no wind-up gating), and a no-radius no-op. Full
file (164 tests) passes; server `enchantment.test.js` (17) passes.

### Scope / design consistency
MET. The diff touches only `game/client/cardRenderers.js` (this card's render fn
+ registration) and its test — exactly the declared scope. No server, shared, or
other-card changes; no new debug scenario; no regression to other renderers
(`renderGroundEnchantment` is retained for other cards). Consistent with
`design.md` VFX-primitive approach.

## Remaining gaps

None blocking. Two minor thematic nits captured in `nits.md`.

VERDICT: PASS
