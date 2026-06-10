# Theme quest entry rooms per biome — first 30 seconds of every level currently look identical

## Difficulty: easy

## Goal

Playtest observation (2026-06-09): biome theming only appears deep in the level (frost's blue slippery arena, ember's purple basin) while every start room renders the same stone/green. Since the start room is the first thing a player sees on deploy, all quests make an identical first impression.

DESIGN
The layout data already carries per-room band/floorSurface (dungeon.js room.band: 'stone' | 'ice' | 'ramp' etc.). Give entry/connector rooms biome-flavored bands (or a per-profile palette) in the ice-cavern / fire-cavern / sunken-canyon / spire generators, and have the client floor/wall tinting pick up the profile palette in the start room, plus a light dressing pass (e.g. icicle/ember scatter props reusing existing cover-scatter machinery).

ACCEPTANCE
- Screenshot of the spawn room in frost_crossing, ember_descent, and training_caverns are visually distinguishable at a glance (different floor/wall palette or props).
- No gameplay/collision changes.

Refs @ commit b4a5bb8 (may drift): generateIceCavern/generateFireCavern in game/server/dungeon.js; client floor rendering in game/client/renderer.js.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
