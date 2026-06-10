# Senior review — 372-playthrough-validate-ice-level

## Runtime health (blocking gate)

PASS. The round-1 capture (`metrics.json`) reports `"ok": true`, no `harness_failure`
block, and `"pageerrors": []`. `console.log` shows only `[vite] connecting/connected`,
scene init, debug-scenario application, and a single non-fatal `409 Conflict` resource
response (a benign lobby-create race, not a game-code crash) — no `pageerror`/`[fatal]`
lines. `server.log`/`client.log` are clean apart from the expected `THREE.Clock`
deprecation warning.

Note: the round-1 plan was the deterministic **Telepipe suspend/resume fallback** on
`training_caverns`, not the ice playthrough itself. I used it only for the "game starts
and loads cleanly" gate. The ticket-specific proof is the committed
`game/validation/ice/` artifact bundle plus the live code, both reviewed below.

## Per-criterion findings

### Ice preset + driver registration
PASS. `harness/validate/presets/ice.mjs` targets `frost_crossing` tier 1 with the
`ice-cavern` layout and the full scenario set; `harness/validate/playthrough.mjs`
registers the `ice` preset and `game/package.json` adds `validate:ice` /
`validate:ice:check`. `verify-ice-artifacts.mjs` exists to validate the bundle shape.

### Slippery-floor momentum / surface transitions
PASS. `run-summary.json` → `slipperyFloor` records `speedWhileHolding: 9.75`,
`driftAfterRelease: 4.24` (momentum persists after input release), `directionChangeWhileSliding:
true`, and `enteredSlipperyBand: true`. Floor-alignment probes show entry band (`band:
entry`) and ice band (`band: ice`) both at `delta: 0`, confirming the player stays seated
across the normal→ice surface transition. `harness/validate/lib/slipperyFloor.mjs` drives
this with a real movement walk, and `main.js` exposes `__sampleFloorSurfaceForHarness`.

### Ice enemy slow-on-hit (glacial thrower)
PASS, and notably honest. `glacialSlow` probe ran with `debugGodmodeOff: true`, HP fell
`100 → 88` from the ice-ball hit, and `playerSlowedUntil` is a future timestamp — the
slow path was genuinely exercised, not faked under godmode.

### Stage boss / encounter UI (283/284)
PASS with documented N/A. `frost_crossing` tier 1 is a `defeat_enemies` quest with no
`stage_boss` encounter. `findings.md` explicitly records this gap and that boss
health-bar UI and distinct boss visuals are therefore not applicable. The `08-victory.png`
screenshot confirms a normal "Sortie Complete / Contract: Frost Crossing / Hostiles
purged: 6" objective victory. This matches the ticket's instruction to NOTE the gap rather
than fabricate a boss.

### Card mechanics (299 / 301 / 308)
PASS. `cardMechanics` probes show: burn applies (`burningUntil` set, HP drops); slow
clears burn (`burnCleared: true`) — mutual exclusivity per 301; Purifying Pulse cleanse
removes burn and heals (`hp 40 → 60`) per 299; wind-up enters `cardUseState: "windup"`
with `windupFlashing: true` and `movementBlocked: true` per 308.

### Telepipe vitals persistence (287) + fresh-sortie charge reset (289)
PASS. `telepipeReset` preserves HP/MS across suspend→redeploy (`60` HP, `20` MS, same
layout seed) while issuing a fresh `runId`; the occupied iron_sword slot resets from
`remainingCharges: 25` to full `30` on the new sortie (`cardChargesResetOnFreshSortie:
true`). `cardEffects.js` and `progression.js` wire the `frost-crossing-telepipe-ready`
scenario into the existing telepipe-deploy MS-preservation path.

### Debug-scenario safety
PASS. The four new ice scenarios (`frost-crossing-near-adds`,
`-glacial-thrower-slow`, `-surface-transition`, `-telepipe-ready`) are added to the
server-gated `DEBUG_SCENARIOS` set in `game/server/index.js` and reachable only through the
debug-scenario socket path behind `isDebugScenarioAllowed()`. They seed state but do not
bypass the live movement, projectile, status, telepipe, or card-resolution code — the same
end states are reachable through normal Frost Crossing play (deploy, cross to ice band,
fight scripted glacial-thrower waves, use Telepipe). The `main.js` change that always
dismisses `#lobby` on join makes a host behave like a joiner; the lobby remains reopenable
(press `L`, line 4021) and deploy still flows through the launch booth, so normal play is
not regressed.

### Findings honesty
PASS. `findings.md` reports a green run with real probe numbers, documents the no-boss gap,
and lists the out-of-`game/validate` edits it required (main.js lobby dismiss, new debug
scenarios, telepipe progression). Screenshots `02-level-entry` and `08-victory` confirm
genuine Frost Crossing ice content, not a stand-in level. "Do not fake green" is satisfied.

## Remaining gaps

None. (One non-blocking nit recorded in `nits.md`: `05-glacial-slow.png` is captured after
the Sortie Complete overlay appears, weakening its value as visual proof of the slow hit —
the probe data still proves it.)

VERDICT: PASS
