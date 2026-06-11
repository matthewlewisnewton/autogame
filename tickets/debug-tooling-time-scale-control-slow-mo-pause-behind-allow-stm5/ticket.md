# Debug tooling: time-scale control (slow-mo/pause) behind ALLOW_DEBUG_SCENARIOS for playtesting and QA

## Difficulty: medium

## Goal

Motivation (playtest 2026-06-09): when QA-ing combat (e.g. the frost_crossing 10-second spawn wipe, autogame-1btc) there is no way to slow the simulation down to observe windups, projectile timing, or slow/burn status interactions. God mode (__toggleDebugGodmodeForTest / Shift+G) exists and was essential, but it removes death rather than letting you SEE what killed you.

DESIGN
- Server: a debug-only TIME_SCALE on the simulation, applied to the dt used by enemy AI/windups/projectiles/status timers (and cooldowns), settable via a socket message (e.g. SET_DEBUG_TIME_SCALE { scale: 0..1 }) gated by the same ALLOW_DEBUG_SCENARIOS=1 check as god mode and debugScenarios.js. scale=0 acts as pause.
- Client: test hook (window.__setDebugTimeScaleForTest) + a keybind near the god-mode one, HUD badge showing the active scale so recordings/screenshots are self-describing.
- Must be per-lobby (the debug lobby only) so it cannot affect other players, and refuse entirely when ALLOW_DEBUG_SCENARIOS is unset.

ACCEPTANCE
- With ALLOW_DEBUG_SCENARIOS=1: setting scale 0.25 visibly slows enemy movement/windups/projectiles by 4x while player input remains responsive; scale 1 restores normal; scale 0 freezes enemies.
- Without the env flag, the socket message is rejected and the keybind does nothing.
- Harness state exposes the current scale for automated tests.

Refs @ commit b4a5bb8 (may drift): god-mode gating in game/server/index.js / debugScenarios.js; main sim tick in game/server/simulation.js.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
