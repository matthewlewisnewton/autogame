# Senior review: hub deck HUD always shows Deck 0/0

**Ticket:** `playability-ux-hub-deck-hud-always-shows-deck-0-0-never-upda-2v2m`  
**Baseline:** `99007f0d2935dbcca25e0e9dca609e3b567a4a23`  
**Implementation commit:** `13200844` — call `updateDeckStats` in lobby phase  
**Changed files:** `game/client/main.js`, `game/client/socketHandlers/lobbyHandlers.js`

## Runtime health

| Check | Result |
| --- | --- |
| `metrics.json` present, `ok: true` | Pass |
| `pageerrors` empty | Pass |
| `console.log` — no `pageerror` / `[fatal]` from game code | Pass (benign 401 on pre-auth REST, socket reconnect warnings, Vite connect) |
| Servers started, gameplay probes ran | Pass (movement, dodge, combat; `Deck: 8/12` in playing-phase `bodyText`) |

The captured run proves the game starts and plays cleanly. No harness infrastructure failure.

## Per-criterion findings

### 1. Hub HUD shows actual selected-deck size and type breakdown (top-level goal)

**Not met for players.**

The JavaScript plumbing is in place:

- `syncVanguardHud()` now calls `updateDeckStats(mySelectedDeck, [], myInventory)` when `gamePhase === 'lobby'` (`main.js` ~2196–2198).
- `DECK_UPDATE` refreshes the HUD in lobby via the `else` branch (`lobbyHandlers.js` ~52–53).
- `applyLobbyJoinedData()` sets `mySelectedDeck` / `myInventory` before calling `syncVanguardHud(lobbyMe, 'lobby')` (~987–988, 1068), so the DOM can be updated on hub entry.

However, **`#deck-stats-panel` (which contains `#deck-count` and the type breakdown) is `display: none` whenever `body[data-phase="lobby"]`** (`style.css` 2031–2035). `syncVanguardHud` always sets `document.body.dataset.phase = gamePhase`, so standing in the 3D hub after join hides the deck strip entirely.

Round-1 screenshot `01-initial.png` (hub, lobby phase, `lobbyVisible: false`) shows HP/currency/latency but **no deck count or type icons** — matching the CSS rule, not the ticket's expected UX.

The top-level ticket asks that the hub HUD *reflect* deck size to new players so they know they can deploy. Updating hidden DOM text does not satisfy that player-facing goal.

### 2. `syncVanguardHud()` lobby branch (sub-ticket AC)

**Met in code.** The `else if (gamePhase === 'lobby')` branch matches the spec and uses the correct inputs (`mySelectedDeck`, empty hand, `myInventory`).

### 3. `#deck-count` text correct in hub (sub-ticket AC)

**Partially met — DOM only, not verified in capture.**

Logic is sound: with a 12-card `mySelectedDeck` and empty hand, `computeDeckHudStats` yields `Deck: 12/12`. The fallback capture never probes lobby phase; all probes are `phase: "playing"`. Screenshot evidence does not show `#deck-count` at all in the hub because the panel is hidden.

### 4. `DECK_UPDATE` refreshes HUD out of run (sub-ticket AC)

**Met in code.** Lobby-phase deck-editor edits will call `updateDeckStats` before `renderDeckEditor()`.

### 5. Existing tests pass

**Met.** `coverage.log` reports 349 client tests passed (24 files); full suite was green in sub-ticket QA.

### 6. Consistency with `design.md` / `requirements.md`

**No regression.** Lobby deck management remains server-validated; this is client HUD wiring only. Foundation requirements (3D scene, socket connect, movement) hold in capture.

### 7. Debug scenarios

**N/A.** No new `?debugScenario=` shortcuts added.

## Code quality

- Minimal, focused diff; reuses existing `updateDeckStats` / `computeDeckHudStats` pipeline.
- In-run `playing` path unchanged.
- Minor edge: `syncVanguardHud` early-returns without `updateDeckStats` when `!me` in lobby (~2184–2187); unlikely on normal join but leaves a stale DOM if hit.

## Capture gaps (informational)

- `screenshot.log` notes timeouts waiting for `#lobby` visibility (hub uses dismissed-menu flow); expected for this UX.
- No lobby-phase probe of `#deck-count` `textContent` or computed visibility — harness cannot attest to the ticket's primary fix in the state where it matters.

## Remaining gaps

1. **Blocking:** `#deck-stats-panel` is CSS-hidden in lobby, so hub players still cannot see deck size/breakdown despite the JS fix. Top-level expected UX is unmet.
2. **Non-blocking:** No automated test or capture probe asserts lobby `#deck-count` after hub join.

## Nits (backlog)

See `nits.md` — lobby-phase test/probe coverage and the `!me` early-return edge.

VERDICT: FAIL
