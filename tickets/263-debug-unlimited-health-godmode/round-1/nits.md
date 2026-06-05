## Godmode has no in-game HUD indicator

When godmode is toggled on, feedback is console-only (`[debugGodmode] enabled` / `disabled`). Playtesters must watch the console or probe harness state to know whether invincibility is active.

### Acceptance Criteria

- When `debugGodmodeResult.ok === true`, show a small dev-only HUD badge or status-line hint (e.g. "GODMODE") that disappears when toggled off.
- Badge is visible only when `debugScenarioAllowed` is true; never shown on non-loopback production hosts.

## Harness capture does not exercise godmode toggle

Round-1 `metrics.json` probes report `debugGodmodeResult: null` because the fallback capture plan never presses Shift+G or calls `__toggleDebugGodmodeForTest`. Functional coverage exists in vitest, but browser capture does not demonstrate invincibility end-to-end.

### Acceptance Criteria

- Extend the ticket capture plan (or a dev-scenario step) to toggle godmode, take enemy damage, and assert HP unchanged in probe data.
- `metrics.json` probe includes `debugGodmodeResult.enabled === true` and stable HP after damage window.

## Silent no-op when toggle fires outside lobby context

If `toggleDebugGodmode` is emitted while `withLobbyPlayer` cannot resolve a player (e.g. before lobby join), the handler returns without emitting `debugGodmodeResult`, so the client gets no feedback.

### Acceptance Criteria

- When the gate passes but no lobby player is found, emit `debugGodmodeResult` with `{ ok: false, reason: '...' }` instead of silently returning.
- Client test or server test covers the rejection path.
