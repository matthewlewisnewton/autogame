# Senior Review: 155-gameplay-review-doc

**Ticket:** Gameplay Review — Improvements & Simplifications Doc  
**Baseline:** `aa963b34eaad3701c4de5ea56af2bb4b368d178d`  
**Commits:** `8c7d0de` → `7893ae3` (four sub-ticket commits, one deliverable file under `game/`)

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok": true` | Yes |
| Servers started | Yes (client on `:5175`, probes show `phase: "playing"`) |
| `pageerrors` | Empty `[]` |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` | Only Vite connect and `[initScene]` logs; no `pageerror` or `[fatal]` lines |
| `pageerrors.json` | `[]` |

Capture shows a full smoke flow: auth, two-player lobby, ready/deploy, dungeon with canvas, card hand, enemies, movement (W/D screenshots), and probes with HP/MS/objective HUD text consistent with live systems. Benign infra noise only (no THREE.js deprecation or WebGL context-loss lines in the short console capture).

**Runtime gate: PASS** — the game starts and loads cleanly for this ticket’s verification run.

## Diff scope

```
game/docs/gameplay-review.md   (+199 lines)
tickets/.../subtickets/*/ticket.md   (harness sub-ticket metadata only)
```

Under `game/`, the only change is `game/docs/gameplay-review.md`. No edits to `game/server/`, `game/client/`, or other runtime assets. Matches the ticket’s “analysis only” intent and Technical Spec.

## Acceptance criteria

### New file `game/docs/gameplay-review.md` only (no runtime code)

**Met.** `git diff aa963b34..HEAD --name-only` under `game/` lists a single new file. Sub-ticket `ticket.md` files under `tickets/` are harness bookkeeping, not game runtime.

### Required sections, in order

**Met.** The document uses exactly this top-level sequence:

1. `## Current gameplay` — long, code-grounded summary (auth, lobby browser, create/join/drop-in, squad lobby, telepipe suspend/resume, cards/hand/MS, dungeon/movement, combat, key item, loot/co-op).
2. `## Improvements` — **8** proposals (minimum 6).
3. `## Simplifications` — **6** proposals (minimum 4).
4. `## Prioritized shortlist` — **5** items with one-line justifications, ordered.

Each improvement includes idea, why, touches (files/systems), and effort (S/M/L). Each simplification includes what to simplify, why, and lost/gained tradeoffs.

### Proposals grounded in this game

**Met.** Spot-checks against the live tree:

- `MAX_HAND_SLOTS` / `OPENING_HAND_SIZE` (6 / 4) and `PASSIVE_DRAW_INTERVAL_MS` (5000) in `game/server/config.js` match the Current gameplay and Improvement §3 text.
- `DECK_MIN_SIZE` 4 / `DECK_MAX_SIZE` 24 and default 12-card loadout (see `integration.test.js`) match §Cards.
- `battle_familiar` / `mana_leach`, Telepipe (`PORTAL_PLACEMENT_GRACE_MS`, `tryEnterTelepipe`), lock-on (`lockOn.js`, `settings.js`), drop-in (`initializePlayerForActiveRun`), and `validateDeck` / `deckError` paths all exist where cited.
- Proposals reference concrete IDs (`iron_sword`, `flame_blade`, `dungeon_drake`), UI hooks (`#deck-error`, `#abandon-run-btn`, `renderSuspendedRunBanner`), and server modules (`progression.js`, `simulation.js`, `lobbies.js`) — not generic “add more content” advice.

The capture probe hand data (Rust-Forged Saber, Solar Edge, Signal Familiar, Vault Wyrm, objective “Purge hostiles…”) aligns with names in `CARD_DEFS` / client cards and the documented loop.

### Self-contained and readable

**Met.** Opens with purpose; does not require reading sub-tickets. A human reviewer can use it standalone.

## Consistency with `game/docs/design.md` and `requirements.md`

**No foundation regression.** This ticket does not change gameplay code. The review accurately reflects design themes (PSO lobby/dungeon, LK-style cards, telepipe suspend/resume, four card types, spell/weapon overlap playtesting note) and cites `design.md` where relevant (e.g. Improvement §1, Simplification §1).

**Intentional code vs design nuance:** `design.md` describes a deck of “up to 12 cards”; server `DECK_MAX_SIZE` is 24. The review documents **4–24** from `validateDeck` / `config.js`, which is correct for implementation-grounded analysis and is called out in Simplification §2 (six visible hand slots vs “four-card hand” marketing). That honesty supports the ticket goal; it is not a defect.

`requirements.md` items (3D scene, WebSocket connect, multiplayer presence, WASD sync) remain satisfied by the captured run (canvas, connected, movement probes, two players).

## Code quality and debug scenarios

No runtime code was modified; no new `?debugScenario=` shortcuts. Probes report `debugScenario: null` throughout. Nothing to gate or trace for debug bypass.

Unit coverage on changed files: `coverage.log` reports no files changed since baseline (expected for a docs-only diff).

## Per-criterion summary

| Criterion | Status |
|-----------|--------|
| `gameplay-review.md` exists, sole `game/` change | Pass |
| Section order and minimum counts | Pass |
| Grounded, game-specific proposals | Pass |
| Self-contained document | Pass |
| Game runs cleanly in capture | Pass |
| No runtime / requirements regression | Pass |

## Remaining gaps

None. No blocking gaps for acceptance or runtime health.

## Nits (non-blocking)

See `nits.md` for optional follow-ups (design-doc deck cap vs code, minor doc depth on run objectives).

VERDICT: PASS
