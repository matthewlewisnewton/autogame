# Server: Hub stage layout and booth anchors

Add a `hub` layout profile to `generateLayout()` that produces a compact
ship-interior stage: three connected zone rooms (Operations, Commerce, Salon) and
named `boothAnchors` for lobby UI placement (quest, launch, shop, deck, character,
hats).

## Acceptance Criteria

- `generateLayout(seed, 'hub')` returns a layout with `profile: 'hub'`.
- Layout has **exactly three** walkable zone rooms tagged `band: 'operations' |
  'commerce' | 'salon'` (one room per zone), plus **passages** that connect every
  zone so the graph is fully connected (no orphan room).
- Room footprints stay **compact** (each zone roughly 10–16 units wide/deep; total
  stage footprint clearly smaller than `open-plaza` / sunken-canyon).
- All zone floors use flat `floorCorners` at `DEFAULT_FLOOR_Y` (no slopes).
- `layout.boothAnchors` is a plain object with **exactly these keys**:
  `quest`, `launch`, `shop`, `deck`, `character`, `hats`. Each value is `{ x, z
  }` (world coordinates).
- Anchor placement matches zone intent:
  - `quest` and `launch` lie inside the **operations** room AABB.
  - `shop` and `deck` lie inside the **commerce** room AABB.
  - `character` and `hats` lie inside the **salon** room AABB.
- Pairs in the same zone are separated by ≥ 2 units (centre-to-centre) so booths do
  not overlap.
- Roles are assigned explicitly (do not rely on default `assignRoomRoles` over a
  bespoke graph): **operations** = `start`, other zones = `connector` with
  `spawnWeight: 0` (hub is a social space, not combat/treasure routing).
- **Deterministic**: two calls with the same seed produce deep-equal layouts
  (including `boothAnchors`).
- Unit tests in `game/server/test/dungeon.test.js` cover: profile, three bands,
  connectivity (adjacency / passage endpoints touch the correct rooms), all anchor
  keys, in-room bounds, minimum separation, roles, and determinism.

## Technical Specs

- `game/server/dungeon.js`:
  - Add `HUB` tuning constants (zone sizes, passage width, anchor inset from room
    walls).
  - Add `'hub'` to `LAYOUT_PROFILES` (placeholder entry like `open-plaza` /
    `sunken-canyon` so the string profile resolves).
  - Branch in `generateLayout()` to `generateHub(seed)` when `profile === 'hub'`.
  - **`generateHub(seed)`**:
    - Use `mulberry32(seed)` for any optional jitter within fixed geometry.
    - Place three axis-aligned rooms in a compact L or T arrangement (e.g.
      Operations at centre as spawn deck, Commerce and Salon on opposite sides
      linked by `passages` with `PASSAGE_WIDTH` mouths aligned to room edges).
    - Build perimeter `walls` on exterior edges; leave passage-aligned edges open
      via `buildHorizontalWallWithGaps` (same helpers as sunken-canyon / spire).
    - Set `boothAnchors` at stable offsets inside each zone (e.g. quest/launch on
      opposite halves of Operations).
    - Return `{ rooms, passages, boothAnchors, passageWidth, cellSpacing, profile:
      'hub' }`.
  - Export `generateHub` from `module.exports`.
- `game/server/test/dungeon.test.js`:
  - New `describe("generateLayout(seed, 'hub')")` block with helpers to find rooms
    by `band` and to test anchor containment / separation.

## Verification: code
