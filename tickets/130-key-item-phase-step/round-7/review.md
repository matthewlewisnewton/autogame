# Senior Review: Key Item Phase Step

## Runtime health

The captured run loads cleanly. `metrics.json` reports `ok: true`, servers started, `pageerrors` is empty, and the game reached `playing` with a canvas, connected socket, visible card hand, two players, and active enemies. `console.log` has no `pageerror` or `[fatal]` entries from game code; the Vite `EPIPE`/WebSocket close noise in `client.log` is explicitly benign. The PNG screenshot files referenced by metrics were not present in the round folder, so visual confirmation here is limited to the recorded probes/logs for this code-verified ticket.

## Acceptance criteria findings

- Cooldown ~12s: Met. `KEY_ITEM_DEFS.phase_step` defines `cooldownMs: 12000`, the successful server path applies that cooldown to the caster, and `server/test/phase_step.test.js` verifies the second immediate use returns `on_cooldown`.
- Requires co-op ally in same run; solo fails gracefully: Met. `useKeyItem` only considers other living, non-extracted players in the lobby/run state. A solo caster receives `no_ally` without moving or burning cooldown, covered by the focused test.
- No swap through walls / both endpoints valid: Met for the ticket's stated endpoint validation requirement. Before swapping, the server rejects endpoints outside walkable dungeon space and endpoints overlapping wall colliders, leaving positions unchanged and preserving cooldown. Tests cover off-map endpoints and wall-overlap endpoints.
- Client target highlight or auto-nearest: Met. The client recomputes and highlights the nearest in-range ally when `phase_step` is equipped and sends that `targetPlayerId`; the server also supports omitted `targetPlayerId` by selecting the nearest candidate.
- Tests for two-player swap and out-of-range failure: Met. `coverage.log` shows `server/test/phase_step.test.js` passed 8 tests, including coordinate swap, explicit target, out-of-range failure, solo failure, invalid endpoints, wall overlap, and cooldown. The full logged run shows 33 test files / 935 tests passing.

## Design and integration

The implementation fits the existing key-item architecture: data lives in `progression.js`, action handling remains server-authoritative in `index.js`, and the client only supplies a target hint. The swap preserves `x`, `y`, and `z` as requested and broadcasts the authoritative state update after success. It does not regress the foundation requirements: the captured game still renders, connects over WebSockets, shows multiplayer state, and processes movement.

The added `phase-step-ready` debug scenario is gated through the existing local/dev debug path and URL/test hook flow. It equips the local caster and starts a normal playing state, but does not fabricate an ally or bypass the real co-op swap path; equivalent end state remains reachable through normal lobby play by equipping Phase Step and deploying with a second player.

## Remaining gaps

No blocking gaps found. The only follow-up I noted is non-blocking maintainability around duplicated client/server range constants, filed separately in `nits.md`.

VERDICT: PASS
