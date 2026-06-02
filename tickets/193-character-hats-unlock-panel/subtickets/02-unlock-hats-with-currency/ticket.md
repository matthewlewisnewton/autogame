# 02 — Unlock Locked Hats by Spending Currency

Add the client-side unlock flow to the hat list built in sub-ticket 01: locked
hats show their price and an **Unlock** action that spends the player's currency
via the existing server `unlockHat` Socket.IO flow. The server handler
(`socket.on('unlockHat')` emitting `hatUnlocked` / `hatError`) and the currency
HUD already exist — this sub-ticket wires the client UI to them. Depends on
sub-ticket 01.

## Acceptance Criteria
- Each **locked** catalog hat entry shows its `price` and an **Unlock** control.
  The Unlock control is disabled (and visibly so) when the player's current
  currency is less than the hat's `price`.
- Clicking an enabled Unlock control emits `socket.emit('unlockHat', { hatId })`
  using the active game socket. Owned hats (including `'none'`) show no Unlock
  control.
- On the `hatUnlocked` event (`{ unlockedHats, currency }`): the client updates
  the cached `unlockedHats`, updates the currency HUD/`myCurrency` from the
  returned `currency`, and re-renders the hat list so the newly unlocked hat
  becomes an equippable (owned) entry rather than a locked one.
- On the `hatError` event (`{ reason }`): a visible error message is shown in the
  panel's `#cosmetic-error` line; no currency or ownership state changes.
- Unlocking does NOT auto-equip the hat — the player still equips it via the
  sub-ticket 01 equip control (which persists through Save). State changes only
  in response to the server events, never optimistically before `hatUnlocked`.

## Technical Specs
- `game/client/settings.js`: add a setter `setUnlockedHats(list)` (validate to
  an array, dedupe, always include `'none'`) so the client can record an unlock
  from a `hatUnlocked` event without re-fetching `/api/me`. Export it.
- `game/client/main.js`:
  - In the hat-list renderer from sub-ticket 01, for locked hats add the price
    label + an Unlock button; disable it when `myCurrency < hat.price`. Wire its
    click to `socket.emit('unlockHat', { hatId })` (guard on a connected socket).
  - Register `socket.on('hatUnlocked', (data) => { ... })`: call
    `setUnlockedHats(data.unlockedHats)`, update currency via the existing
    `updateCurrencyHud` / `myCurrency` path when `data.currency` is finite, then
    re-render the hat list (e.g. `refreshHatList()`).
  - Register `socket.on('hatError', (data) => showCosmeticError(data.reason ...))`.
  - Place the socket handler registration alongside the other `socket.on(...)`
    registrations created when the socket connects (where `unlockHat`'s sibling
    lobby events like `buyShopCard` results are handled).
- Re-render affordability when currency changes while the panel is open is
  acceptable but not required; at minimum the list reflects correct
  owned/locked/affordable state each time the panel is opened or a hat is
  unlocked.

## Verification: code
