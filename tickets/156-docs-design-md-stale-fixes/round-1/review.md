# Senior review: 156-docs-design-md-stale-fixes

**Ticket:** Docs — fix stale sections in `game/docs/design.md`  
**Baseline:** `02058e91d889fb84261b69ecd24f63bf67f2b3d0`  
**Commits:** `6835a2c`, `04c01e6`, `a950850` (three sub-ticket doc fixes)

## Runtime health (capture)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (also `pageerrors.json` is `[]`) |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` `pageerror` / `[fatal]` | None |
| Gameplay probe | `phase: "playing"`, canvas + hand UI, movement after W/D |

Servers started cleanly (`server.log` shows listen on 3002, dungeon layout, two players connected). Screenshots and probes show lobby → ready → in-run flow with deck UI `Deck: 8/12`, six-slot hand, and card display names matching live data (e.g. **Signal Familiar**).

`console.log` shows two `[A:error]` / `[B:error]` lines: HTTP **409 (Conflict)** on a resource load before scene init. These are not `pageerror` entries, not tagged `[fatal]`, and did not prevent load (`[initScene]` followed on both clients). Treated as benign harness/auth noise, not a game defect.

**Runtime conclusion:** Game starts and loads cleanly for this capture.

## Scope of code changes

`git diff 02058e91..HEAD` touches:

- `game/docs/design.md` — the only change under `game/`
- Three harness subticket `ticket.md` files under `tickets/156-docs-design-md-stale-fixes/subtickets/` (metadata only)

No edits under `game/server/` or `game/client/`.

## Acceptance criteria

### Only `game/docs/design.md` is modified (no `game/server/` or `game/client/`)

**Met.** The working tree diff under `game/` is limited to `game/docs/design.md`. Sub-ticket ticket files live under `tickets/` and do not affect runtime.

### At least one genuinely stale statement corrected against current code

**Met (three).** Each correction was cross-checked in the live codebase:

1. **Combat Mechanics** — Replaced incorrect “deck of up to 12” / “hand of up to 4” with lobby loadout **4–24** (default **12**) and **six** hand slots with **four** dealt at run open. Verified in `game/server/config.js` (`DECK_MIN_SIZE` 4, `DECK_MAX_SIZE` 24, `MAX_HAND_SLOTS` 6, `OPENING_HAND_SIZE` 4), mirrored in `game/client/config.js`, and opening-hand logic in `game/server/progression.js` (`initPlayerHand` / `OPENING_HAND_SIZE` loop). `STARTING_DECK_IDS` in `game/server/progression.js` has 12 entries; capture probe shows `Deck: 8/12`.

2. **Floor Geometry** — Removed stale harness reference “ticket 117” and pointed to `applyPlayerMovement` in `game/server/simulation.js`, which sets `player.y` from `sampleFloorY(_gameState.layout, result.x, result.z)` (lines ~291–323). Floor sampling modules exist at `game/shared/floorSampling.esm.js` and `game/shared/floorSampling.js` as documented.

3. **Playtesting Notes** — **Battle Familiar** → **Signal Familiar**, matching `CARD_DEFS.battle_familiar.name` in `game/server/progression.js` and capture probe hand labels.

### Existing structure and headings preserved; surgical edits only

**Met.** Same top-level sections (`Overview`, `Core Loop`, `Run Suspend / Resume`, `Combat Mechanics`, `Future Mechanics`) and subheadings (`### Floor Geometry`, `### Card Types`, `### Playtesting Notes`, etc.). No sections deleted; three short paragraph-level replacements only.

### Every edit reflects real current code/behavior (no speculative claims)

**Met for all edits made.** Deck/hand limits, floor movement implementation, and Signal Familiar naming match server/client config, simulation, and `CARD_DEFS`. No new mechanics or aspirational content was introduced.

## Consistency with `design.md` and `requirements.md`

- **`game/docs/requirements.md`:** Foundation items (3D render, WebSocket, multiplayer viz, WASD sync) are unchanged; this ticket did not touch runtime code.
- **Holistic doc accuracy:** The corrected sections now align with implementation. One **pre-existing** inaccuracy remains in the same playtesting sentence: **Mana Leach** is still cited, but `CARD_DEFS.mana_leach.name` is **Ether Siphon** (`game/server/progression.js`, `game/client/cards.js`). Sub-ticket 03 explicitly left that name unchanged; it was out of this ticket’s stated fix list. That is a minor doc nit, not a mechanics or acceptance failure for a targeted pass (see `nits.md`).

## Code quality and debug scenarios

- No runtime code changes; no new dead code or console defects attributable to this ticket.
- No new or changed `?debugScenario=` shortcuts; probes show `debugScenario: null` throughout capture.

## Verification artifacts

- **Coverage (`coverage.log`):** No tests run against changed files (docs-only); expected empty report.
- **Screenshots:** Lobby and in-run movement (W/D) look healthy; UI strings match renamed cards.

## Remaining gaps

None blocking. Runtime capture is clean; all top-level acceptance criteria are satisfied for the scoped doc-only work.

VERDICT: PASS
