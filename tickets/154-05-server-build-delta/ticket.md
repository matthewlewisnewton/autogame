# Server: buildStateDelta (pure)

## Difficulty: medium
## Verification: code
## Depends on: 154-04-delta-envelope

## Goal
A pure function that diffs two full state snapshots into the delta envelope.
No broadcast wiring in this ticket — just the diff + tests.

## Acceptance Criteria
- `buildStateDelta(prev, next)` returns `{changed, removed}` per the 154-04
  envelope: entities added/changed go in `changed` (per-field where practical,
  else whole entity); entities gone from `next` go in `removed` by id+kind.
- Identical `prev`/`next` → empty delta (no changed, no removed).
- `buildKeyframe(next)` returns a full-state message with `keyframe:true`.
- Tests cover add / field-change / remove / no-op across players, enemies,
  minions, loot.

## Technical Specs
- New `game/server/stateDelta.js` (pure; imports the 154-04 envelope). Does NOT
  touch the broadcast loop.

## Verification: code
- Unit tests for the four cases + keyframe shape. `pnpm test:quick` green.
