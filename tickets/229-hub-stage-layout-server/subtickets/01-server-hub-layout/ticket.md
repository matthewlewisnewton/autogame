# Server: Hub stage layout generation

Add a `hub` layout profile to `generateLayout()` via a dedicated `generateHub(seed)`
helper that produces a compact, deterministic ship-interior stage: three connected
zone rooms (Operations, Commerce, Salon) with flat walkable floors, standard wall
gaps and passage corridors, and a `boothAnchors` map of named `{ x, z }` positions
for quest, launch, shop, deck, character, and hats booths.

## Acceptance Criteria

- `generateLayout(seed, 'hub')` returns a layout whose `profile` field is `'hub'`.
- The layout contains **exactly three rooms**, each tagged with `hubZone`:
  - `'operations'` — quest board + launch booth area (west / entry side).
  - `'commerce'` — shop + deck booth area (centre).
  - `'salon'` — character + hats booth area (east).
- Rooms are **connected and fully walkable**: at least two `passages` entries link
  the three rooms (Operations ↔ Commerce ↔ Salon) with aligned wall gaps and
  passage side walls so a player can reach every room from the Operations spawn
  without clipping through walls (verified manually via `buildWallColliders` +
  `computeWalkableAABBs` in the follow-up test ticket).
- Each room has flat `floorCorners` at `DEFAULT_FLOOR_Y`, perimeter walls on exterior
  edges, and `passageWidth`-sized gaps only where a passage connects.
- Operations room carries `role: 'start'` and `spawnWeight: 0`; Commerce and Salon
  use `role: 'connector'` (or another non-spawn role) with `spawnWeight: 0` so hub
  booths do not become combat spawn points.
- Layout includes `boothAnchors` — an object with **exactly these six keys**:
  `quest`, `launch`, `shop`, `deck`, `character`, `hats`. Each value is
  `{ x, z }` (numbers). Each anchor lies inside its zone room's interior (not on
  a wall) and at least 1 unit from room edges.
- Anchor grouping matches zones: `quest` and `launch` fall inside the Operations
  room; `shop` and `deck` inside Commerce; `character` and `hats` inside Salon.
- Deterministic: two calls to `generateLayout(seed, 'hub')` with the same seed yield
  deep-equal layouts (`rooms`, `passages`, `boothAnchors`).
- `generateHub` is exported from `game/server/dungeon.js` alongside the other bespoke
  stage generators.

## Technical Specs

- `game/server/dungeon.js`:
  - Add a `HUB` constants block (room sizes, spacing, passage width reuse from
    `PASSAGE_WIDTH`) for the compact interior footprint.
  - Add `'hub'` to `LAYOUT_PROFILES` (mirror `'open-plaza'` / `'sunken-canyon'`:
    entry exists so the string profile resolves; generation is handled by a branch).
  - In `generateLayout()`, branch `if (profile === 'hub') return generateHub(seed)`.
  - Implement **`generateHub(seed)`**:
    - Hand-place three axis-aligned rooms in a row or shallow L (keep total span
      compact — each room roughly 10–14 units wide/deep).
    - Build room `walls` arrays using the same `{ x, z, length, axis }` shape as
      the procedural generator; reuse `buildHorizontalWallWithGaps` where helpful.
    - Build `passages` as objects `{ x1, z1, x2, z2, walls, corridorLength }` using
      the same corridor-wall pattern as the grid path (see Step 6 in
      `generateLayout`).
    - Set `hubZone` on each room; assign roles explicitly (do not call
      `assignRoomRoles` — hub roles are fixed).
    - Compute `boothAnchors` as fixed offsets within each zone room (e.g. opposite
      corners of the room floor for the two booths in that zone).
    - Return `{ rooms, passages, boothAnchors, passageWidth, cellSpacing, profile: 'hub' }`.
  - Export `generateHub` in `module.exports`.
- `game/server/simulation.js`: **no changes expected** — existing
  `buildWallColliders` / `computeWalkableAABBs` already handle rooms + passages.
- Do **not** wire a quest or debug scenario in this sub-ticket; layout generation
  only.

## Verification: code
