# 163-cleanup-dedupe-card-defs-server-client

## Difficulty: medium

## Goal

Card identity data is duplicated across game/server/progression.js:108 (CARD_DEFS, ~56 entries) and game/client/cards.js:9 (CARD_DEFS, 44 entries). id/name/type/charges are copied in both files (e.g. Rust-Forged Saber, Solar Edge, Vault Wyrm, Phase Stalker). A rename or charge change must be made in two places with no test linking them; drift is silent. The two objects intentionally carry different fields (server: damage/effect/cooldown; client: rendering hints), so the shared piece is the identity subset only. game/shared/ already hosts cross-cutting data (constants.json, theme.json, floorSampling).

## Acceptance Criteria

- Implements the Goal above; the change is scoped to it.
- Existing server + client tests pass; the game starts and loads cleanly.

## Verification

`Verification: code`
