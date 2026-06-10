# Senior Review: Client renderHand slot signature skip

**Ticket:** Client: renderHand rebuilds slot innerHTML on every STATE_UPDATE even when the hand is unchanged  
**Baseline:** `07732340beb068a06c74e16211af2759f5e506df`  
**Commits:** `042fae4d` (signature skip), `a83b952b` (tests)  
**Changed files:** `game/client/main.js`, `game/client/test/main.test.js`

---

## Runtime health

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `harness_failure` | absent |
| `console.log` pageerror / `[fatal]` | none |
| Gameplay capture | Lobby → ready → playing with card hand visible; movement and dodge roll exercised |

The captured run starts cleanly. The lone `409 (Conflict)` network lines in `console.log` are auth/session noise, not uncaught game exceptions. Screenshots and probes confirm a live playing session with a populated card hand (slots 1–5 showing Signal Familiar, Solar Edge, Rust-Forged Saber, Vault Wyrm, etc.).

---

## Acceptance criteria

### 1. `renderHand` performs no DOM writes when the per-slot signature is unchanged

**Met.** `slotSignature()` in `game/client/main.js` builds a deterministic string from card id, charges, `activeMinionId`, structural flags (`isEvolved`, `isDesperation`, `isEcho`, `grind`, `specialEffect`), affordability, and layout mode. Each slot caches the value on `slot.dataset._sig`.

On signature match, the per-slot loop `continue`s before:
- `getCardSlotParts()` (three `:scope` querySelectors per slot)
- `content.innerHTML = …`
- class toggles (`empty`, `no-ms`, `creature-burning`, etc.)
- hint markup updates

The only per-slot write that still runs on every `renderHand()` call is `--charge-pct` (see criterion 2), which the ticket and sub-ticket specs explicitly carve out. Hand-level work (`clearAdjacentCardHighlights`, `cardHandEl` class toggles for desperation/input mode/lock) still runs each call; that is outside the per-slot innerHTML rebuild problem this ticket targets.

Unit tests `'skips innerHTML rebuild when slot signature is unchanged'`, `'skips DOM rebuild when slot signature is unchanged'`, and `'rebuilds slot DOM when card charges change'` verify skip vs rebuild behavior.

### 2. Charge percent still animates

**Met.** `--charge-pct` is set via `slot.style.setProperty` **before** the skip guard, using `getCardChargePercent(card)` which reads live minion TTL from `gameState.minions` for burning creatures.

Test `'still updates --charge-pct on consecutive calls with same card'` mutates minion TTL between two `renderHand()` calls with an unchanged structural signature and asserts the CSS variable moves from `100` to `50`. Existing test `'uses creature burn TTL for the charge meter while a minion is active'` still passes.

### 3. Existing hand tests pass plus one covering the skip path

**Met.** Harness coverage run: **297/297** tests passed (15 files). Targeted `renderHand()` suite: **21/21** passed. Six new tests were added under `describe('renderHand()')`, including explicit skip-path and charge-pct-during-skip coverage — more than the single test the AC minimum asked for.

---

## Design & requirements alignment

- **design.md:** No change to combat rules, card types, or hand semantics. This is a client rendering optimization only; server authority and STATE_UPDATE hand reconciliation are untouched.
- **requirements.md:** 3D scene, WebSocket connection, multiplayer visualization, and movement all exercised in the capture probes (`hasCanvas`, `connectionState: connected`, squad gameplay). No foundation regression observed.

---

## Debug scenarios

This ticket did not add or modify any `?debugScenario=` shortcuts. N/A.

---

## Code quality

The implementation is focused and readable:

- `slotSignature` is a pure helper colocated with `renderHand`.
- `layoutMode` is computed once per call (minor extra win vs calling `resolveHandLayoutMode()` inside the empty-slot branch).
- Affordability is encoded in the signature so `.no-ms` class toggles still occur when MS crosses a card's cost threshold.
- Signature includes `layoutMode` so N64 vs default hint markup stays correct when layout locks change.

No dead code, no obvious logic bugs, no browser page errors.

**Intentional trade-off (in scope):** For burning creatures, only the meter bar (`--charge-pct`) animates per tick; the `.card-charges` text label (e.g. `18s/30s`) is not rewritten on skip. The ticket goal explicitly states that only `--charge-pct` needs per-tick updates — this is correct per spec, not a defect.

---

## Integration notes

`renderHand()` is still invoked unconditionally on every playing-phase STATE_UPDATE (lines ~1446–1449), which is correct: the function is now cheap when the hand is stable. Probes show MS ticking (`50.6` → `51.1`) while hand card entries remain structurally identical — exactly the hot path this fix optimizes.

---

## Remaining gaps

None. All acceptance criteria are met; the game runs cleanly in capture; tests pass.

---

VERDICT: PASS
