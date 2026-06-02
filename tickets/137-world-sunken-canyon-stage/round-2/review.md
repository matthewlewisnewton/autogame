# Senior Review: Sunken Canyon Stage

## Runtime health

The captured game run is clean. `metrics.json` reports `"ok": true`, servers started, `pageerrors` is empty, and `pageerrors.json` is `[]`. `console.log` contains no `pageerror` or `[fatal]` lines from game code; the only notable console noise is a 409 auth/register conflict and benign Vite/WebSocket shutdown noise in the server/client logs.

Coverage/test visibility is strong for this ticket: `coverage.log` ends with 38 passing test files and 1095 passing tests. The captured screenshots confirm the game loaded into lobby and gameplay, but the fallback capture exercised `sloped-dungeon`, not the new sunken-canyon debug scenarios.

## Acceptance criteria findings

- New stage variant selectable from `generateLayout({ stage: "sunken-canyon" })`: **blocking gap**. The implementation supports `generateLayout(seed, "sunken-canyon")` and the `sunken_canyon` quest path, but the exact ticket API does not select the new stage. Directly invoking `generateLayout({ stage: "sunken-canyon" })` returns `profile: "default"`, no band metadata, and no `stageMeta`.
- Two elevation bands and canyon floor size: Met through the implemented `generateSunkenCanyon()` path. It creates one uniform high plateau at Y=10, one uniform lower canyon at Y=1, and a 32 x 32 canyon floor, which is above the 4x default-room area threshold.
- Ramp paths and descent: Met for the implemented profile path. Seeds generate 2 or 3 ramp rooms, each carries `floorCorners`, descends from plateau to canyon, and the average slope is covered by tests at >= 0.15. The total drop is 9 units.
- Outer walls and walk-off prevention: Met in the implemented profile path. Plateau and canyon perimeter tests verify only ramp-mouth gaps, and ramp side walls enclose the descent paths.
- Camera and vista: Met in code and tests. Client rendering honors elevated floor Y for flat rooms, parapet-height south plateau walls preserve the vista, and camera orbit target now follows the sampled player Y on plateau/ramp/canyon elevations.
- Enemy distribution: Met for the `sunken_canyon` quest path. The spawn code guarantees at least one plateau enemy and places the majority in the canyon for the configured 4-enemy quest.
- Objective/exit on canyon floor: Acceptable for the current objective model. The quest is a defeat-enemies objective, with the combat focus in the canyon; treasure/objective anchoring helpers and crystal objective tests place canyon objectives inside the canyon floor if the collect-objective path is used.
- Determinism: Met for the implemented profile path. Layout and cover tests compare fixed seeds, and spawn distribution is tested as deterministic.
- Unit test coverage: Mostly met. Tests cover bands, ramp slope, drop, BFS connectivity, perimeter walls, cover reachability, enemy/objective placement, and camera behavior. The missing test is for the exact `generateLayout({ stage: "sunken-canyon" })` selector.

## Design and regression review

The implementation is consistent with `game/docs/design.md`: it uses `floorCorners` and `sampleFloorY()` for sloped ramps and player/camera elevation. It does not regress the foundation requirements in `game/docs/requirements.md`; the captured run shows rendering, socket connectivity, multiplayer presence, and movement still work.

The new `sunken-canyon-stage` and `sunken-canyon-floor` debug scenarios are behind the existing debug-scenario URL/socket path and server allowlist. They call the normal `sunken_canyon` quest layout path, so the same stage remains reachable through normal quest selection; they do not replace the normal flow or bypass persistence/net replication beyond the established QA shortcut behavior.

## Remaining gaps

1. The ticket's requested public selector is not implemented: `generateLayout({ stage: "sunken-canyon" })` returns the default layout instead of the Sunken Canyon layout.

VERDICT: FAIL
