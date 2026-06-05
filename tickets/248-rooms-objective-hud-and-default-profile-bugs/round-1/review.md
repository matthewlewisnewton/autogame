# Senior Review — 248-rooms-objective-hud-and-default-profile-bugs

**Ticket:** Two playtest bugs — objective HUD hardcoded for defeat-enemies progress, and `'default'` layout profile silently resolving to crowded tuning.

**Commits reviewed:** `820b5739` (objective HUD by type), `6f24d6db` (default layout profile alias), on baseline `6163bbd`.

---

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | absent |
| `console.log` fatal/pageerror | None — only Vite connect and `[initScene]` logs |

Servers started cleanly (Vite on `:5174`, game server on `:3001`). Browser capture reached `playing` phase with canvas, card hand, and objective HUD visible. Probe body text shows `Purged 0 / 5 hostiles` for the default `defeat_enemies` training run — correct for that objective type.

Benign noise only: THREE.Clock deprecation warnings and Vite `ws proxy` / `EPIPE` on socket close (ignored per harness rules).

**Runtime gate: PASS**

---

## Acceptance criterion (a) — Objective HUD branches on `obj.type`

**Requirement:** `collect_items` quests must not show `Purged undefined/undefined hostiles`; branch on objective type in `updateObjectiveHud()`.

**Finding: SATISFIED**

`updateObjectiveHud()` in `game/client/main.js` now branches on `obj.type`:

- **`collect_items`:** Uses `THEME.objectives.collectPrismsProgress` (`"{collected}/{total} prisms"`) with null-safe `collectedItems` / `totalItems`, matching the suspended-run banner pattern in `renderSuspendedRunBanner()` (~lines 590–593).
- **`defeat_enemies`:** Keeps the hostiles line with null coalescing (`?? 0`).
- **Other types (`survive`, etc.):** Shows quest title only (no progress line that reads wrong enemy fields).

Client vitest in `game/client/test/main.test.js` (`describe('updateObjectiveHud()')`) asserts:

- `collect_items` → contains `2/5 prisms`, no `hostiles` or `undefined`, hides outside `playing`.
- `defeat_enemies` → contains `Purged 1 / 5 hostiles`.

Harness smoke capture exercised `defeat_enemies` only (training caverns default quest); `collect_items` HUD is covered by unit tests, not browser capture. That is sufficient for this ticket given explicit test requirement in acceptance criteria.

---

## Acceptance criterion (b) — `'default'` layout profile alias

**Requirement:** String `'default'` must resolve to `DEFAULT_LAYOUT_PROFILE`, not crowded fallback.

**Finding: SATISFIED**

`game/server/dungeon.js` adds an explicit `default` entry to `LAYOUT_PROFILES` spreading `DEFAULT_LAYOUT_PROFILE` with no crowded/open overrides. `normalizeLayoutProfile('default')` now returns `cellSpacing: 20` and `targetRoomFraction: 0.6` (not crowded's 18 / 0.65). `generateLayout(42, 'default')` sets `layout.profile === 'default'`, uses default cell spacing, and produces different geometry than `generateLayout(42, 'crowded')`. `decorateCrowdedLayout` remains gated on `profile === 'crowded'` only.

Server vitest in `game/server/test/dungeon.test.js` (`describe('layout profiles')`) covers alias normalization, layout generation diff vs crowded, and passing `DEFAULT_LAYOUT_PROFILE` object unchanged.

---

## Tests and verification

- **`pnpm test:quick` (reviewer re-run):** 126 files, 2162 tests — all passed.
- **`round-1/coverage.log`:** Partial harness run reported 1 unrelated flaky failure (`Spawner periodic spawn > add is placed within ~3 units of spawner` — float tolerance 3.049 vs 3.01). Not introduced by this ticket; full suite passes on re-run.
- **Design / requirements:** Changes are localized bug fixes; no regression to foundation requirements (3D render, WebSocket connect, multiplayer, movement sync all demonstrated in capture).

---

## Debug scenario — `collect-prisms-progress`

Added in `game/server/debugScenarios.js` and registered in `DEBUG_SCENARIOS` (`game/server/index.js`).

| Check | Result |
|-------|--------|
| Gated behind debug/dev path | Yes — client only emits on `?debugScenario=` when hostname is localhost/127.0.0.1; server `isDebugScenarioAllowed()` requires loopback or `ALLOW_DEBUG_SCENARIOS=1`. |
| Normal path still reachable | Yes — selects `crystal_rescue` (Prism Salvage, `collect_items`), deploys through standard `enterPlayingPhase` / `startDungeonRun`; same end-state reachable by quest select + prism collection in dungeon. |
| Does not weaken invariants | Acceptable — still runs deck validation and full run start; only patches `collectedItems` on an active `collect_items` run for HUD QA (same pattern as `quest-objective-near-complete`). Does not skip net replication or persistence paths used in normal play. |

No blocking issues with the debug shortcut.

---

## Code quality

- Changes are minimal and follow existing patterns (theme strings, `LAYOUT_PROFILES` structure, debug scenario conventions).
- No dead code introduced; the previously dead `'default'` alias is now wired correctly.
- No browser page errors or console fatals in capture.

---

## Remaining gaps

None. Both acceptance criteria are met with targeted tests; the captured run proves the game loads and plays cleanly.

---

VERDICT: PASS
