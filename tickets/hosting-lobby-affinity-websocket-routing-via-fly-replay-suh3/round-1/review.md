# Senior Review — Hosting: lobby-affinity WebSocket routing via Fly-Replay

## Runtime health (gate)

- `metrics.json`: `"ok": true`, `"pageerrors": []`, no `harness_failure`. Capture
  reached the `playing` phase for both players (movement, dodge + cooldown HUD probed).
- `console.log`: no `pageerror` / `[fatal]` lines. The single
  `409 (Conflict)` "Failed to load resource" is the harness registering its
  second test user (pre-existing auth-conflict noise); it is unrelated to this
  ticket — the Fly-Replay middleware is not even attached in the capture because
  `FLY_MACHINE_ID` is unset (single-instance path). Both players load and play
  cleanly. **Game runs.**

## Per-criterion findings

The single acceptance criterion has five clauses; each verified against the live
working tree.

**1. Cross-instance connection (lobby owned by B, arriving at A) is replayed to B.**
`flyReplay.resolveLobbyRouting()` looks up the owner via
`lobbyRegistry.getLobbyOwner()` and returns `{ action: 'replay', machineId: owner }`
when `owner !== localMachineId`. `flyReplayHook.sendFlyReplayResponse()` emits
`fly-replay: instance=<owner>`. The hook is wired on both the Engine.IO HTTP
middleware (`io.engine.use`) and a `prependListener('upgrade')` for the WS
handshake, parsing `lobbyId`/`lobby`/`joinLobby` query keys. Integration test
`replays wrong-machine websocket handshakes to the owner machine` asserts the
response contains `fly-replay: instance=machine-a`. ✓

**2. Self-owned lobbies are not replayed.** `resolveLobbyRouting` returns
`{ action: 'self' }` when `owner === localMachineId`. Tests
`does not replay when the local machine already owns the lobby` and
`connects on the owner machine without a fly-replay header` confirm no
`fly-replay:` header and a normal connection. ✓

**3. Lobby creation assigns + records an owner.** `lobbies.createLobby()` calls
`registerLobby(id)` → `HSET lobby:owners <id> <instanceId>`, where
`getInstanceId()` now prefers `FLY_MACHINE_ID`. Owner-unknown handshakes
(`owner === null`) take `{ action: 'self', claimOwner: true }` and lazily register
the lobby if it exists locally. Test
`registers createLobby ownership under FLY_MACHINE_ID on machine-a` verifies the
recorded owner equals `getFlyMachineId()`. ✓

**4. Off-Fly / single-instance always routes to self with no behavior change.**
`isFlyReplayEnabled()` requires both `isRedisEnabled()` and a non-empty
`FLY_MACHINE_ID`; otherwise `resolveLobbyRouting` short-circuits to `self` and
`attachFlyReplayRouting` is a no-op (no middleware, no upgrade listener). Tests
`does not attach fly replay and resolveLobbyRouting always stays local` and
`leaves attachFlyReplayRouting as a no-op without force-enabled Redis` confirm
this. The captured single-instance run played through normally. ✓

**5. Logic unit-tested with machine id + registry mocked.** Four suites
(`fly_replay`, `fly_replay_hook`, `fly_replay_integration`, `lobby_registry`)
= 35 tests, all green; client affinity covered by `fly_replay_client` (6 tests,
green). ✓

## Integration / consistency

- Client side: `requestJoinLobby` / `handleLobbyDeepLinkAfterInit` recreate the
  socket with `query.lobbyId` (and `fly-force-instance-id` header) only when the
  summary carries `instanceId`; otherwise they emit `joinLobby` on the existing
  socket — preserving single-instance behavior. `instanceId` reaches the client
  via the pre-existing global browser (`lobbyBrowser.listGlobalLobbySummaries` →
  `tagSummariesWithInstanceId`), used by `broadcastLobbyList` and `init` with a
  local-summary fallback. Coherent end-to-end.
- `?lobby=<id>` deep-link is a production join-link feature (documented in
  `game/docs/lobbies.md`), not a debug scenario — no localhost gating concerns,
  and the existing `debugScenario` handling was only refactored (consolidated
  `URLSearchParams`), not weakened.
- Consistent with `game/docs/design.md` foundation; no regression to existing
  lobby flow.

## Remaining gaps

None blocking. Acceptance criteria fully and robustly met; runtime healthy.
(Minor non-blocking observations recorded in `nits.md`.)

VERDICT: PASS
