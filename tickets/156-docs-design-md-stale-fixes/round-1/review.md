# Senior Review: 156-docs-design-md-stale-fixes

**Ticket:** Fix stale sections in `game/docs/design.md` (surgical accuracy pass, docs-only).  
**Baseline:** `d564f545d08aad78fe9fcf5ee11597054a799956`  
**Commits:** `1ccd44c` — `156-docs-design-md-stale-fixes/01-fix-deck-and-hand-sizes: align deck/hand sizes in design.md with config constants`

---

## Runtime health (capture)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| Servers started | Yes (`http://localhost:5177/`) |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | Absent |
| `console.log` fatal / `pageerror` | None — only Vite connect, scene init, and HTTP 409 on resource load (auth/username conflict noise, not uncaught game exceptions) |

Capture reached **playing** phase with canvas, card hand, movement (W/D screenshots), 2 players, 5–6 enemies, and sensible HUD probes (`HP 100/100`, hand cards visible). The game starts and loads cleanly for this ticket.

**Debug scenarios:** None added or changed (`debugScenario: null` throughout probes). N/A.

---

## Per-criterion findings

### Only `game/docs/design.md` is modified (no `game/server/` or `game/client/` changes)

**Met.** `git diff d564f545..HEAD --name-only` under the repo shows:

- `game/docs/design.md` — the only change under `game/`
- `tickets/156-docs-design-md-stale-fixes/subtickets/01-fix-deck-and-hand-sizes/ticket.md` — harness metadata, not runtime code

No diff under `game/server/` or `game/client/`.

### At least one genuinely stale/incorrect statement corrected against current code

**Met.** The **Combat Mechanics** paragraph previously claimed a deck cap of 12 and a hand cap of 4. Current authoritative constants:

- `DECK_MAX_SIZE = 24` — `game/server/config.js`, `game/client/config.js`
- `MAX_HAND_SLOTS = 6` — `game/server/config.js`, `game/client/config.js`

Server tests explicitly assert `DECK_MAX_SIZE` is 24 (`game/server/test/server.test.js`). Capture probes show a 6-slot hand array (with nulls in unused slots), consistent with `MAX_HAND_SLOTS`.

### Existing structure and headings preserved; surgical edits only

**Met.** Single-line change inside **Combat Mechanics**; no sections removed or reordered; headings unchanged.

### Every edit reflects real current behavior (no speculation)

**Met.** Both numeric updates are directly verified against shared server/client config. No other lines in `design.md` were altered; remaining sections (floor sampling paths, Telepipe suspend/resume, card types) were spot-checked where they cite concrete files (`shared/floorSampling.esm.js`, `shared/floorSampling.js`) — those paths exist and the floor-corner description matches the sampling module’s model.

### Consistency with `game/docs/design.md` and `game/docs/requirements.md`

**Met for scope.** The doc now states deck/hand limits that match runtime. `requirements.md` covers foundational 3D/multiplayer/movement setup only; this docs-only ticket does not touch or regress that foundation. Capture confirms graphics, WebSocket play, movement, and multiplayer lobby→run flow still work.

### Code quality / console errors

**N/A for implementation** (no game code changed). Runtime capture is clean per harness rules.

### Holistic ticket goal (“clearly outdated statements in design.md”)

The top-level ticket allows a **targeted** pass, not a full audit. The sub-ticket scoped exactly two known-stale numbers; both are fixed and verified. Other project docs (e.g. repo-root `CONTEXT.md` still mentioning “hand of up to 4 cards”) and UI placeholders (`index.html` `0/12` before JS hydrates to `x/24`) are **out of acceptance scope** — noted as nits, not blocking gaps.

---

## Integration / sub-tickets

One sub-ticket (`01-fix-deck-and-hand-sizes`) delivered the full game change. No integration conflicts; no debug shortcuts introduced.

---

## Coverage

`coverage.log` reports no test files for the changed path (docs-only diff) — expected. No coverage signal for this ticket.

---

## Remaining gaps

None. Runtime proof is good; acceptance criteria are fully satisfied for the stated scope.

---

VERDICT: PASS
