# Senior Review — Ticket 128: Key Item Smoke Bomb

**Baseline:** `9abbd7e6c30aade3dab48fc2556a786884f50acb`  
**Commits:** `f6523df` (cast/zone state), `9814908` (targeting), `42c800a` (client VFX)  
**Capture:** `round-1/metrics.json` — `ok: true`, `pageerrors: []`, fallback full-flow smoke (no smoke-specific scenario).

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present and `ok: true` | Pass |
| `pageerrors` empty, no `failure_kind` | Pass |
| `console.log` — no `pageerror` / `[fatal]` | Pass (Vite connect + scene init only) |
| Dev servers started | Pass (`client.log` / `server.log` implied by successful capture) |

The captured run proves the game loads and plays through lobby → dungeon with two players. Round-1 did **not** exercise `useKeyItem` or smoke VFX in the browser; verification for this ticket is **code**-weighted (unit/integration tests), which is consistent with `ticket.md` Verification line.

## Acceptance criteria

### Cooldown ~8s

`KEY_ITEM_DEFS.smoke_bomb.cooldownMs` is **8000**. The `useKeyItem` handler sets `keyItemCooldownUntil = now + (def.cooldownMs || 8000)`. `smoke_bomb.test.js` asserts an immediate re-cast returns `{ ok: false, reason: 'on_cooldown' }` and does not refresh `smokeBombUntil`.

### Zone placement (follow vs fixed)

**Choice: fixed at cast point.** On cast, `smokeBombX` / `smokeBombZ` are stamped from `player.x` / `player.z` and are **not** updated as the player moves. Comments in `game/server/index.js`, `game/server/simulation.js`, and tests state this explicitly. Players (including allies) gain protection only while their position is within **any** living player’s active zone radius of that fixed center — co-op covered by tests.

### Client smoke VFX

`game/client/renderer.js` exports `triggerSmokeBombVFX`, `removeSmokeBombVFX`, and `getSmokeBombVFXIds`. A translucent cylinder fog column is sized to zone radius, idempotent per owner, and fades on removal. `syncSmokeBombVFX` in `game/client/main.js` reconciles VFX on every `stateUpdate` for all visible players with `smokeBombUntil > Date.now()`.

Client tests (`game/client/test/smoke-bomb-vfx.test.js`, 4 cases) pass: spawn, idempotency, fade/dispose, no-op remove.

### Tests — enemy behavior in zone

Top-level ticket allows **either** reduced ranged miss rate **or** cleared/paused targeting. Implementation chose **detection loss** (enemies cannot acquire hidden players; in-progress wind-ups cancel without damage). That matches current enemy AI (melee wind-up in `updateEnemies`, not a separate ranged miss-roll).

`game/server/test/smoke_bomb.test.js` (9 tests) covers:

- Def tuning (2s duration, 4m radius, 8s cooldown; no stale “invisible” copy)
- Socket `useKeyItem` cast + cooldown enforcement
- `isPlayerHiddenBySmoke` inside/outside/expired/dead caster
- No windup when target in zone; windup cancel + no HP loss; expired zone restores targeting; outside radius still targeted; ally zone co-op hide

All 13 smoke-related server + client tests pass when run locally.

### Goal alignment (`useKeyItem` → 2s zone at feet)

Cast sets `smokeBombUntil = now + 2000`, `smokeBombRadius = 4`, center at caster position. Description: *“Drop a cloud of fog that makes enemies lose track of you.”* Behavior matches **Smoke Veil** design intent from the ticket title.

## Design and foundation

- **design.md:** No conflict; smoke is a transient combat key item consistent with other zone items (e.g. barrier dome pattern).
- **requirements.md:** No regression to 3D render, WebSocket, multiplayer, or movement — capture probes show `phase: playing`, canvas, movement, enemies present.
- **Persistence:** `smokeBomb*` fields are in `stateSnapshot()` but **not** in `extractPersistentData()` — correct for transient combat state.
- **Dependencies (118, 121):** Uses existing `useKeyItem` pipeline and key-item cooldown HUD path; no breakage observed in shared tests touched (`key-items.test.js`, `server.test.js` snapshot fields).

## Debug scenario: `smoke-bomb-active`

| Rule | Status |
|------|--------|
| Gated to debug/dev path only | Pass — client: `?debugScenario=` on localhost/127.0.0.1 only; server: `DEBUG_SCENARIOS` + `isDebugScenarioAllowed()` |
| Normal path still reachable | Pass — equip `smoke_bomb` + `useKeyItem` in run (socket integration tests); scenario comment documents this |
| Does not weaken production invariants | Pass — scenario only applies via `debugScenario` socket on dev server; sets extended `smokeBombUntil` (60s) for VFX QA, does not bypass cooldown logic for normal `useKeyItem` |

Normal gameplay is **not** wired to the scenario; metrics show `debugScenario: null`.

## Code quality

- Clear separation: cast (`index.js` + `progression.js`), targeting (`simulation.js`), VFX (`renderer.js` + `main.js`).
- `isPlayerHiddenBySmoke` exported for tests; windup revalidation and acquisition loop both consult it.
- No dead code or obvious logic bugs in the diff; smoke removed from `not_implemented` list.
- Minor note (non-blocking): VFX mesh Y is fixed at floor `y = 0` / half column height, not `sampleFloorY()` — acceptable on flat test rooms; see nits backlog.

## Harness capture limitations (non-blocking)

Round-1 used **fallback** capture (lobby + WASD movement). Screenshots do not show smoke fog or key-item use. That is a coverage gap for **visual** regression of this feature only; it does not contradict code verification or runtime health for the foundation loop.

## Remaining gaps

None. All top-level acceptance criteria are met with tests and consistent documentation of design choices (fixed zone, detection loss, 8s cooldown).

VERDICT: PASS
