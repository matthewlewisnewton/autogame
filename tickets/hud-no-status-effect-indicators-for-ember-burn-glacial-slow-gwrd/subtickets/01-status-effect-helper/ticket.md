# Status-effect HUD helper + unit test

Add a pure, testable helper that derives the list of active status effects (burning, slowed, and any future timed effect) for a player from the snapshot fields the server already broadcasts (`burningUntil`, `slowedUntil`, `slowFactor`). This is the logic the HUD strip (sub-ticket 02) will render; it does no DOM work.

## Acceptance Criteria

- A new exported function `computeActiveStatusEffects(player, now)` exists in `game/client/vanguard-hud.js`.
- Given a player with `burningUntil` in the future relative to `now`, the result includes an entry for the burn effect with a stable `id` (e.g. `'burning'`), a human label (e.g. `'Burning'`), and a `remainingMs` equal to `burningUntil - now` (never negative).
- Given a player with `slowedUntil` in the future, the result includes a slow entry (`id: 'slowed'`, label `'Slowed'`, correct `remainingMs`).
- When both `burningUntil` and `slowedUntil` are in the future, both entries are returned (order is stable/deterministic).
- When an effect's `until` timestamp is in the past, `0`, missing, or `null`, that effect is NOT included; a player with no active effects yields an empty array.
- A null/undefined player yields an empty array (no throw).
- A new vitest file `game/client/test/status-effects.test.js` covers: burn only, slow only, both active, none/expired, and the null-player guard — and passes under `pnpm test`.

## Technical Specs

- `game/client/vanguard-hud.js`: add and export `computeActiveStatusEffects(player, now)`. Treat each effect as `{ id, label, remainingMs }` (optionally an `icon`/glyph field for the strip). Compute `remainingMs = Math.max(0, until - now)` and include the effect only when `until > now`. Build the array in a fixed order (e.g. burning before slowed) so output is deterministic. Keep it pure — no `Date.now()` inside; the caller passes `now`.
- `game/client/test/status-effects.test.js`: new vitest file importing `computeActiveStatusEffects` from `../vanguard-hud.js`, mirroring the style of `game/client/test/vanguard-hud.test.js`.
- Do NOT touch the DOM or `main.js` in this sub-ticket; rendering is sub-ticket 02.

## Verification: code
