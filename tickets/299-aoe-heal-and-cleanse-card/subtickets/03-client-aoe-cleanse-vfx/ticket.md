# Client Purifying Pulse AoE heal + cleanse VFX

Render a visible AoE heal ring plus a brief cleanse burst when `purifying_pulse` is cast. Depends on sub-ticket 02 emitting `radius`, `origin`, and `specialEffect: 'heal_and_cleanse'` on `CARD_USED`.

## Acceptance Criteria

- When `purifying_pulse` is played, the client shows an expanding heal ring at `data.origin` scaled to `data.radius` (reuse or extend the `triggerHealPulseVFX` / `spawnDivineGraceEffect` pattern).
- A secondary cleanse visual plays at the same origin — e.g. a brief white/teal upward sparkle burst or shimmer ring distinct from the green heal ring — so the cast reads as both heal **and** cleanse, not a plain self-heal.
- `game/client/cardRenderers.js` registers `purifying_pulse` with a dedicated renderer in `CARD_RENDERERS` (not the generic spell-burst default).
- Heal sound plays on cast (same `playSound('heal')` or equivalent used by other heal cards).
- `game/client/test/cardRenderers.test.js` includes a test that a `purifying_pulse` payload with `radius` and `origin` invokes both the heal-ring helper and the cleanse helper on the mock ctx.
- Existing `healing_font` / `divine_grace` renderer tests continue to pass (no regression).

## Technical Specs

- **`game/client/renderer.js`**:
  - Add `spawnPurifyingPulseEffect(origin, radius)` that composes an expanding green heal ring (mint palette, distinct from Divine Grace gold) plus a short-lived white/teal cleanse burst particle or ring at the cast point.
  - Animate fade/expansion in the existing `activeEffects` update loop (same duration pattern as `spawnDivineGraceEffect` / `triggerHealPulseVFX`).
- **`game/client/main.js`**: expose `spawnPurifyingPulseEffect` on the `renderCardUsed` ctx bundle (same pattern as `spawnDivineGraceEffect`).
- **`game/client/cardRenderers.js`**:
  - Implement `renderPurifyingPulse(data, ctx)` calling the new effect helper when `data.radius` is defined; play heal sound.
  - Register `purifying_pulse: renderPurifyingPulse` in `CARD_RENDERERS`.
- **`game/client/test/cardRenderers.test.js`**: add `purifying_pulse` renderer test with mocked effect helper and sound calls.
- Do **not** change server combat logic in this sub-ticket.

## Verification: code
