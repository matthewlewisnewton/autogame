# Senior Review — 128-key-item-smoke-bomb

## Runtime health — BLOCKING (capture failed, no runnable proof)

`metrics.json` reports `"ok": false` with `"failure_kind": "capture_failed"`.
The capture aborted at `page.waitForFunction: Timeout 12000ms exceeded` after the
**Vite dev server connection dropped mid-flow**. From `console.log`:

```
[A:error] Failed to load resource: the server responded with a status of 409 (Conflict)
[B:log] [vite] server connection lost. Polling for restart...
[A:error] Failed to load resource: net::ERR_CONNECTION_REFUSED   (repeated)
[capture:error] page.waitForFunction: Timeout 12000ms exceeded.
```

Critically:
- `pageerrors.json` is `[]` and `metrics.json` `pageerrors` is empty — **no browser
  page errors, no game-code exception**.
- `server.log` shows a clean boot (`Server listening on port 3000`, both players
  connected, dungeon layout generated) with no `[fatal]` lines.
- `client.log` shows Vite booting cleanly (`VITE v8.0.13 ready in 96 ms`).
- The one screenshot that was captured (`01-initial.png`) shows the lobby
  rendering correctly; the red "Disconnected" badge is consistent with the
  socket/Vite connection being lost out from under the page, not a code fault.

No game code appears anywhere in the failure trace. The Vite HMR/websocket dropped
(409 → connection lost → connection refused), so the deterministic full-flow smoke
plan timed out before reaching gameplay. This is a **harness / capture
infrastructure failure**, not a defect in this ticket's code. Per the runtime-health
rule, a run without clean proof is still an automatic `VERDICT: FAIL` — but the next
round must NOT churn on the game code, which is already correct (see below).

## Harness blockers

```
failure_kind: capture_failed
console: "[vite] server connection lost. Polling for restart..."
         "Failed to load resource: ... 409 (Conflict)"
         "Failed to load resource: net::ERR_CONNECTION_REFUSED"
         "page.waitForFunction: Timeout 12000ms exceeded."
```

The Vite dev server (`:5173`) became unreachable during capture (409 then repeated
connection-refused), so the browser flow timed out. `capture_diagnosis.port_holders`
is empty for both `:5173` and `:3000` at teardown. Fix: re-run capture on a clean
Vite instance; do not modify `game/`.

## Acceptance-criteria assessment (code judged on its merits)

All server tests pass: **1021/1021 across 40 files**; the dedicated
`server/test/smoke_bomb.test.js` is **9/9 green**. Had capture succeeded, this would
have passed.

- **`useKeyItem` spawns a 2s zone at player position; enemies targeting player
  lose detection (pick one simple rule, documented)** — MET. `index.js`
  `useKeyItem` handler sets `smokeBombUntil = now + durationMs (2000)`,
  `smokeBombRadius`, and `smokeBombX/Z` at the caster's position.
  `simulation.js#isPlayerConcealed` makes any player inside an active zone
  unacquirable, and an in-progress wind-up against a newly-concealed player is
  cancelled (returns to chasing, no damage). The rule ("conceal → drop targeting")
  is documented in the code comments and the `smoke_bomb` def description.

- **Cooldown ~8s** — MET. `progression.js` `smoke_bomb.cooldownMs` retuned
  `18000 → 8000`; handler sets `keyItemCooldownUntil = now + (def.cooldownMs || 8000)`.
  Test "cooldown enforced" confirms an immediate re-cast returns `on_cooldown` and
  does not refresh the smoke window. Stale legacy values (18000/3000) explicitly
  asserted absent.

- **Zone follows player or stays fixed (document choice)** — MET / documented.
  Choice = **fixed at cast point**; `smokeBombX/Z` captured at cast and never
  updated; comments and the `isPlayerConcealed` docstring state the player can
  walk out and become targetable again. Test verifies walking out (`x=20`) and
  expiry both end concealment.

- **Client smoke VFX** — MET. `renderer.js#triggerSmokeVFX` spawns a translucent
  grey puff cluster that rises, expands, and fades over ~2s, disposing geometries
  and materials. Wired in `main.js` on `keyItemUsed` for the caster, and the
  `animate` loop re-triggers a puff for any player with an active
  `smokeBombUntil` zone (with a 300ms tail guard so a near-expired zone doesn't
  spawn a fresh 2s puff). Per-player tracking prevents duplicate stacking.
  (Visual confirmation is the one thing the failed capture could not provide.)

- **Tests: targeting cleared while in zone** — MET. Suite covers def tuning,
  socket cast/cooldown, `isPlayerConcealed` (in-zone / walked-out / expired),
  ally concealment via caster's zone, no target acquisition while concealed,
  re-acquisition after expiry, mid-wind-up cancel, and the negative case
  (non-concealed player still takes damage).

## Debug scenario — `smoke-bomb-ready`

- Gated correctly: only reachable via the `debugScenario` socket event, which is
  refused unless debug scenarios are enabled (`ALLOW_DEBUG_SCENARIOS=1` /
  dev gate at `index.js:496`); `DEBUG_SCENARIOS` set membership required. Normal
  gameplay never touches it.
- Equivalent end-state reachable normally: equip the Smoke Bomb key item, enter a
  run, approach enemies, cast. The scenario only pre-equips the item, zeroes the
  cooldown, and spawns two enemies in range.
- Does not weaken invariants: the cast itself still flows through the normal
  `useKeyItem` handler (cooldown, persistence-dirty, state snapshot); the scenario
  sets up state but does not bypass server validation or replication.

## Design / regression consistency

Consistent with the existing key-item pattern (mirrors `barrier_dome`'s
zone-snapshot fields in `stateSnapshot`). No foundation regression: full server
suite is green, including unrelated key items and core simulation.

## Remaining gaps

1. **Capture did not complete — no runnable proof of the game.** This is a harness
   infrastructure failure (Vite dev server connection dropped: 409 → connection
   lost → connection refused → `waitForFunction` timeout), not a game-code defect.
   `pageerrors` empty; server/client boot logs clean. The game code fully and
   robustly satisfies the acceptance criteria (1021/1021 tests green) and would
   have passed with a working capture. Re-run the capture; do not edit `game/`.

VERDICT: FAIL
