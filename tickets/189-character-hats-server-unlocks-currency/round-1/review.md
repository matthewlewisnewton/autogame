# Senior Review — 189-character-hats-server-unlocks-currency

No top-level `ticket.md` exists (confirmed by `decompose.txt`); judged against
the combined acceptance criteria of the two sub-tickets, which together define
the feature: a server-side hat catalog + cosmetic `hat` field + per-account
`unlockedHats`, and a lobby flow to spend in-game currency to unlock hats.

## Runtime health (blocking gate)
PASS. `round-1/metrics.json` reports `"ok": true`, `"pageerrors": []`, and a
fully-loaded gameplay session (scene initialized, two players, phase `playing`,
canvas present). `console.log` shows only `[vite] connected` and one benign
`409 Conflict` (harness auth re-register), no `pageerror`/`[fatal]` lines from
game code. The game starts and loads cleanly.

This is a server-only feature (mirroring the 181 cosmetic precedent), so the
deterministic smoke capture is the appropriate proof — there is no client UI to
screenshot yet. All 53 server unit tests for the touched files pass
(`cosmetic`, `users`, `account`, `cosmetic_runtime`).

## Per-criterion findings

### Sub-ticket 01 — catalog, cosmetic hat field, equip validation
- **Hat catalog**: PASS. `game/server/cosmetic.js` defines `HAT_CATALOG` with
  `{ id:'none', price:0 }` plus three positively-priced hats (cap 50, wizard
  150, crown 500). Exports `HAT_CATALOG`, derived `HAT_IDS` set, and `getHat`.
- **`DEFAULT_COSMETIC.hat` = `'none'`**: PASS.
- **`unlockedHats` defaults to `['none']`**: PASS. Set in both `createUser` and
  `createUserAsync`; backfilled on load in `loadUsers` via
  `backfillUnlockedHats`, which always re-includes `'none'`, dedupes, and drops
  unknown ids.
- **`backfillCosmetic` handles `hat`**: PASS. Falls back to `'none'` for
  missing/invalid values; only accepts catalog ids (`HAT_IDS.has`).
- **`validateCosmetic` rejects unknown `hat`**: PASS. Returns
  `{ ok:false, reason }` for non-string or non-catalog id, accepts any catalog
  id.
- **`updateProfile` enforces ownership on equip**: PASS. When `cosmetic.hat` is
  provided, rejects with `{ ok:false }` if the hat isn't in the account's
  `unlockedHats` (checked before merge); accepts and persists owned hats.
- **`GET /api/me` returns `unlockedHats` + catalog**: PASS. `account.js`
  imports `HAT_CATALOG` and adds both fields to the `/me` response.
- Existing `bodyColor`/`accentColor`/`bodyShape` behavior unchanged.

### Sub-ticket 02 — unlock hats by spending currency
- **`unlockHat` lobby handler with `{ hatId }`**: PASS. Registered in
  `index.js`, wrapped in `withLobbyFromSocket` and guarded by
  `state.gamePhase === 'lobby'`, matching `buyShopCard`.
- **Server-side validation, no state change on failure**: PASS. Rejects missing
  hatId, missing account, already-owned hat (early, before any currency touch),
  unknown hat, and insufficient currency (via `unlockHatForPlayer`). Each path
  emits `hatError` and mutates nothing.
- **On success: deduct price, append unlock, persist both**: PASS.
  `unlockHatForPlayer` (progression.js) deducts `player.currency`;
  `users.unlockHat` appends to `unlockedHats` (deduped) and calls `saveUsers()`;
  handler then calls `savePlayerData`. Notably, if the account write fails the
  handler refunds the deducted currency — a nice consistency guard beyond the
  spec.
- **Success emits updated `unlockedHats` + remaining `currency`**: PASS, via
  `hatUnlocked` event.
- **`cosmetic.hat` carried through `stateUpdate`**: PASS. The snapshot builder
  (`progression.js:3114`) emits `p.cosmetic`, which now includes `hat`; player
  cosmetic is sourced from the backfilled account record. Verified by the
  existing `cosmetic_runtime.test.js` snapshot key assertion (now includes
  `hat`). The field was reused, not duplicated, as specified.

## Debug scenario review (`hat-shop-currency`)
PASS on all three checks:
- **Gated to dev only**: reachable solely through the `debugScenario` socket
  event, itself guarded by `isDebugScenarioAllowed` (rejected under
  `NODE_ENV=production` and for non-local origins/hosts). Normal gameplay never
  triggers it.
- **End-state reachable normally**: the scenario only grants currency
  (`max(currency, 1000)`) while staying in the lobby. A real player reaches the
  same state by earning currency in dungeon runs, then opening the same
  `unlockHat` flow — the scenario is a shortcut to having currency, not a
  bypass of any feature path.
- **No weakened invariants**: it does not pre-unlock hats or skip validation;
  the actual unlock still runs through `unlockHatForPlayer` (affordability) and
  `users.unlockHat` (catalog validation + persistence).

## Consistency with design / requirements
Consistent with the established cosmetic/currency architecture (181 cosmetic
profile, `buyShopCard`/`grindCard` purchase flows). No foundation regression;
existing cosmetic fields and currency flows are untouched apart from additive
extension. Client rendering of hats is correctly deferred (server-only feature).

## Remaining gaps
None blocking. See `nits.md` for non-blocking follow-ups (no dedicated unit
test for the `unlockHat` socket handler / `unlockHatForPlayer` / account-level
`unlockHat`, which are currently only covered indirectly).

VERDICT: PASS
