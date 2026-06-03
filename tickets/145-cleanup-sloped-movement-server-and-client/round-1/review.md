# Senior review: 145-cleanup-sloped-movement-server-and-client

**Ticket:** Unify null/NaN floor-Y fallback between client and server  
**Baseline:** `fd95d4f50d42c9eb1bffd80f6e25a8f2319effc2`  
**Commits:** `40dbfdc` (shared `resolveFloorY`), `37c7abd` (migrate call sites)  
**Capture:** `round-1/metrics.json`, `console.log`, `coverage.log`

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes — client on `:5175`, server on `:3002` |
| `pageerrors` | Empty (`[]` in metrics; `pageerrors.json` also `[]`) |
| `failure_kind` | Absent |
| `console.log` `pageerror` / `[fatal]` | None |
| Benign noise only | THREE.Clock deprecation, Vite `ws proxy` / `EPIPE` on teardown, HTTP 409 on register (duplicate harness users) |

The captured run reached `phase: "playing"`, movement probes, dodge-roll HUD, and a successful `sloped-dungeon` debug-scenario emit (`debugScenarioResult.ok: true`). The game starts and loads cleanly for this ticket.

## Acceptance criteria

### Unify `sampleFloorY` → concrete Y fallback (client and server)

**Met.** A single shared helper now owns the semantics the server previously inlined and the client expressed with `??`:

```14:16:game/shared/floorSampling.esm.js
export function resolveFloorY(sampled) {
	return Number.isFinite(sampled) ? sampled : DEFAULT_FLOOR_Y;
}
```

- **Exports:** `resolveFloorY` is returned from the CJS eval bridge (`game/shared/floorSampling.js`), re-exported from `game/client/collision.js`, and included in `game/server/dungeon.js` `module.exports`.
- **Server production paths:** `simulation.js` (`applyPlayerMovement`), all six `progression.js` respawn/teleport sites, and all `sampleFloorY`→entity-Y assignments in `index.js` (players in debug scenarios, minion Y, run-failure reposition) use `resolveFloorY(sampleFloorY(…))`.
- **Client production paths:** `renderer.js` (spawn camera look-at and local avatar mesh Y) and `dungeon.js` (treasure marker, wall base, cover boxes) use the same pattern.
- **Intentionally unchanged:** `player.y = savedData.y ?? DEFAULT_FLOOR_Y` in `index.js` — persistence restore, not floor sampling.
- **Repo hygiene:** No remaining `sampleFloorY(…) ?? DEFAULT_FLOOR_Y` under `game/`. No `Number.isFinite(…FloorY)` ternaries tied to `sampleFloorY` results (only unrelated grind/`Math.floor` uses remain).

`null`, `NaN`, `±Infinity`, and `undefined` all map to `DEFAULT_FLOOR_Y`; finite values (including `0`) pass through. This matches the ticket’s stated goal of preventing client/server drift if a layout ever supplies non-finite corner data.

### Tests

**Met.** `game/client/test/shared-floor-sampling.test.js` adds a dedicated `describe('resolveFloorY')` with null/NaN/infinity/undefined/finite cases. Migration is reflected in `applyPlayerMovement.test.js` and `dungeon.test.js`. Harness `coverage.log` records `shared-floor-sampling.test.js` and `applyPlayerMovement.test.js` passing; an independent `pnpm test:quick` run completed **1534/1534** tests (process exit 137 was post-success `tail`/OOM noise, not test failure).

## Design and requirements consistency

- **`game/docs/design.md`:** Sloped movement still correctly describes `sampleFloorY()` for height interpolation and server `applyPlayerMovement` snapping — behavior unchanged; only the fallback layer is centralized. Doc text still says “snaps via `sampleFloorY`” without naming `resolveFloorY` (nit only).
- **`game/docs/requirements.md`:** No regression to movement sync, multiplayer, or 3D render foundations; capture exercised lobby → deploy → WASD → dodge.
- **Sub-ticket scope:** Both subtickets’ acceptance criteria are satisfied in the working tree.

## Code quality

- Focused two-commit diff (~142 insertions / ~49 deletions), no dead code introduced.
- Helper is minimal, documented, and mirrors prior server semantics exactly.
- CJS bridge updated in the same change as ESM — no export drift.

## Debug scenarios

This ticket **did not add** a new `?debugScenario=` entry. Capture used the existing harness `emitScenario('sloped-dungeon')` after normal auth/lobby/ready/deploy flow.

Pre-existing `sloped-dungeon` behavior (unchanged in purpose by this ticket):

- Gated by `isDebugScenarioAllowed` (localhost / dev env / `ALLOW_DEBUG_SCENARIOS=1`; disabled in production).
- Entry only via socket `debugScenario` event (harness), not normal UI.
- Normal play already generates sloped layouts via `applyLayoutForQuest` → `generateLayout(…, { slopes: true })`; the debug scenario mid-run regen is a QA shortcut, not the only path to ramps.
- Does not skip server movement validation; `applyPlayerMovement` still uses the same `resolveFloorY` path as production.

No debug-scenario blocking issues for this cleanup ticket.

## Integration / holistic notes

- Visual QA path (movement, dodge HUD, sloped-dungeon screenshot description in metrics) aligns with sloped-movement foundation from ticket 117.
- Client visual Y and server authoritative Y now share one fallback definition, closing the `??` vs `Number.isFinite` divergence called out in the parent ticket.

## Remaining gaps

None blocking. Runtime proof and acceptance criteria are satisfied.

## Nits (non-blocking)

See `round-1/nits.md` — documentation could mention `resolveFloorY` where design docs describe player Y snapping.

VERDICT: PASS
