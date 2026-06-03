# Senior Review — 190-character-hats-asset-starter-hats

## Runtime health (gate)
- `metrics.json`: `"ok": true`, dev servers started, browser reached `phase: "playing"`,
  `connectionState: "connected"`, scene initialized, two players, gameplay probes succeeded.
- `pageerrors`: `[]` (empty). No `harness_failure` block.
- `console.log`: clean — only Vite connect lines and `[initScene]` logs. No `pageerror`/`[fatal]`.
- **Game runs and loads cleanly.** Runtime gate PASSES.

## Top-level ticket note
The top-level `ticket.md` never materialized (empty/missing). The decomposer reconstructed
intent from the slug and the already-shipped ticket-189 hat pipeline: add a set of **free,
default-owned starter hats** plus their render meshes. This is a sound reconstruction —
ticket 189 left `none` as the only default-owned hat, so "starter hats" maps directly to
adding free default-owned cosmetics. Judged against that reconstructed scope and the two
sub-ticket acceptance criteria.

## Per-criterion findings

### Sub-ticket 01 — server catalog defaults (`game/server/cosmetic.js`)
- `HAT_CATALOG` now includes `{ id: 'bandana', name: 'Bandana', price: 0 }` and
  `{ id: 'beanie', name: 'Beanie', price: 0 }`, appended after the existing entries.
  Existing `none`/`cap`/`wizard`/`crown` entries and prices unchanged. ✅
- `DEFAULT_UNLOCKED_HATS` is `['none', 'bandana', 'beanie']` in the required order. ✅
- `backfillUnlockedHats` seeds the full `DEFAULT_UNLOCKED_HATS` set first (replacing the
  single `add('none')`), then appends `existing` ids, preserving dedupe + `HAT_IDS`
  membership guard and signature/return type. Legacy `['none']` records now retroactively
  gain the starter hats. ✅
- `HAT_IDS` is derived from the catalog, so both ids pass `validateCosmetic({ hat })`;
  test confirms a fresh account equips `bandana`/`beanie` via `updateProfile` without
  unlocking, and a locked `crown` is still rejected ("not unlocked"). ✅
- `unlockHat`/currency flow untouched; free hats are owned by default so no currency path
  is affected. ✅
- Tests extended in `cosmetic.test.js` covering catalog entries/prices, order,
  `DEFAULT_UNLOCKED_HATS`, both `backfillUnlockedHats` cases, dedupe/drop-unknown, and
  equip-without-unlock. ✅

### Sub-ticket 02 — render meshes (`game/client/renderer.js`)
- `AVATAR_HAT_IDS` includes `bandana` and `beanie` alongside the existing ids, in sync
  with the server catalog. ✅
- New color constants `HAT_BANDANA_COLOR` (crimson) and `HAT_BEANIE_COLOR` (slate teal),
  distinct from cap/wizard/crown and body/accent defaults. ✅
- `buildHatMesh('bandana')` returns a `THREE.Group` (flat torus band + cone knot) with its
  base at/above the group origin (band tube bottom ≈ 0.01); visually distinct (red band +
  side knot). ✅
- `buildHatMesh('beanie')` returns a clipped upper-hemisphere `SphereGeometry` dome with
  base at the group origin; visually distinct snug dome. ✅
- `buildHatMesh` still returns `null` for `none`/unknown; cap/wizard/crown cases unchanged. ✅
- `cosmeticSignature` keys off `AVATAR_HAT_IDS`, so the new ids yield distinct signatures and
  trigger avatar rebuilds (line 1301). Seating uses the unchanged `bodyTopY(shape)` at the
  call site (line 1349); the new meshes seat exactly like existing hats and dispose through
  the existing traversal. ✅

## Integration
- Server `HAT_CATALOG` ids and client `AVATAR_HAT_IDS` agree on the two new ids. ✅
- No debug scenarios added or changed by this ticket.
- `pnpm test` (from `game/`): **68 files, 1548 tests, all passing.**

The visual capture uses the default `none` hat, so the new hats do not appear on screen —
expected and called out by the decomposer; this is a code-verification ticket and the logic
is exercised by unit tests.

## Remaining gaps
None. Both sub-tickets are fully and robustly implemented, tests pass, and the captured run
is clean.

VERDICT: PASS
