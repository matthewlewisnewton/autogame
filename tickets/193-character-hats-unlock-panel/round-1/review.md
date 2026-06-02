# Senior Review — 193-character-hats-unlock-panel

## Runtime health (gate)
- `metrics.json`: `"ok": true`, servers started on :3000/:5173, `pageerrors: []`,
  no `harness_failure` block. `pageerrors.json` is empty.
- `console.log` / `client.log` / `server.log`: only benign noise (Vite connect,
  `[initScene]` logs, two `THREE.Clock` deprecation warnings). No `pageerror`,
  no `[fatal]`, no uncaught exception from game code. Players connected,
  reached `phase: "playing"`, scene initialized, canvas present.
- **The game starts and loads cleanly.** Gate passed.

Note: the source top-level `ticket.md` was missing from the worktree; the
decomposer reconstructed scope into two sub-tickets (`decompose.txt`). I judged
against those reconstructed ACs plus the live server contract (`account.js`,
`cosmetic.js`, `users.js`, the `unlockHat` socket flow), which the client now
consumes.

## Per-criterion findings

### Sub-ticket 01 — hat state cache, equip & preview
- **Cosmetic cache includes `hat`** — `DEFAULT_COSMETIC.hat = 'none'`;
  `normalizeCosmetic` coerces non-string `hat` to `'none'`; `getAccountCosmetic()`
  returns the 4-field object. ✓ (`settings.js`)
- **Caches `unlockedHats` + `hatCatalog`** — `loadAccountSettings` populates
  `cachedUnlockedHats`/`cachedHatCatalog` via `normalizeUnlockedHats`
  (always includes `'none'`) and `normalizeHatCatalog` (drops bad entries,
  defaults name→id, price→0). `getUnlockedHats()`/`getHatCatalog()` exported and
  always return arrays. Server `GET /api/me` does return both
  (`account.js:52-53`). ✓
- **Catalog rendered with owned/locked/equipped state** — `buildHatList()`
  renders one row per catalog hat, marks `.owned`/`.locked`, shows name and
  `Owned`/`Locked · <price>` status; `refreshHatList()` toggles `.selected` on
  the equipped entry. ✓ (`main.js`)
- **Click owned → equip + preview; click locked → no equip** — owned rows are
  `<button>`s whose click sets `cosmeticSelection.hat`, re-highlights, and calls
  `refreshCosmeticPreview()`. Locked rows are `<div>`s with no equip handler. ✓
- **Save includes `hat`; cache updates; re-sync shows saved hat** — save handler
  sends `hat: cosmeticSelection.hat` in the cosmetic payload;
  `patchProfile` updates `cachedCosmetic` from the server's returned cosmetic
  (`account.js` PATCH returns `user.cosmetic`); handler then re-runs
  `syncCosmeticForm()`. Server also persists. ✓
- **Open syncs to cached cosmetic/owned state** — `syncCosmeticForm` sets
  `cosmeticSelection.hat` from cache and rebuilds the list each open. ✓
- **Preview carries `hat`** — `cosmetic-preview.js` forwards the whole cosmetic
  (incl. `hat`) through `openPreview`/`updatePreview`→`mountAvatar`; previews are
  built from `{ ...cosmeticSelection }`. ✓

### Sub-ticket 02 — unlock locked hats by spending currency
- **Locked entries show price + Unlock control, disabled when unaffordable** —
  `buildHatList` adds an `Unlock` `<button>` for locked hats, `disabled` when
  `myCurrency < hat.price` (plus `aria-disabled`), styled via
  `.cosmetic-hat-unlock:disabled`. Owned hats (incl. `'none'`) get no Unlock
  control. ✓
- **Click emits `unlockHat`** — guarded on affordability and a connected socket,
  emits `socket.emit('unlockHat', { hatId })`. ✓
- **`hatUnlocked` handling** — `setUnlockedHats(data.unlockedHats)`, updates
  `myCurrency`/HUD when `data.currency` is finite, then re-renders via
  `buildHatList()`. Server sends `{ unlockedHats, currency }` after deducting and
  persisting (`index.js:3365`). ✓
- **`hatError` handling** — shows `data.reason` in `#cosmetic-error`; no state
  change. ✓
- **No optimistic / no auto-equip** — client mutates owned/currency state only in
  the `hatUnlocked` handler; unlock never sets `cosmeticSelection.hat`. ✓

## Integration & robustness
- **Server enforces ownership on equip** (`users.js:248-252`): a PATCH equipping
  a non-unlocked hat is rejected, so the client's owned-only gating is
  defense-in-depth, not the sole guard. Unlock flow validates affordability,
  catalog membership, already-owned, and refunds currency on persistence
  failure (`index.js:3349-3363`). Solid.
- No console errors in the captured run; no dead/broken code in the diff; hat
  list helpers are hoisted function declarations referenced before their textual
  position without issue.

## Debug scenario `hats-unlocked` (added by this ticket)
- **Dev-gated only**: entered solely via the `debugScenario` socket event, itself
  guarded by `isDebugScenarioAllowed` (local address/origin/host, non-production,
  or `ALLOW_DEBUG_SCENARIOS=1`). Normal gameplay never calls
  `applyDebugScenario`. ✓
- **End state reachable normally**: it persists real unlocks via
  `unlockHatForAccount` (same persistence path as the live `unlockHat` flow),
  leaving the last catalog hat locked so both owned and locked branches show. The
  equivalent owned state is reachable by earning currency and using the unlock
  flow. ✓
- **No invariant short-circuit**: it persists via the real account API and does
  not bypass net-replication or equip validation. It only skips the currency
  spend for setup convenience, which is appropriate for a QA shortcut. ✓

## Remaining gaps
None. The captured run is clean and all reconstructed acceptance criteria are
fully and robustly met, with server-side validation backing the client UI.

(The fallback smoke capture did not open the Account overlay, so the hat panel
was exercised by code review rather than a screenshot — non-blocking; the panel
mounts from the same module graph that loaded without error.)

VERDICT: PASS
