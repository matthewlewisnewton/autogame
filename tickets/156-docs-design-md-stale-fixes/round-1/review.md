# Senior review: 156-docs-design-md-stale-fixes

**Ticket:** Fix stale deck/hand size statements in `game/docs/design.md`  
**Baseline:** `ce7f511b9cf69ba474cc08475e19a4c7968164a0`  
**Commits:** `dd0b1e2` (deck 12→24), `4ced005` (hand 4→6)

## Runtime health (capture proof)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `ok` | `true` |
| `pageerrors` | `[]` |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` | Vite connect + `[initScene]` only; no `pageerror` or `[fatal]` lines |

Capture reached gameplay (`phase: playing`, canvas, card hand, movement probes after W/D). Screenshots show lobby → in-dungeon flow. The run is valid proof that doc-only changes did not break the game.

**Note:** In-run HUD shows `Deck: N/12` (draw pile remaining / run deck size), not `DECK_MAX_SIZE`. That label is unrelated to the loadout cap corrected in the design doc.

## Per-criterion findings

### Only `game/docs/design.md` is modified (no `game/server/` or `game/client/`)

- **Game tree:** `git diff ce7f511..HEAD` touches only `game/docs/design.md`. No server or client source changes.
- **Branch diff:** Also adds `tickets/156-docs-design-md-stale-fixes/subtickets/01-fix-deck-size/ticket.md` and `.../02-fix-hand-size/ticket.md` (harness decomposition metadata, not game code). Literal wording of the AC names only the design doc; see nit on branch hygiene below.

### At least one genuinely stale statement corrected

**Met.** The Combat Mechanics intro previously said deck “up to 12” and hand “up to 4”. Both were wrong versus config:

- `DECK_MAX_SIZE = 24` — `game/server/config.js`, `game/client/config.js`
- `MAX_HAND_SLOTS = 6`, `OPENING_HAND_SIZE = 4` — same files; 4 is opening deal size, not max hand capacity

`gameplay-review.md` already described six slots / four at open; `design.md` now matches.

### Structure and headings preserved

**Met.** Single-line surgical edit in `## Combat Mechanics`; no sections removed or reordered.

### Every edit reflects real current behavior (no speculation)

**Met.** Values cross-checked against `config.js` on server and client and usage in `game/server/progression.js` / `game/client/hand.js` (`hand` arrays sized to `MAX_HAND_SLOTS`, deck validation capped at `DECK_MAX_SIZE`). Capture probes show a five-to-six-slot hand layout consistent with six max slots (some null slots).

### Consistency with `design.md` / `requirements.md`

- **requirements.md:** Foundation (3D render, WebSocket, multiplayer, WASD sync) unchanged; no code regressions.
- **Remaining design.md content:** Not exhaustively re-audited (ticket scope is targeted touch-ups, not full doc audit). No other obvious numeric staleness on deck/hand in the edited file. Telepipe, floor geometry, and card-type sections were not part of this ticket and were not re-verified line-by-line.

### Code quality / debug scenarios

- No runtime code changes; no new `?debugScenario=` shortcuts.
- Coverage run on changed files since baseline reported 0% (no tests matched changed paths — expected for a markdown-only game change).

## Integration (sub-tickets)

Sub-tickets `01-fix-deck-size` and `02-fix-hand-size` compose cleanly: one shared sentence in `design.md` carries both corrections. No conflicting edits or integration gaps.

## Remaining gaps

None blocking. Runtime is clean; acceptance criteria for the design-doc accuracy pass are satisfied.

## Nits (non-blocking)

- Branch includes harness subticket `ticket.md` files outside `game/docs/design.md` (see `nits.md` if filed).

VERDICT: PASS
