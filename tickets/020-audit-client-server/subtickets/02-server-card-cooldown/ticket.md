# Server Card Cooldown Enforcement

The server currently processes every `useCard` intent as long as the hand slot has charges. There is no server-side cooldown or rate limit — the only pacing is the client's UI `slotCooldowns` array, which a custom client can bypass by spamming `useCard`. Add authoritative per-slot cooldown tracking on the server and reject use attempts that occur before the cooldown expires.

## Acceptance Criteria
- After a card is successfully used from slot `i`, the server records `player.slotCooldowns[i] = Date.now() + COOLDOWN_MS`.
- On a subsequent `useCard` for the same slot, if `Date.now() < player.slotCooldowns[i]`, the server silently rejects the request and emits a `cardError` to the requesting socket.
- The cooldown applies to all card types (weapon, summon, monster).
- The cooldown timer resets when the game phase changes (e.g., return to lobby) or when a new run starts, so cooldowns from a previous run don't carry over.
- Legitimate card uses after the cooldown expires are processed normally.

## Technical Specs
- **File**: `game/server/index.js` — In the `socket.on('useCard', ...)` handler:
  1. After hand validation (line checking `player.hand[data.slotIndex]`), add cooldown check:
     ```
     const now = Date.now();
     if (player.slotCooldowns && player.slotCooldowns[data.slotIndex] && now < player.slotCooldowns[data.slotIndex]) {
       socket.emit('cardError', { reason: 'Slot on cooldown' });
       return;
     }
     ```
  2. At the end of each successful card branch (weapon, summon, monster), set the cooldown: `player.slotCooldowns[data.slotIndex] = now + COOLDOWN_MS;`
  3. Initialize `slotCooldowns: [null, null, null, null]` on the player object when created (in the `socket.on('connection')` block where `gameState.players[socket.id]` is set).
  4. Reset cooldowns on run start: in `checkAllReady()` (or wherever `initPlayerHand` is called), set `player.slotCooldowns = [null, null, null, null]`. Also reset in `returnPlayersToLobby()`.
- **File**: `game/server/config.js` — Add `const COOLDOWN_MS = 800;` (server-side cooldown between uses of the same slot, in milliseconds).
- **No other files changed.** Do not modify client files, tests, or dungeon generation.

## Verification: code
