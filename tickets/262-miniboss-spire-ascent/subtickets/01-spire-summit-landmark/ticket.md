# 01 — Spire summit landmark

Add a deterministic `spire_summit` layout landmark on the spire-ascent treasure tier so the stage-boss encounter framework (ticket 258) can anchor the summit fight at the tower top instead of falling back to the start tier.

## Acceptance Criteria

- `generateLayout(seed, 'spire-ascent', …)` returns a `landmarks` array with exactly one entry `{ type: 'spire_summit', x, z }` at the treasure-tier room centre for both `layoutMode: 'default'` and `layoutMode: 'rigid'`.
- The landmark coordinates match the `role: 'treasure'` tier room's `x`/`z` (not a ramp/connector room).
- Rigid Tier-2 spire layouts remain structurally unchanged aside from the new `landmarks` field; existing room/edgeHazard invariants still pass.
- `game/server/test/dungeon.test.js` asserts landmark presence, type, and treasure-tier placement for default and rigid modes.

## Technical Specs

- **`game/server/dungeon.js`** — In `generateSpireAscent()`, after building tiers, set `landmarks: [{ x: treasureRoom.x, z: treasureRoom.z, type: 'spire_summit' }]` on the returned layout object (treasure room = top tier with `role: 'treasure'`).
- **`game/server/test/dungeon.test.js`** — Extend the `generateLayout(seed, 'spire-ascent')` describe block with cases for default and rigid modes: `landmarks` length 1, type `spire_summit`, coordinates equal treasure-tier centre.
- No quest wiring, enemy types, or encounter logic in this sub-ticket.

## Verification: code
