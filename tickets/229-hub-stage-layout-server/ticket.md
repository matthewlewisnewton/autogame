# 229-hub-stage-layout-server

## Difficulty: medium

## Goal

Compact multi-room ship-interior stage layout in game/server/dungeon.js (a few grouped rooms: Operations=quest+launch, Commerce=shop+deck, Salon=character+hats), with named booth-anchor positions. Reuses the STAGE_PROFILES system.

## Acceptance Criteria

- 1. Add a 'hub' layout profile (generateHub) with a few connected rooms + named booth anchors. 2. Walkable geometry/collision like other stages. 3. Server unit test for layout generation + anchor positions.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
