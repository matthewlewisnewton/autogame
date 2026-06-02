# Sunken Canyon Stage Review

## Runtime health

The captured game run starts and loads cleanly. `metrics.json` has `"ok": true`, no `pageerrors`, and no `harness_failure`; `console.log` contains only normal Vite connection logs and `[debugScenario] applied sloped-dungeon`.

The capture did not exercise the Sunken Canyon quest itself: the screenshots show the lobby card for "Sunken Canyon Trial", but gameplay entered the default Initiate Vault and then used the fallback `sloped-dungeon` debug scenario. I therefore treated the runtime capture as proof that the game runs, not proof that Sunken Canyon renders correctly.

## Acceptance criteria findings

- New stage variant selectable from `generateLayout({ stage: "sunken-canyon" })`: Satisfied. `generateLayout()` dispatches to the Sunken Canyon generator when `options.stage === "sunken-canyon"`, and the Sunken Canyon Trial quest sets `layoutStage: "sunken-canyon"`.
- Exactly two elevation bands: Partially satisfied in server layout, not satisfied in client presentation. The server layout creates one plateau at Y=10 and one canyon at Y=2, with ramp rooms between them. However, the client renderer treats any uniform `floorCorners` room as a legacy flat room and positions the plateau/canyon floor meshes at `FLOOR_Y` instead of the room's sampled Y. Players, walls, and camera use sampled Y, so the rendered floor surfaces do not actually show the two elevation bands in gameplay.
- 2-3 distinct descending ramp paths with `floorCorners` and slope >= 0.15: Satisfied in server data. The generator creates 2-3 `createRampRoom()` rooms with high north edges, low south edges, and tested slopes above the minimum.
- Total Y drop >= 8 units: Satisfied in server data. Seed 42 produces plateau center Y=10 and canyon center Y=2.
- Outer walls enclose both bands; no walk-off gaps: Satisfied by layout/collider tests, with gap-aware walls around plateau, ramps, and canyon.
- Camera follow works on both bands and ramps; plateau edge vista: Not robustly satisfied because the client floor meshes for the flat high/low bands are rendered at the wrong Y. Camera follow uses sampled player Y, but the player/camera are detached from the visible plateau/canyon floor surfaces.
- Enemy spawns distributed with at least one plateau spawn and canyon majority: Satisfied. The Sunken Canyon spawn plan allocates one plateau enemy, a canyon majority, and remaining ramp spawns; tests verify positions and sampled enemy Y.
- Objective/exit on canyon floor, reachable on foot from plateau: Satisfied at the layout role level. The canyon room is assigned `treasure`, and tests verify reachability from the plateau spawn to the treasure room center.
- Deterministic given a seed: Satisfied. The generator and cover scatter are deterministic for repeated seeds.
- Unit tests cover required properties: Mostly satisfied. There are targeted tests for two bands, ramp slopes, drop height, reachability, roles, cover placement, spawn distribution, and camera height on ramps. The missing coverage is the client rendering invariant for uniform non-default `floorCorners`; current client tests explicitly expect all uniform floors to render at `FLOOR_Y`, which masks the Sunken Canyon visual bug.

## Design and regression notes

The server-side layout is consistent with `game/docs/design.md`'s `floorCorners` model and does not regress the basic client/server/movement requirements. Normal quest selection and deployment are wired through the lobby quest board, and the `sunken-canyon` debug scenario is reachable only through the debug scenario socket path. The same end state is reachable through normal quest selection because the Sunken Canyon Trial quest uses the same staged layout path.

Coverage visibility: the recorded coverage run failed one unrelated `server/test/overclock.test.js` assertion (`findWeaponSlot` returned -1). That failure is outside the Sunken Canyon implementation surface and is not the blocking gap for this ticket.

## Remaining gaps

1. Sunken Canyon flat band floors render at the wrong elevation. The plateau and canyon room floor meshes are drawn at `FLOOR_Y` even though their `floorCorners` are Y=10 and Y=2, while players/walls/camera use sampled Y. This prevents the live stage from visually presenting the required two elevation bands and reliable plateau/canyon camera experience.

VERDICT: FAIL
