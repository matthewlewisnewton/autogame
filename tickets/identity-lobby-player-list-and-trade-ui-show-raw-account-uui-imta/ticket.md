# identity: lobby player list and trade UI show raw account UUIDs instead of player names

## Difficulty: medium

## Goal

The lobby 'PLAYERS' panel lists entries like '883ce17a-27c2-4975-ab4f-636ac81b4de0 — Standby' (raw accountId/playerId) instead of the registered username. Saving a display name via the account overlay ('Save name' succeeded with no error) changes nothing — the list still shows the UUID. The Card Economy trade-target dropdown and the portrait character-id (first 2 chars of the UUID, e.g. 'DD'/'9F') have the same problem. The in-world nameplate above the avatar DOES show the username, so the data exists. In multiplayer both players see each other only as UUIDs, which makes party coordination and trading effectively anonymous. Repro: register any user, create a lobby, open the lobby overlay.

## Acceptance Criteria

- Lobby player list, trade target selector, and any HUD identity element render the username/display name; saving a display name in the account overlay is reflected in the lobby player list without rejoin; UUIDs no longer appear anywhere in player-facing UI.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
