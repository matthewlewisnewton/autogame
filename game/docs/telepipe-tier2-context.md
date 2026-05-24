# Telepipe Tier 2 — Feature Context Document

**Last updated:** 2026-05-24  
**Status:** Implemented on a side branch; **not present on current `main`**

This document captures the full Telepipe Tier 2 feature as designed and built, what automated tests cover, what manual QA proved, what still fails, and how it interacts with the networking stack. Use it to resume work without re-deriving context from chat history.

---

## 1. Executive summary

Telepipe Tier 2 is a PSO-inspired **mid-run evac + suspend/resume** system:

- A player places a **shared portal** once per run (consumes the Telepipe card).
- The portal **persists at a fixed world position** until the level ends.
- Each player **enters individually** to return to the main ship (lobby).
- The dungeon **keeps running** while any non-extracted player remains inside.
- When the **last active player** evacuates, the run is **suspended** with a full checkpoint.
- On next **Deploy** (ready-up), the squad **resumes** the same dungeon layout, enemies, loot, hands, objective progress, and portal position.

**Repo reality today:** The feature was implemented in commits `e7ebdb8` → `0674bc7` → `b993eae` and further integrated with networking on branch `backup/telepipe-local-main-20260524-1251`. Current `main` (`ed8c711`) does **not** contain Telepipe code — it was reset during a merge/rebase cycle. All implementation detail below refers to the backup branch unless noted.

---

## 2. PSO reference vs. our design

| Behavior | PSO Telepipe | Our Tier 2 design |
|----------|--------------|-------------------|
| Portal placement | One player uses item; portal appears at caster | Same — one Telepipe card per run, placed at caster position |
| Shared portal | All party members can use it | Same — `gameState.telepipe` is lobby-wide |
| Individual evac | Each player walks in separately | Same — `player.extracted = true` per player |
| Dungeon continues | Other players stay in area | Same — `hasActivePlayers()` gates suspend |
| Progress saved | Loot kept; quest incomplete | **Extended** — full checkpoint (enemies, loot, hands, objective, portal coords) |
| Resume | Re-enter rolls new layout (PSO) | **Extended** — `restoreRunCheckpoint()` on ready-up |

Card type: internally `type: 'summon'`, `effect: 'telepipe'`, `specialEffect: 'portal'`. Theme pass renamed UI strings (e.g. ready button **Deploy** / **Deploy!**).

---

## 3. Where the code lives (backup branch)

### Git references

| Commit | Description |
|--------|-------------|
| `e7ebdb8` | Initial Telepipe Tier 2: checkpoint API, card, client UX, tests, walkthrough v1 |
| `0674bc7` | QA blockers: `setInDesperation()`, deferred `telepipe-ready` debug scenario |
| `b993eae` | Theme pass + telepipe progression integration |
| `636b990` / `5d0c239` etc. | Networking hardening merged alongside telepipe on backup branch |

**Branch to restore from:** `backup/telepipe-local-main-20260524-1251`  
**Preserve commit:** `46856a4` (walkthrough report snapshot before main reset)

### Key files (when feature is present)

| Area | Path | Role |
|------|------|------|
| Checkpoint / suspend / telepipe logic | `game/server/progression.js` | Core state machine |
| Socket wiring, useCard telepipe branch, move guards | `game/server/index.js` | Event handlers |
| Portal constants | `game/server/config.js` | `PORTAL_*`, `DISCONNECT_GRACE_MS` |
| Extracted-player sim guards | `game/server/simulation.js` | Skip AI/movement for `extracted` |
| Lobby state seed | `game/server/lobbies.js` | `telepipe: null` on lobby create |
| Card definition (client) | `game/client/cards.js` | Telepipe card entry |
| Extracted overlay, suspend banner, deploy visibility | `game/client/main.js` | Socket handlers + lobby UX |
| Portal mesh/VFX | `game/client/renderer.js` | `syncTelepipeMesh`, move sequencing |
| Unit tests | `game/server/test/server.test.js` | `describe('telepipe suspend/resume')` |
| Integration tests | `game/server/test/integration.test.js` | `describe('Telepipe suspend and resume')` |
| Manual QA | `game/docs/walkthroughs/telepipe-tier2/` | Scripts, screenshots, reports |
| Playwright P1 host script | `game/client/scripts/p1-telepipe-tier2-v2.mjs` | Automated 11-step walkthrough |

---

## 4. Server architecture

### 4.1 Game state fields

Per **lobby** (`lobby.state`):

```js
telepipe: null | { x, z, placedBy, placedAt }
suspendedCheckpoint: null | { version, savedAt, run, layout, enemies, minions, loot, telepipe, playerStates, ... }
run.status: 'playing' | 'suspended' | terminal states
gamePhase: 'lobby' | 'playing'
```

Per **player**:

```js
extracted: boolean       // true = on ship overlay, not in dungeon sim
lastTelepipeEnterAt: number  // enter cooldown
connected: boolean      // soft-disconnect networking
inputActive, inputDx, inputDz, lastInputSequence  // batched movement
debugScenario: 'telepipe-ready' | null
```

### 4.2 Core functions (`progression.js`)

| Function | Purpose |
|----------|---------|
| `isPlayerActive(player)` | `!dead && !extracted` |
| `hasActivePlayers()` | Any player still in dungeon |
| `captureRunCheckpoint()` | Deep copy run + world + per-player combat state |
| `restoreRunCheckpoint()` | Restore from `suspendedCheckpoint`, clear extracted, rebuild colliders |
| `suspendRunToLobby()` | Capture checkpoint, reset transient world, emit `runSuspended` |
| `maybeSuspendRun()` | Suspend only when `!hasActivePlayers()` |
| `tryEnterTelepipe(playerId)` | Distance/cooldown checks → set `extracted`, emit `playerExtracted` |
| `checkTelepipeProximity()` | Game-loop hook: auto-enter when inside `PORTAL_RADIUS` |
| `isPortalEntryGraceActive()` | Skip proximity for `PORTAL_PLACEMENT_GRACE_MS` after place |
| `abandonSuspendedRun()` | Discard checkpoint, return to fresh lobby |
| `applyTelepipeReadyHand(player)` | Debug QA: inject Telepipe into first occupied hand slot |
| `assignRunSpawnPositions(players)` | Stagger spawns (3-unit offsets) to avoid stacked dual-portal extract |
| `checkAllReady()` | **Resume path:** if `suspendedCheckpoint`, restore + emit `startGame` + `stateUpdate`; else fresh run |

### 4.3 Config constants (`config.js`)

```js
PORTAL_RADIUS = 2.5              // world units for enter + proximity
PORTAL_ENTER_COOLDOWN_MS = 1000
PORTAL_PLACEMENT_GRACE_MS = 2000 // prevent instant self-extract on place
DISCONNECT_GRACE_MS = 60000      // soft disconnect before eviction
```

Telepipe is in `SHOP_CARD_POOL` for acquisition outside debug scenario.

### 4.4 Card use flow (`index.js` → `useCard`)

1. Validate hand, cooldown, magic stones (Telepipe costs 0 MS).
2. Reject if `state.telepipe` already exists → `cardError: 'Telepipe already active'`.
3. Set `state.telepipe = { x, z, placedBy, placedAt: now }`.
4. Consume card slot, emit `stateUpdate` + `cardUsed` with `effect: 'telepipe'`, `specialEffect: 'portal'`.

### 4.5 Movement / extraction flow

- Each game tick: `checkTelepipeProximity()` (unless placement grace active).
- Extracted players blocked from: `move`, `useCard`, loot pickup (`index.js` guards).
- Simulation skips extracted players for AI targeting and movement integration.

### 4.6 Terminal state semantics

- **Partial extract:** `gamePhase` stays `'playing'`, `run.status` stays `'playing'`.
- **Full suspend:** only when every player is extracted (or dead+extracted such that no `isPlayerActive`).
- Death/out-of-cards terminal checks use **in-dungeon** players (`!extracted`), not all connected players.

### 4.7 Debug scenario: `telepipe-ready`

**Important:** Does **not** solo-start the run anymore (fix in `0674bc7`).

1. Client URL: `?debugScenario=telepipe-ready` (localhost only).
2. Server sets `player.debugScenario = 'telepipe-ready'`, restores HP/MS, **stays in lobby**.
3. On normal ready-up (`checkAllReady`), `applyTelepipeReadyHand()` injects Telepipe into slot 0 for **each** player who has the scenario flag.

---

## 5. Client architecture

### 5.1 Socket events handled

| Event | Client behavior |
|-------|-----------------|
| `playerExtracted` | If self → `showExtractedLobbyOverlay()` (hide HUD, hide Deploy, awaiting banner) |
| `runSuspended` | Force lobby phase, show **Resume expedition** banner + Deploy button |
| `startGame` | Enter dungeon HUD; on **resume** (scene already init) must call `setGamePhase('playing')` and reset meshes |
| `stateUpdate` | If `me.extracted && phase === 'playing'` → re-show extract overlay |
| `cardError` | Toast + `console.log('[cardError] …')` for QA capture |
| `playerReconnected` | Log only (minimal handler; lobby state comes via `lobbyJoined`) |

### 5.2 UI elements

- **Extracted overlay:** lobby visible, Deploy hidden, banner text from theme (`THEME.run.awaitingExtract`).
- **Suspended banner:** quest name + objective progress, **Abandon expedition** button.
- **Portal VFX:** renderer syncs mesh from `state.telepipe` on state updates.

### 5.3 Deploy button visibility

| State | Deploy visible? |
|-------|-----------------|
| Normal lobby | Yes |
| Playing (in dungeon) | No |
| Extracted mid-run (waiting for squad) | No |
| Full suspend (all extracted) | Yes |

Helper: `setDeployButtonVisible(visible)`.

---

## 6. Networking stack (co-developed)

Telepipe QA exposed reconnect/session bugs. These were implemented **alongside** telepipe on the backup branch:

### 6.1 Soft disconnect

On socket `disconnect` while in a lobby:
- Player stays in `lobby.state.players` with `connected: false`, `disconnectedAt`.
- **Does not** delete player or reset run (unlike old hard disconnect).

### 6.2 Reconnect grace

- `evictDisconnectedPlayers()` runs periodically; evicts after `DISCONNECT_GRACE_MS`.
- Reconnect via new socket + same account → `reconnectPlayerToLobby()` → `lobbyJoined` + `playerReconnected`.

### 6.3 Move sequencing

- Client sends incrementing `sequence` on move packets (`renderer.js`).
- Server rejects stale/duplicate via `lastInputSequence`.
- Rejects moves from `connected === false`, dead, or extracted players.

### 6.4 Init emit bug (identified, fix drafted)

**Problem:** Connection handler emitted `socket.emit('init')` **twice**:
1. Early emit with `inLobby: false` → client always showed lobby browser.
2. Late emit with correct `inLobby` + reconnect logic **after** handlers registered.

**Symptom:** Page refresh mid-suspended-run dropped session to lobby browser; resume Deploy flow broken.

**Fix (drafted, not on current main):**
- Remove early init.
- Run `reconnectPlayerToLobby()` **before** single final init.
- Client init handler: `if (data.inLobby) return` so reconnect path isn't wiped.

### 6.5 Resume + `startGame` client bug (identified, fix drafted)

When resuming with scene already initialized, `startGame` handler disposed enemy meshes but **did not** call `setGamePhase('playing')` or `setDeployButtonVisible(false)`. Player stayed visually in lobby while server thought run was active.

---

## 7. Automated test coverage (backup branch)

### 7.1 Unit tests (`server.test.js` → `telepipe suspend/resume`)

| Test | What it proves |
|------|----------------|
| Clears telepipe on transient reset | Cleanup hygiene |
| capture/restore round-trip | Portal coords + enemies + hand preserved |
| tryEnterTelepipe partial extract | P1 extracted, P2 still active |
| Rejects entry when too far | Distance guard |
| suspendRunToLobby when all extracted | Checkpoint captured |
| checkAllReady restores checkpoint | Resume does not call `spawnEnemies()` |
| abandonSuspendedRun | Checkpoint cleared |
| telepipe-ready injects card on ready-up | Debug scenario deferred correctly |
| Staggered spawn positions | Multi-player spawn offset |
| Portal placement grace | No instant extract within 2s of place |
| Single extract keeps run playing | `hasActivePlayers()` semantics |

### 7.2 Integration tests (`integration.test.js`)

| Test | What it proves |
|------|----------------|
| `Telepipe suspend and resume` → partial extract | P1 extracted, P2 still in dungeon, run still playing |
| `two-player extract, suspend, and resume` | Full flow; portal position + enemy id restored |
| `telepipe-ready debug scenario` | Stays in lobby until ready-up; both players get Telepipe |
| Disconnect grace / reconnect (multiple) | Soft disconnect does not destroy suspended run |
| Stale move sequence rejection | Networking hardening |

**Last known status:** 16+ telepipe/networking unit tests pass; integration subset passes when run without coverage OOM (full suite ~980+ tests on backup branch).

---

## 8. Manual QA infrastructure

### 8.1 Two-browser workflow

```
game/docs/walkthroughs/telepipe-tier2/
├── coordination.json          # Cross-browser sync (lobby name, ready flags, step signals)
├── p1-telepipe-tier2-v2.mjs   # Host script (can bootstrap P2)
├── p2-walkthrough-v2.mjs      # Joiner script (polls coordination)
├── p1-report-v2.md / p2-report-v2.md
├── p1-run.log
└── step-v2-*.png              # Screenshots
```

**Accounts:** `qa-telepipe-p1`, `qa-telepipe-p2` / `testpass123`  
**URL:** `http://localhost:5173/?debugScenario=telepipe-ready`  
**Lobby name:** `Telepipe QA v3` (v2 also used in earlier runs)

### 8.2 QA script steps (P1 host)

1. Login → create lobby → write coordination  
2. Wait for P2 join  
3. Deploy (ready) → dungeon with Telepipe in hand  
4. Place telepipe (key `1`) → write `p1-portal-placed`  
5. Walk into portal → extract overlay → write `p1-extracted`  
6. Wait for P2 to also extract → suspend banner  
7. Both Deploy → resume dungeon with portal persisted  

P2 script waits on coordination signals before attempting second telepipe (expects `cardError: Telepipe already active`) and verifies P2 stays in dungeon while P1 extracts.

---

## 9. What is working ✅

Based on **unit/integration tests** and **best manual QA run** (`p1-run.log` on backup branch):

| Capability | Evidence |
|------------|----------|
| Telepipe card definition + shop pool | Code + card tests |
| Place shared portal once per run | Unit + integration + QA step 8 |
| Reject second telepipe (`cardError`) | Server logic; P2 QA intermittent |
| Individual player extraction | Unit `tryEnterTelepipe`; QA step 9 (v2 log) |
| Dungeon continues with partial extract | Unit + integration `partial extract` |
| Portal placement grace (no instant extract) | Unit test |
| Staggered multi-player spawn | Unit test |
| Full suspend when all extracted | QA step 10 (v2 log); integration test |
| Checkpoint capture on suspend | Server logs `[run] checkpoint captured` |
| `telepipe-ready` deferred debug scenario | Integration test; QA step 7 |
| Extracted overlay + suspend banner UX | QA steps 9–10 (v2 log) |
| Client `inDesperation` crash fixed | `setInDesperation()` in `0674bc7`; no TypeError in v2 QA |
| Soft disconnect + grace period | Integration tests |
| Move sequence rejection | Integration test |

**Best manual QA score (P1 v2 log):** Steps 1–10 **PASS**, step 11 (resume) **FAIL**.

---

## 10. What is NOT working ❌

### 10.1 Feature absent from current `main`

The entire Telepipe implementation was lost from `main` during branch reset (`46856a4` preserve commit). **No telepipe symbols exist on `ed8c711`.** Restoring the feature requires cherry-pick/merge from `backup/telepipe-local-main-20260524-1251` or commits `e7ebdb8`..`b993eae`.

### 10.2 Resume after suspend (step 11) — **primary blocker**

**Symptom:** After full suspend, both players click Deploy; client never returns to `phase === 'playing'` within timeout.

**Likely causes (multiple, may stack):**

1. **QA script bug:** `ensureReady()` checked button text `'Ready'` but theme uses `'Deploy'` → resume Deploy never clicked. Fix drafted in script, not verified end-to-end.
2. **Client `startGame` resume path:** Missing `setGamePhase('playing')` when scene already initialized.
3. **Duplicate `init` emit:** Reconnect/refresh resets client to lobby browser, losing suspended-run context.
4. **Both players must ready:** Script may only ready P1; P2 bootstrap timing unreliable.

**Server side likely OK:** `checkAllReady` + `restoreRunCheckpoint` + emit `startGame`/`stateUpdate` covered by unit/integration tests.

### 10.3 P2 parallel QA unreliable

| Issue | Detail |
|-------|--------|
| Coordination desync | P2 script polls wrong lobby name (`v2` vs `v3`) |
| Early fatal timeout | P2 fails at dungeon wait (step 5) in some runs |
| Socket hook timing | `cardError` / `playerExtracted` not captured when hook installs late |
| Bootstrap vs external P2 | P1 bootstrap P2 behaves differently from true two-browser |

### 10.4 Extract overlay detection flaky (latest v3 run)

Latest preserved report (`46856a4`) shows steps 9–10 **FAIL** despite screenshots captured — script assertions didn't match DOM text after theme rename (e.g. **Resume expedition** vs **Waiting for squad**). Game behavior may have worked; **QA assertions were wrong**.

### 10.5 Portal VFX / gameplay polish (unverified)

- Portal mesh persistence across suspend/resume not visually verified in passing QA.
- No dedicated test that extracted player cannot attack or be targeted (sim guards exist, not exhaustively QA'd).
- Abandon suspended run flow exists server-side; minimal manual QA.

### 10.6 Networking + telepipe interaction edge cases (untested manually)

- Reconnect mid-run while one player extracted.
- Reconnect during suspended state (lobby with checkpoint).
- Eviction after grace period with suspended checkpoint.
- Two tabs same account during telepipe flow.

---

## 11. QA run history (timeline)

| Run | Result | Notes |
|-----|--------|-------|
| **v1** (p1-report.md) | **FAIL** | `inDesperation` crash; no Telepipe in hand; debug scenario solo-started run |
| **v2 P1** (p1-run.log) | **PARTIAL (10/11)** | Full flow to suspend; resume timeout |
| **v2 P2** (p2-report-v2.md) | **FAIL** | Fatal timeout early; later screenshots suggest some steps ran in other session |
| **v3 P1** (46856a4 report) | **FAIL (8/10)** | Likely script/assertion regression after theme rename; browser closed mid-run |

---

## 12. Fixes already landed (on backup branch)

| Issue | Fix |
|-------|-----|
| `TypeError: Assignment to constant variable` on `stateUpdate` | `setInDesperation()` in `hand.js`; use in `main.js` |
| `telepipe-ready` solo-started run / no card | Defer scenario; inject on `checkAllReady()` via `applyTelepipeReadyHand()` |
| Both players stacked at spawn → dual portal extract | `assignRunSpawnPositions()` with 3-unit offsets |
| Instant extract on place | `PORTAL_PLACEMENT_GRACE_MS = 2000` |
| Resume missing `stateUpdate` | Emit after checkpoint restore in `checkAllReady()` |
| Duplicate telepipe `useCard` branch | Removed duplicate in `index.js` |
| `cardError` not in logs | `emitCardError()` server-side; client `console.log('[cardError] …')` |
| Extracted mid-run showed Deploy | `setDeployButtonVisible(false)` in extract overlay |
| Partial extract semantics | Confirmed + tests |

---

## 13. Fixes identified but NOT verified on backup branch

| Fix | Files | Status |
|-----|-------|--------|
| Remove duplicate `init` emit; reconnect before init | `server/index.js` | Drafted in session, may not be on backup |
| Client `init`: skip lobby browser when `inLobby` | `client/main.js` | Drafted |
| `startGame` resume: `setGamePhase('playing')` | `client/main.js` | Drafted |
| `playerReconnected` client handler | `client/main.js` | Drafted |
| QA `ensureReady`: accept `Deploy` / `Deploy!` | `p1-telepipe-tier2-v2.mjs` | Drafted |
| Coordination writes: `p1-portal-placed`, `p1-extracted` | P1 script | Drafted |
| P2 wait on coordination before telepipe reject test | P2 script | Exists; timing still flaky |

---

## 14. How to restore and continue

### 14.1 Restore code

```bash
# Option A: checkout backup branch
git checkout backup/telepipe-local-main-20260524-1251

# Option B: cherry-pick onto main
git checkout main
git cherry-pick e7ebdb8 0674bc7  # resolve conflicts with current main carefully
```

Expect conflicts with post-telepipe main changes (card type renames PR #2, cardUsed refactor PR #4, enchantments, etc.).

### 14.2 Verify automated tests

```bash
cd game
node scripts/run-vitest.mjs run --config vitest.config.js \
  server/test/server.test.js -t "telepipe"
node scripts/run-vitest.mjs run --config vitest.config.js \
  server/test/integration.test.js -t "Telepipe|disconnect|reconnect|sequence"
```

### 14.3 Manual QA

```bash
# Terminal 1: server
cd game/server && node index.js

# Terminal 2: client
cd game/client && npm run dev

# Terminal 3: P1 host (bootstraps P2)
cd game/client/scripts && node p1-telepipe-tier2-v2.mjs

# Terminal 4 (optional): true two-browser P2
node game/docs/walkthroughs/telepipe-tier2/p2-walkthrough-v2.mjs
```

**Pass criteria:**
1. Shared portal placed once; second use rejected with toast.
2. P1 extracts → overlay, no Deploy; P2 still in dungeon.
3. P2 extracts → both see suspend banner.
4. Both Deploy → dungeon resumes, portal at same coords, enemies/loot restored.

---

## 15. Recommended next steps (prioritized)

1. **Restore telepipe branch onto `main`** (merge or cherry-pick with conflict resolution against card-type/cardUsed refactors).
2. **Apply resume fix bundle:** single init, reconnect ordering, `startGame` resume phase, Deploy-aware QA scripts.
3. **Re-run P1 walkthrough** — target step 11 pass.
4. **Run true two-browser P2** with matching lobby name + coordination signals.
5. **Add integration test for resume over socket** (both players ready → receive `startGame` → `state.telepipe` present) to prevent step 11 regression without Playwright.
6. **Document in `design.md`** once shipped (currently only in this context doc and walkthrough artifacts).

---

## 16. Related design docs

- `game/docs/design.md` — lobby as main ship; no telepipe section yet on current main
- `game/docs/requirements.md` — general run lifecycle
- Walkthrough artifacts: `backup/telepipe-local-main-20260524-1251:game/docs/walkthroughs/telepipe-tier2/`

---

## 17. Glossary

| Term | Meaning |
|------|---------|
| **Extract / evac** | Player sets `extracted: true`, sees lobby overlay, excluded from sim |
| **Suspend** | All players extracted; checkpoint saved; `gamePhase → lobby` |
| **Resume** | All players Deploy-ready; `restoreRunCheckpoint()`; `startGame` |
| **Checkpoint** | `suspendedCheckpoint` blob with full dungeon snapshot |
| **Active player** | In dungeon: alive and not extracted |
| **Deploy** | Theme rename of Ready button for sortie launch |
