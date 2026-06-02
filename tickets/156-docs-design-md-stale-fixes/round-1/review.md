# Senior Review: 156-docs-design-md-stale-fixes

## Runtime health

Capture succeeded and the game loads cleanly.

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json.ok` | `true` |
| Servers started | Yes (Vite on `:5177`, server on `:3004`) |
| `pageerrors` | Empty `[]` |
| `failure_kind` | Absent |
| `console.log` | Only Vite connect lines and `[initScene]` — no `pageerror` or `[fatal]` entries |

Probes confirm normal gameplay: two players connected, phase `playing`, canvas rendered, 6-slot hand with 4 filled cards (`Deck: 8/12` in UI reflects draw pile, not max deck), movement changed player position between probes (HP 100→94 from combat). Benign THREE.js deprecation warnings and Vite `EPIPE` on socket close in `client.log` are ignored per harness rules.

## Commits (baseline `9c891c78` → HEAD)

```
9f2020c 156-docs-design-md-stale-fixes/02-fix-stale-names: fix stale resource and card names in design.md
b33aee2 156-docs-design-md-stale-fixes/01-fix-wrong-numbers: correct deck/hand sizes in design.md
```

Only `game/docs/design.md` changed under `game/`; two subticket spec files were added under `tickets/`.

---

## Acceptance criteria

### Only `game/docs/design.md` is modified (no changes under `game/server/` or `game/client/`)

**Met.** `git diff 9c891c78..HEAD --name-only` lists exactly one file under `game/`: `game/docs/design.md`. No runtime code was touched.

### At least one genuinely stale/incorrect statement is corrected to match current behavior

**Met.** Four distinct stale areas were corrected (two sub-tickets):

1. **Deck/hand sizes** — "deck of up to 12 cards" / "hand of up to 4 cards" → **24** / **6** (with opening deal **4**). Verified against `DECK_MAX_SIZE = 24`, `MAX_HAND_SLOTS = 6`, and `OPENING_HAND_SIZE = 4` in both `game/server/config.js` and `game/client/config.js`. Server tests assert `DECK_MAX_SIZE === 24` and hands of length 6.

2. **Resource naming** — "Magic Stones" (3 occurrences) → **Mystic Signal**. Verified against `game/shared/theme.json` (`resource.full: "Mystic Signal"`). Capture probe shows `MS 49/99` in the HUD, consistent with the themed label.

3. **Example card names** — "Battle Familiar" → **Signal Familiar** (`game/server/progression.js` line 111, `game/client/cards.js` line 24); "Mana Leach" → **Ether Siphon** (`game/client/cards.js` line 284, `game/server/progression.js` line 474). Capture probe shows "Signal Familiar" in the live hand.

4. **Telepipe cost wording** — "costs 0 Magic Stones" → "costs 0 Mystic Signal". Verified `magicStoneCost: 0` on the `telepipe` card in both `progression.js` and `cards.js`.

### The doc's existing structure and headings are preserved

**Met.** Diff is four inline text substitutions within existing sections (`Run Suspend / Resume`, `Combat Mechanics`, `Card Types`, `Playtesting Notes`). No headings added, removed, or reordered. No sections deleted.

### Every edit reflects real current code/behavior (no speculative or aspirational claims)

**Met.** Each changed value was cross-checked against config constants, card definitions, and theme JSON. Unchanged sections (core loop, floor geometry, telepipe suspend/resume flow, four card types) remain consistent with the codebase — e.g. `floorCorners` / `sampleFloorY()` in `shared/floorSampling.esm.js`, checkpoint capture in `progression.js`.

---

## Design consistency

- **vs `game/docs/requirements.md`**: No regression. Requirements cover 3D rendering, WebSocket connectivity, multiplayer visualization, and WASD movement — all still exercised by the capture run.
- **vs live code**: The corrected statements now match authoritative sources (`config.js`, `theme.json`, card registries). Remaining doc content outside the edit scope (lobby flow, telepipe mechanics, card-type taxonomy) aligns with server/client implementation.
- **Debug scenarios**: Not applicable — this ticket did not add or change any `?debugScenario=` shortcuts.

---

## Code quality

Docs-only ticket; no game code changes. The captured run proves no runtime regressions were introduced. Coverage log shows no tests run on changed files (expected — markdown is not in the vitest include paths).

---

## Remaining gaps

None. The ticket scoped a targeted accuracy pass on known-stale deck/hand numbers and renamed resources/cards; those corrections are verified and complete. Broader staleness elsewhere in `design.md` (if any) is explicitly out of scope per the ticket goal ("not a full audit").

VERDICT: PASS
