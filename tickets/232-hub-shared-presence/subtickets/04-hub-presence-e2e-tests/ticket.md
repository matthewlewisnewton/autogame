# Hub shared presence: integration and regression tests

Lock in end-to-end hub presence behavior across server broadcast and client
merge, including cosmetics and membership changes. Depends on sub-tickets
01–03.

## Acceptance Criteria

- Server integration: two authenticated clients in the same lobby (lobby phase)
  with distinct cosmetics; after A moves via `move`, B's merged player record
  for A has `x`/`z` strictly different from hub spawn (within tolerance).
- Server integration: when B joins after A, A receives `hubPresenceUpdate` (or
  already has B via tick) with B's entry including `cosmetic` and `username`.
- Server integration: when B `leaveLobby`, A's next `hubPresenceUpdate` lists B
  in `removedPlayerIds` and omits B from `presence.entries`.
- Client test: applying a sequence of `hubPresenceUpdate` payloads updates
  remote mesh position and `userData.cosmeticKey` when cosmetic changes.
- `pnpm test:quick` (from `game/`) passes with the new tests included.

## Technical Specs

- `game/server/test/hub_presence_integration.test.js` (new) — extend patterns
  from `lobby_hub_movement.test.js` and `integration.test.js` (`connectTwoClients`,
  `waitForEvent`, `hubSpawnPosition`, `HUB_LAYOUT`).
- `game/client/test/hub-presence-avatars.test.js` — add cases for cosmetic change
  and `removedPlayerIds` cleanup if not already covered in sub-ticket 03.
- Optional: add a short comment in `game/server/test/hub_presence.test.js`
  pointing to the integration file for broadcast contracts (no duplicate
  coverage required).

## Verification: code
