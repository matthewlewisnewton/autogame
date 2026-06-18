# Senior review: hub deck HUD always shows Deck 0/0

**Ticket:** `playability-ux-hub-deck-hud-always-shows-deck-0-0-never-upda-2v2m`  
**Baseline:** `99007f0d2935dbcca25e0e9dca609e3b567a4a23`  
**Implementation commits:** `13200844` (lobby `updateDeckStats` wiring), `d795a6e7` (reveal `#deck-stats-panel` in lobby CSS)  
**Changed files:** `game/client/main.js`, `game/client/socketHandlers/lobbyHandlers.js`, `game/client/style.css`

## Runtime health

| Check | Result |
| --- | --- |
| `metrics.json` present, `ok: true` | Pass |
| `pageerrors` empty | Pass |
| `console.log` — no `pageerror` / `[fatal]` from game code | Pass (benign 401 on pre-auth REST, socket reconnect warnings, Vite connect) |
| Servers started, gameplay probes ran | Pass (movement, dodge, combat; playing-phase probes show `Deck: 8/12` → `Deck: 7/12`) |

The captured run proves the game starts and plays cleanly. No harness infrastructure failure.

## Per-criterion findings

### 1. Hub HUD reflects actual selected-deck size and type breakdown (top-level goal)

**Met.**

Round-2 hub screenshot `01-initial.png` (lobby phase, dismissed-menu hub) shows **`Deck: 12/12`** with type breakdown (⟡ 7, ✦ 3, 🐉 2, ✨ 0) in the top-left Vanguard HUD — the exact player-facing fix the ticket describes. This replaces round-1's hidden panel regression.

The two-part fix is integrated:

1. **JS:** `syncVanguardHud()` calls `updateDeckStats(mySelectedDeck, [], myInventory)` when `gamePhase === 'lobby'`; `DECK_UPDATE` refreshes the HUD out of run via the `else` branch in `lobbyHandlers.js`.
2. **CSS:** `#deck-stats-panel` was removed from the `body[data-phase="lobby"]` hide rule; `#ms-bar-container`, `#status-effect-strip`, and `#objective-hud` remain hidden in lobby as intended.

Lobby semantics are correct: with an empty hand and a 12-card `mySelectedDeck`, `computeDeckHudStats` yields `Deck: 12/12` (full loadout size, not draw-pile remainder).

### 2. `syncVanguardHud()` lobby branch (sub-ticket 01)

**Met.** The `else if (gamePhase === 'lobby')` branch uses `mySelectedDeck`, empty hand, and `myInventory` — matching the spec. `applyLobbyJoinedData()` and `stateHandlers` both call `syncVanguardHud(me, 'lobby')` on hub entry and lobby-phase state updates.

### 3. `#deck-count` text correct in hub (sub-ticket 01)

**Met.** Screenshot and DOM wiring confirm `Deck: 12/12` for the starter loadout. In-run behavior is unchanged: playing-phase probes show `Deck: 8/12` and `Deck: 7/12` as cards move into hand.

### 4. `DECK_UPDATE` refreshes HUD out of run (sub-ticket 01)

**Met.** Lobby-phase deck-editor edits call `ctx.updateDeckStats(ctx.mySelectedDeck, [], ctx.myInventory)` before `renderDeckEditor()`.

### 5. `#deck-stats-panel` visible in lobby (sub-ticket 02)

**Met.** `style.css` no longer hides `#deck-stats-panel` under `body[data-phase="lobby"]`. Hub screenshot confirms the panel is visible alongside HP/currency/latency.

### 6. Existing tests pass

**Met.** `coverage.log` reports 349 client tests passed (24 files). No new test failures from the changed files.

### 7. Consistency with `design.md` / `requirements.md`

**No regression.** Lobby deck management remains server-validated; changes are client HUD display only. Core loop (auth → lobby → deploy → dungeon) exercises normally in capture. MS bar correctly stays hidden in hub (combat-only resource).

### 8. Debug scenarios

**N/A.** No new `?debugScenario=` shortcuts were added.

## Code quality

- Minimal, focused diff across three files; reuses existing `updateDeckStats` / `computeDeckHudStats` pipeline.
- In-run `playing` path unchanged.
- `stateHandlers.js` line-128 comment ("MS/deck/portrait in-run only") is now stale — deck stats also update in lobby via `syncVanguardHud`; cosmetic only (see nits).

## Capture notes

- Fallback capture plan (`capturePlanSource: "fallback"`) still probes only `playing` phase for deck text, but hub screenshot `01-initial.png` provides direct visual proof of the lobby fix.
- Playing-phase deck counts (`8/12`, `7/12`) confirm no in-run regression.

## Remaining gaps

None. Round-1's blocking CSS hide was resolved in commit `d795a6e7`; JS wiring from `13200844` is now player-visible.

VERDICT: PASS
