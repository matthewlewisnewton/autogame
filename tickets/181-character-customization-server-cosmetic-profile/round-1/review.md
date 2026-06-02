# Senior review — Ticket 181: Server cosmetic profile

**Baseline:** `aa963b34eaad3701c4de5ea56af2bb4b368d178d`  
**Commits:** `37efa1c` (storage + API), `eb6eb02` (runtime + snapshot)  
**Scope:** Server-only foundation for character customization (rendering deferred to downstream tickets per `decompose.txt`).

> **Note:** `tickets/181-character-customization-server-cosmetic-profile/ticket.md` is not present in the working tree or at baseline. Acceptance criteria below are reconstructed from `decompose.txt` (“five acceptance criteria” delivered by sub-tickets 01 + 02) and both sub-ticket specs.

---

## Runtime health (blocking gate)

| Check | Result |
|-------|--------|
| `metrics.json` present, `"ok": true` | Pass |
| Servers started | Pass (`server.log`: listening on 3000; probes show `connectionState: "connected"`, `phase: "playing"`) |
| `pageerrors` | Empty (`[]` in metrics and `pageerrors.json`) |
| `failure_kind` / `harness_failure` | Absent |
| `console.log` pageerror / `[fatal]` | None |
| Benign noise only | Vite connect lines; HTTP 409 on a resource load during harness auth (not tagged `pageerror`/`[fatal]`) |

Capture reached squad lobby and gameplay (movement probes, HP change 100→94). Fallback smoke plan ran successfully; no cosmetic-specific browser scenario (expected for a server-data ticket).

---

## Acceptance criteria

### 1. Persistent account `cosmetic` with defaults and legacy backfill

**Met.** `game/server/users.js` defines `DEFAULT_COSMETIC`, `BODY_SHAPES`, and `HEX_COLOR_REGEX`. New users via `createUser` / `createUserAsync` receive `cosmetic: { ...DEFAULT_COSMETIC }`. `loadUsers()` applies `withCosmeticDefaults(record.cosmetic)` for every record so in-memory accounts always expose a complete object. Tests in `users.test.js` cover defaults, legacy file without `cosmetic`, and persist/reload survival.

### 2. Validated partial updates via `updateProfile` and REST (`PATCH`/`GET`)

**Met.** `normalizeCosmetic()` rejects invalid shapes/colors and lower-cases valid hex; partial merges preserve untouched keys. Validation runs before any profile mutation. `account.js` exposes `cosmetic` on `GET /api/me` and accepts `cosmetic` on `PATCH /api/me/profile` with `400` on validation failure (no persistence). `account.test.js` covers happy path, `400` reject, and `GET` round-trip.

### 3. Runtime player record populated from account on lobby join

**Met.** `buildPlayerRecord()` in `index.js` sets:

```978:978:game/server/index.js
    cosmetic: withCosmeticDefaults(findUserByAccountId(accountId)?.cosmetic),
```

First-time lobby entry (`!state.players[playerId]`) uses this path. Integration test `"populates the runtime record and stateUpdate with the account's stored cosmetic"` asserts both `testGameState().players[id].cosmetic` and snapshot parity.

### 4. `stateUpdate` snapshot includes complete `cosmetic` for every player

**Met.** `stateSnapshot()` in `progression.js` adds `cosmetic: withCosmeticDefaults(p.cosmetic)` per player. `server.test.js` asserts per-player completeness, peer presence, and default backfill when runtime field is missing.

### 5. Peer visibility and updated cosmetic on re-entry (not stale hardcoded values)

**Met for the intended server contract.** Peer cosmetics appear in snapshots (integration test with two accounts; `server.test.js` two-player case). When a player **leaves** a lobby, `removePlayerFromLobby` deletes `lobby.state.players[playerId]`; a subsequent join recreates the record via `buildPlayerRecord`, picking up account changes. The `server.test.js` “rejoin” case mutates runtime `cosmetic` to prove snapshots track the runtime field (the source of truth during a run).

**Clarification (not blocking):** `reconnectPlayerToLobby` and the `joinPlayerToLobby` “player already exists” branch do **not** re-read `findUserByAccountId` for cosmetic. A profile `PATCH` during an in-lobby soft disconnect/reconnect would leave a stale runtime cosmetic until leave-and-rejoin. That is acceptable for this ticket (no client customization UI yet; downstream render tickets can decide whether drop-in rejoin should refresh appearance).

---

## Design and requirements alignment

- **`game/docs/design.md`:** No conflict. Cosmetic data is account-scoped persistence feeding multiplayer state—consistent with lobby/squad architecture. No rendering changes (explicitly out of scope).
- **`game/docs/requirements.md`:** No regression to core 3D/multiplayer/movement foundations; capture confirms normal play still works.

---

## Code quality

- **Validation:** Strict reject (no silent coercion of bad hex/shapes); sensible defaults via `withCosmeticDefaults`.
- **Atomic persistence:** Reuses existing `saveUsers()`; cosmetic validated before username/email mutation.
- **Tests:** Broad unit coverage (`users.test.js`, `account.test.js`, `server.test.js`) plus three socket integration cases. Cosmetic integration tests correctly use CJS `require('../users.js')` so they share the server module instance.
- **Dead / broken code:** None observed in changed paths.
- **Debug scenarios:** Ticket did not add or modify `?debugScenario=` flows.

---

## Coverage artifact

`round-1/coverage.log` shows cosmetic-related tests executing and no reported failures before the harness killed the vitest process group at **120s** (`[vitest] timed out after 120s`). Independent `pnpm test:quick` completed **1470 passed** in this review session. Treat round-1 coverage as visibility-only; functional confidence comes from the passing targeted/full run.

---

## Capture vs. ticket scope

Screenshots and probes validate general game health only—they do not assert `cosmetic` in harness state (probes omit it). That is appropriate: acceptance is server/API/snapshot logic, covered by automated tests.

---

## Remaining gaps

None blocking. Runtime is clean; server storage, API, runtime record, and `stateUpdate` replication satisfy the reconstructed top-level criteria.

---

## Nits (non-blocking)

See `nits.md` for follow-up items (cosmetic refresh on socket reconnect, empty `{}` PATCH no-op, missing top-level `ticket.md` in repo).

VERDICT: PASS
