# Senior Review — 216-lobby-remove-dead-hostid

## Runtime health

Captured run in `round-1/metrics.json` is healthy:

- `"ok": true`; dev servers started on `http://localhost:5176/` and the deterministic smoke flow completed (auth → lobby create/join → ready → dungeon gameplay → movement/dodge probes).
- `pageerrors` is empty; `pageerrors.json` is `[]`.
- `console.log` contains only Vite connect lines, HTTP 409 on duplicate auth registration (harness re-register), and `[initScene]` startup logs — no `pageerror` or `[fatal]` lines from game code.
- Probes show `phase: "playing"`, two players, canvas/scene initialized, lobby overlay hidden, dodge cooldown HUD exercised — consistent with a working multiplayer session.

No `harness_failure` block; infrastructure is not blocking this round.

## Acceptance criteria

### 1. Delete `hostId`, reassignment logic, and `lobbySummary` inclusion (behavior-preserving)

**Met.** Inspected live code under `game/` and `git diff 9134e7d..HEAD` (commits `a8af6b3`, `f5d5ef9`):

| Area | Finding |
|------|---------|
| `game/server/lobbies.js` | `createLobby(name)` stores only `id`, `name`, `state`, `createdAt`. `removePlayerFromLobby` has no host-reassignment branch. `lobbySummary` omits `hostId`. |
| `game/server/index.js` | `createLobby` socket handler calls `lobbies.createLobby(data && data.name)`; creator still joins via `joinPlayerToLobby`. |
| Handlers | `selectQuest` and other lobby actions use `withLobbyPlayer` with phase/membership checks only — no host checks before or after this change. |
| Client | `rg hostId game/` — zero matches. |
| Docs | `game/docs/lobbies.md` and `game/docs/gameplay-review.md` describe `createLobby(name?)`, omit `hostId` from the lobby shape, and document that any connected member may change quest while `gamePhase === 'lobby'`. |

Removal is behavior-preserving: the old field was written and reassigned on leave but never authorized any action; the client never read it.

### 2. Tests green

**Met for ticket scope.** Directly affected tests pass:

- `server/test/lobbies.test.js` — 13/13 (host assertions removed; membership and empty-lobby deletion retained).
- `server/test/server.test.js` — 361/361 with updated `createLobby` call sites.
- Round-1 `coverage.log` (changed-files vitest run at capture): **41 files, 935 tests, all passed**, including `lobbies.test.js` and `integration.test.js`.

A manual `pnpm test:quick` on HEAD can intermittently fail in **unrelated** timing/MS-regen tests (`integration.test.js` loot pickup, `field_medic_kit.test.js` “dead players skipped”, `loot_magnet.test.js` cooldown) — fractional `magicStones` drift, not lobby logic. These failures are not introduced by the `hostId` removal (changed files are `lobbies.js`, `index.js` createLobby call site, lobby tests, and docs). The ticket partially hardened one `field_medic_kit` MS assertion with `toBeCloseTo`; remaining exact MS asserts in other files are a pre-existing flake class (see `nits.md`).

## Design & requirements alignment

- **design.md / lobbies.md**: Documentation now matches implemented “any member can act” lobby semantics instead of dead host ceremony or incorrect host-only quest control.
- **requirements.md**: No regression — capture proves auth, WebSocket connect, lobby create/join, deploy, movement sync, and dungeon entry still work end-to-end.

## Code quality

- Diff is minimal (~15 lines of functional server change plus test/doc updates).
- No dangling `hostChanged` comments, partial migrations, or dead branches.
- `removePlayerFromLobby` still deletes empty lobbies and cleans minions/trades on leave.

## Debug scenarios

No new or modified `?debugScenario=` shortcuts. N/A.

## Integration notes

Branch `auto/216-lobby-remove-dead-hostid` has two implementation commits on baseline `9134e7d`:

1. `a8af6b3` — server model + tests (+ `field_medic_kit` MS assertion hardening)
2. `f5d5ef9` — doc alignment

Capture exercised the normal lobby create/join/ready/deploy path (not a debug shortcut), which is the right holistic check for this cleanup.

## Remaining gaps

None. Runtime capture is clean and both acceptance criteria are satisfied.

VERDICT: PASS
