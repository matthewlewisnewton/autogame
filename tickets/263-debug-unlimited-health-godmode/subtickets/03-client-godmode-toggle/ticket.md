# 03-client-godmode-toggle

Wire a playtester-facing godmode toggle on the client that requests the server toggle only when local dev access is allowed (`debugScenarioAllowed`). The server gate remains authoritative; client hostname checks are UI-only.

## Acceptance Criteria

- When `debugScenarioAllowed` is true (localhost / 127.0.0.1 / ::1 hostname), pressing **Shift+G** emits `toggleDebugGodmode` on the active socket (only when the socket is connected and the key is not swallowed by an open text input/overlay).
- When `debugScenarioAllowed` is false, Shift+G does not emit `toggleDebugGodmode`.
- The client handles `debugGodmodeResult`: on success, logs `[debugGodmode] enabled` or `[debugGodmode] disabled` to the console; on failure, logs the reason (same pattern as `debugScenarioResult`).
- A test hook `window.__toggleDebugGodmodeForTest()` emits `toggleDebugGodmode` when the socket is ready (mirrors `window` debug helpers used elsewhere).
- `window.__AUTOGAME_HARNESS_STATE__()` (or the existing harness probe object) exposes the last `debugGodmodeResult` for automated checks.
- Client unit test asserts Shift+G emits the socket event when allowed and does not emit when disallowed.

## Technical Specs

- **`game/client/main.js`**
  - Track `let debugGodmodeResult = null` alongside existing debug-scenario state (~line 931).
  - Register `socket.on('debugGodmodeResult', …)` in the socket setup block near `debugScenarioResult` (~line 1380).
  - Add Shift+G handling in the global `keydown` listener (near the variant-codex handler ~line 3615): guard with `debugScenarioAllowed`, `socket?.connected`, and skip when focus is in `input`/`textarea`/`select` or a modal overlay is open.
  - Export `window.__toggleDebugGodmodeForTest` and include `debugGodmodeResult` in the harness state return object (~line 4527).
- **`game/client/test/debug-godmode.test.js`** (new) — use existing test setup (`window.__clearSocketEmitLog`, `window.__setGameState`, mock socket). Simulate Shift+G keydown with `debugScenarioAllowed` true/false and assert emit log contents.
- Do **not** change server damage logic or socket gate in this sub-ticket.

## Verification: code
