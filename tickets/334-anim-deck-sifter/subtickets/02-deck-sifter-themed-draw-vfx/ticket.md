# Deck Sifter: distinctive card-sifting cast VFX

Replace Deck Sifter's generic single parchment particle burst with a visual
that reads unmistakably as sifting/riffling through a deck to draw a card —
a layered, staggered parchment-gold flourish rising from the caster — using
only the existing shared (315) VFX primitives. Build on sub-ticket 01 so the
effect now spawns at the caster origin.

## Acceptance Criteria
- `renderDeckSifter` no longer emits just one `spawnParticleBurst`; it composes
  a recognizable card-draw flourish from existing ctx primitives only
  (e.g. several offset/staggered `spawnParticleBurst` calls to suggest a fan or
  riffle of cards, optionally plus a short ground `spawnImpactDecal`/
  `spawnTelegraphRing` accent). No new ctx primitive or VFX function is added.
- Palette stays on the card's parchment/gold theme (matches the existing
  `0xf5deb3` / `0xdaa520` family and the `deck_sifter` card color `#d4a843`),
  so it reads as cards/parchment, not as a combat hit.
- Because `draw_card` resolves instantly server-side (one `CARD_USED`, no
  projectile, DoT, or wind-up), the flourish fires on cast; any internal
  stagger uses `ctx.scheduleAfter` and stays short (total well under ~300ms) so
  it remains synced to the instant draw — no artificial long delay.
- All effects originate at `originOf(data)` (the caster), and the renderer still
  no-ops safely when a primitive (e.g. `spawnParticleBurst`) is absent.
- No per-frame allocation or perf regression: the renderer only fires on the
  `cardUsed` event (no work added to the animation/render loop).
- `deck_sifter` remains registered to `renderDeckSifter` in `CARD_RENDERERS`.
- The client test for `deck_sifter` is updated to assert the new composed
  visual (e.g. multiple `spawnParticleBurst` calls at caster-relative
  positions and/or the added accent primitive, on-theme colors), and the full
  `game/client` test suite passes.

## Technical Specs
- `game/client/cardRenderers.js`: rewrite `renderDeckSifter(data, ctx)` (near
  line 2155) to compose the multi-element flourish described above using only
  ctx primitives already listed in the file header (`spawnParticleBurst`,
  `spawnImpactDecal`, `spawnTelegraphRing`, `spawnProjectileTrail`,
  `scheduleAfter`, etc.). Keep the existing `if (!ctx.spawnParticleBurst) return;`
  style guards so missing primitives don't throw. Use `originOf(data)` for all
  positions; offsets may use `directionOf(data)` / `pointAlong` for the fan.
  Leave the `deck_sifter: renderDeckSifter` registration entry intact.
- `game/client/test/cardRenderers.test.js`: update the existing `deck_sifter`
  describe block (near line 3843) to match the new composition and assert the
  on-theme colors and caster-relative positions; keep the
  "does not throw when spawnParticleBurst is absent" guard test passing.

## Verification: code
