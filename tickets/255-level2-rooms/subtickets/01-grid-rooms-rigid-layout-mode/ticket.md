# 01 — Crowded & open rigid layout mode

Extend the reusable `layoutMode: 'rigid'` option from ticket 254 to the standard multi-room grid profiles (`crowded` and `open`) so Tier-2 runs get seed-stable geometry and dressing while preserving each profile's identity (dense reactor/pipe landmarks vs sparse sand-spire platforms and pits).

## Acceptance Criteria

- `generateLayout(seed, 'crowded' | 'open', options)` threads `layoutMode` through the main grid generator; unknown modes fall back to `'default'`.
- In `'default'` mode, current crowded/open behavior is unchanged (RNG room growth, sizes, extra loop edges, slope picks, and shuffled cover/landmark/platform scatter).
- In `'rigid'` mode, structural RNG is removed or pinned so layouts are identical across different seeds for the same profile: fixed room graph topology, fixed room dimensions, no random extra loop edges, and deterministic slope ramp selection when `slopes: true`.
- Rigid crowded layouts still satisfy existing crowded invariants: `profile: 'crowded'`, ≥1 cover piece per flat combat room, `reactor_coil` / `pipe_stack` landmark types only, and full interior reachability in every combat room.
- Rigid open layouts still satisfy existing open invariants: `profile: 'open'`, raised platforms and shallow pit hazards in combat rooms, `sand_spire` / `sun_arch` landmark types only, and light cover scatter rules.
- Rigid dressing (`cover`, `landmarks`, and for open also `platforms` / `hazards`) is seed-independent for a given profile; default mode still varies cover/hazard counts or positions across a seed sweep.
- `getLayoutGenerationOptions` is unchanged in this sub-ticket (no quest-tier wiring yet).
- Unit tests in `game/server/test/dungeon.test.js` prove rigid determinism across seeds and that default mode still varies for both profiles; `pnpm test:quick` passes.

## Technical Specs

- **`game/server/dungeon.js`**
  - Read `normalizeLayoutMode(options.layoutMode)` at the start of the main grid `generateLayout` path (after profile normalization, before room growth).
  - Add per-profile rigid constants on `LAYOUT_PROFILES.crowded` / `.open` or a small `GRID_RIGID` block (fixed start cell, fixed room width/depth, `extraEdgeFraction: 0`, deterministic frontier/spanning-tree picks, fixed ramp room indices and count).
  - Refactor `decorateCrowdedLayout(layout, rng, options)` and `decorateOpenLayout(layout, rng, options)` to accept `layoutMode`:
    - **Rigid crowded:** fixed cover count per combat room; build candidate pools in declaration order (no Fisher–Yates shuffle); accept cover via existing `acceptsCoverCandidate` / `roomFullyReachable`; place landmarks in sorted room order with the first allowed `LANDMARK_TYPES.crowded` type.
    - **Rigid open:** fixed platform/hazard/cover goals; ordered candidate acceptance using existing `acceptsOpenFootprint` helpers instead of shuffled pools.
  - Reuse or extract a small ordered-placement helper (similar to `placeCoverInArenaOrdered`) where it reduces duplication; do not change bespoke profiles (`open-plaza`, `spire-ascent`, etc.).
- **`game/server/test/dungeon.test.js`**
  - New `describe` blocks for `generateLayout(seed, 'crowded') rigid layoutMode` and `generateLayout(seed, 'open') rigid layoutMode`:
    - Unknown `layoutMode` falls back to default scatter behavior.
    - Rigid mode: two different seeds yield deep-equal structural fields (`rooms`, `passages`) and dressing (`cover`, `landmarks`; open also `platforms`, `hazards`).
    - Rigid mode: still passes existing crowded/open structural and reachability assertions.
    - Default mode: cover or hazard arrays still vary across a seed sweep (prove rigid is not the default path).
    - Rigid vs default can diverge for the same seed.
  - Call `generateLayout(seed, profile, { slopes: true, layoutMode: 'rigid' })` directly; no `quests.js` changes in this sub-ticket.

## Verification: code
