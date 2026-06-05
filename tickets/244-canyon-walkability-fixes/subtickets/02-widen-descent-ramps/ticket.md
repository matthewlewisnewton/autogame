# 02 — Widen descent ramps and eliminate X overlap

Even after interior wall dedupe, three 4-unit-wide ramps centred at `-3.5 / 0 / 3.5` only cover `x ∈ [-5.5, 5.5]`, leaving most of the 32-unit canyon width disconnected from the descent corridor. Widen ramps and/or respacing so adjacent ramps do not overlap in X and the combined bridge span is wide enough for comfortable traversal.

## Acceptance Criteria

- `SUNKEN_CANYON.rampWidth` is at least `6` (or equivalent: fewer ramp rooms whose combined X span is contiguous with no pairwise interval overlap).
- For every seed in `[1..30]`, ramp room X intervals are pairwise disjoint (no overlapping ramp footprints).
- The union of all ramp room X intervals spans at least `[-9, 9]` on the horizontal axis (covers the centre third of the canyon width and aligns gaps with plateau/canyon north walls).
- `buildHorizontalWallWithGaps` gap centres and widths used for plateau south and canyon north walls match the updated ramp centres and widths (no new solid wall blocking a ramp opening).
- Existing sunken-canyon tests for ramp count (2–3), slope ≥ 0.15, and Y drop ≥ 8 still pass.

## Technical Specs

- **`game/server/dungeon.js`**
  - Update `SUNKEN_CANYON.rampWidth` (4 → 6) and adjust `rampXOffsets` so three-ramp seeds stay disjoint (e.g. wider spacing or deterministic 2-ramp layouts for tight seeds — document choice in code comments only if non-obvious).
  - Ensure `rampCenters` passed to `buildHorizontalWallWithGaps` for plateau and canyon north edges use the same centres/widths as ramp rooms.
  - Revisit interaction with sub-ticket 01 wall suppression: widening may reduce need for dedupe but both behaviours must coexist cleanly.
- **`game/server/test/dungeon.test.js`** — only if an existing assertion hard-codes `rampWidth: 4` or specific offset values; update to match new constants.

## Verification: code
