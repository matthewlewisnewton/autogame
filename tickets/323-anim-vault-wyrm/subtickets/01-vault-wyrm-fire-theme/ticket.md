# Vault Wyrm — fire/ember theme & palette

Re-skin the Vault Wyrm (`dungeon_drake`) summon and breath so they read
unmistakably as a fiery, ember-breathing hatchling wyrm instead of the
current generic **green melee swipe**. The card's effect is `burning_breath`
(it sets enemies on fire), so its cast/summon flourish and breath cone must
use a warm fire/ember palette that matches its name and element.

## Acceptance Criteria
- `CARD_ACCENT_STYLE` in `game/client/cards.js` gains a `dungeon_drake`
  entry with a warm fire/ember color (e.g. ember orange `#fb923c`) and a
  fire-themed icon (e.g. `🔥`), so `getAccentHex('dungeon_drake')` returns a
  warm hex instead of `undefined`.
- In `renderWyrmAttack` (`game/client/cardRenderers.js`), the Vault Wyrm
  breath is treated as fiery: the `burning_breath` `specialEffect` (not only
  `'fire_breath'`) selects a warm fire/ember palette for the cone
  `spawnAttackEffect`, the `spawnTelegraphRing`, and the along-cone
  `spawnParticleBurst`. The breath cone color/emissive are warm (orange/red
  family), NOT the previous green `0x22c55e` / `0x16a34a`.
- The Vault Wyrm summon-in (`renderWyrmSummon`) uses the new warm accent via
  `accentSummonStyle('dungeon_drake')` (i.e. the deploy flourish is warm, not
  default green).
- Cone geometry is unchanged: `range`/`coneAngle` still come from the
  server-provided `attackRange` / `attackConeAngle`, and the hit-spark / hit
  particle bursts on `data.hits` still fire at enemy-mesh positions.
- The Archive Wyrm (`ancient_wyrm`) renderers and palette are unchanged.
- Existing Vault Wyrm renderer tests in
  `game/client/test/cardRenderers.test.js` are updated to assert the new warm
  palette (replacing the `0x22c55e` / `0x16a34a` expectations), and the full
  client + server vitest suites pass.

## Technical Specs
- `game/client/cards.js` — add a `dungeon_drake` entry to
  `CARD_ACCENT_STYLE` (warm fire color + fire icon).
- `game/client/cardRenderers.js` — in `renderWyrmAttack`, broaden the
  fire-breath detection so `specialEffect === 'burning_breath'` (the Vault
  Wyrm's effect, see `game/shared/cardStats.json`) is also treated as a fiery
  breath, and derive `color`/`emissive` from the new `dungeon_drake` accent
  with a warm fallback rather than the green melee defaults. Keep
  `renderArchiveWyrmBreath` and the `WYRM_SUMMON_STYLES` geometry as-is.
- `game/client/test/cardRenderers.test.js` — update the two Vault Wyrm breath
  tests (`'Vault Wyrm minion breath renders a forward cone hitbox on breath
  start'` and the tick test) to expect the new warm color/emissive on
  `spawnAttackEffect`, `spawnTelegraphRing`, and the along-cone burst.
- Touch ONLY the Vault Wyrm render fn + its accent/registration and the
  related tests; do not alter server logic or other cards' renderers.

## Verification: code
