# Senior review: 224-data-unify-game-state-factories

**Ticket:** Unify `createGameState` and `createLobbyGameState` so lobby-created god-state matches the canonical shape.  
**Baseline:** `93ea6efc98bdc9dd92f16c4dd40672b3aa05c1e8`  
**Commits:** `8a3e9fc` (extract shared factory), `9c1d68d` (parity smoke tests)

---

## Runtime health (capture proof)

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (also confirmed in `pageerrors.json`) |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` `pageerror` / `[fatal]` | None |

Capture used the fallback full-flow plan: two players in squad lobby → ready → gameplay with WASD movement and dodge-roll (cooldown HUD visible in probe at `04-after-dodge.png`). Probes show `phase: "playing"`, `sceneInitialized: true`, `connectionState: "connected"`, five enemies, dodge cooldown toggling — consistent with a healthy lobby-created state entering combat.

Benign noise only: Vite connect lines and HTTP 409 on a resource load during dual-player auth (no uncaught exceptions, no `[fatal]`).

---

## Acceptance criterion 1 — Single factory / delegation

**Requirement:** `createLobbyGameState` delegates to `createGameState` (or both share one factory) so the shape is defined once.

**Finding: Met.**

- New module `game/server/game-state.js` owns the canonical `createGameState()` body (all fields from the former `index.js` definition, including `enchantments`, `lobby`, `_pendingVolatileExplosions`).
- `game/server/index.js` imports `{ createGameState }` from `./game-state` and still initializes the module singleton with it.
- `game/server/lobbies.js` imports the same function and sets `const createLobbyGameState = createGameState` (identity alias, not a second object literal). `createLobby()` calls `createLobbyGameState()` at line 78.

No duplicate factory implementations remain under `game/server/` (only `game-state.js` defines the function body). Dependency direction is safe: `game-state.js` requires only `./quests`, avoiding the `index.js` ↔ `lobbies.js` cycle described in the subticket spec.

---

## Acceptance criterion 2 — Smoke test key parity

**Requirement:** Test asserting both factories produce the same key set.

**Finding: Met.**

`game/server/test/server.test.js` adds `describe('state factory parity')` with:

1. `Object.keys(createGameState())` vs `Object.keys(createLobbyGameState())` sorted equality.
2. Explicit checks that `enchantments`, `lobby`, and `_pendingVolatileExplosions` are arrays on both factory outputs.

Existing `describe('createGameState()')` and `lobbies.test.js` `createLobbyGameState starts with empty players and lobby phase` still pass. Independent run: `pnpm test:quick` — **1716 tests passed** (78 files).

Harness `coverage.log` (changed-files subset) reports 914 tests passed; coverage table lists `index.js` only for server changes — expected for a small extraction where `game-state.js` is exercised transitively.

---

## Design & requirements alignment

- **`game/docs/design.md`:** No conflict. Multi-lobby flow and combat systems that read `enchantments` / push `_pendingVolatileExplosions` now receive defined arrays on lobby-created state — directly addresses the latent bug described in the ticket.
- **`game/docs/requirements.md`:** No regression to foundation (3D render, WebSocket connect, multiplayer presence, movement sync). Capture demonstrates all four at runtime.

---

## Code quality

- Focused diff (~112 lines net): extract module, wire imports, add tests. No dead code left in `lobbies.js`.
- Comments in `game-state.js` and `lobbies.js` document the prior drift and why unification matters.
- Backward-compatible export: `createLobbyGameState` remains on `lobbies` module exports for existing tests and docs.

---

## Debug scenarios

This ticket did not add or modify any `?debugScenario=` shortcuts. Capture probes show `debugScenario: null` throughout normal lobby → deploy flow. N/A for the debug-scenario checklist.

---

## Integration / holistic notes

The original defect was **latent**: lobby paths missing three fields would throw or misbehave only when combat code touched `enchantments`, `lobby`, or `_pendingVolatileExplosions`. The capture exercises the real integration path (multi-player lobby create/join, ready, dungeon deploy, movement, key item) on state created via `createLobby()` → `createLobbyGameState()`, which is stronger proof than the unit test alone.

Sub-ticket artifacts under `tickets/224-data-unify-game-state-factories/subtickets/` document the intended split; implementation matches both subtickets.

---

## Remaining gaps

None blocking. Runtime capture is clean, both acceptance criteria are fully satisfied, and the refactor is minimal and correct.

---

VERDICT: PASS
