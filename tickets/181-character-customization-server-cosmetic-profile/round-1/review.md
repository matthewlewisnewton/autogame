# Senior Review — 181 Character Customization: Server Cosmetic Profile

## Runtime health (gate)
- `metrics.json`: `"ok": true`, `capturePlanValid: true`, `pageerrors: []`, no
  `harness_failure` block. Two players reached `phase: "playing"`, scene
  initialized, latency 0–1ms, HP/movement updating normally.
- `console.log`: 6 lines, all benign (`[vite] connected`, `[initScene]`). No
  `pageerror`, no `[fatal]`, no uncaught exceptions.
- Game starts and loads cleanly with the ticket applied. Gate PASSED.

## Per-criterion findings

**1. Account record gains `cosmetic { bodyColor, accentColor, bodyShape }` with
sane defaults backfilled for existing accounts.** — MET.
`game/server/cosmetic.js` defines `DEFAULT_COSMETIC` (`#4f9dde` / `#f2c94c` /
`box`). `createUser`/`createUserAsync` (`users.js`) attach a fresh copy at
creation. `loadUsers` runs `record.cosmetic = backfillCosmetic(record.cosmetic)`
on every record, filling whole-missing and partial-missing cosmetics. Verified
by `users.test.js` ("applies a default cosmetic at account creation",
"backfills a complete cosmetic on a legacy record", "backfills only the missing
sub-fields on a partial legacy cosmetic").

**2. `PATCH /api/me/profile` accepts and validates cosmetic fields, rejecting
invalid input with a 400.** — MET.
Route in `account.js` threads `cosmetic` into `updateProfile`; the no-fields
guard now also accounts for `cosmetic`. `validateCosmetic` enforces the
case-insensitive `#RRGGBB` regex and the `box|cylinder|cone|capsule` enum;
invalid values bubble up as `result.reason` → route returns 400. Verified by
`account.test.js` ("returns 400 for invalid cosmetic input", "updates cosmetic
and returns it in the 200 payload") and `cosmetic.test.js`.

**3. Cosmetic is added to player runtime state when a player record is built.**
— MET. `buildPlayerRecord` (`index.js`) looks up the account via
`findUserByAccountId` and sets `cosmetic: account?.cosmetic ?? { ...DEFAULT_COSMETIC }`,
so an unknown account safely falls back to a *copy* of the default (not a shared
reference). Verified by `cosmetic_runtime.test.js` ("buildPlayerRecord sources
the cosmetic from the account record" / "falls back to a copy of the default").

**4. `stateUpdate` snapshot carries `cosmetic` for every player.** — MET.
`stateSnapshot` (`progression.js`) emits `cosmetic: p.cosmetic ?? { ...DEFAULT_COSMETIC }`
per player. Verified by `cosmetic_runtime.test.js` ("stateSnapshot exposes each
player cosmetic with the full body/accent/shape", default fallback, and reflects
an account cosmetic updated before join).

**5. Cosmetic round-trips through the API and persists across a server
restart.** — MET. `updateProfile` merges provided sub-fields onto the existing
cosmetic and persists via the existing atomic `saveUsers`. Verified by
`users.test.js` ("persists cosmetic across a simulated restart") and the
account-route round-trip test that re-reads via `GET /api/me`.

## Consistency / regression
- Reuses the existing `PATCH /api/me/profile` route and atomic `users.json`
  write exactly as the ticket's Design section specifies — no new endpoint, no
  new persistence mechanism.
- Default merge/fallback uses spread copies everywhere a default is applied, so
  no record shares a mutable `DEFAULT_COSMETIC` reference.
- No debug scenarios were added or changed by this ticket.
- All 53 server tests pass (`account`, `cosmetic`, `cosmetic_runtime`, `users`).
  `server.test.js` got a +3 line touch consistent with the new export.

## Remaining gaps
None blocking. All five acceptance criteria are fully and robustly met, backed
by HTTP-level and unit tests, and the captured run is healthy. One minor,
non-blocking polish item is recorded in `nits.md`.

VERDICT: PASS
