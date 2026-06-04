# Client: Warded tint and variant badge

Give Warded enemies a distinct look on the client: a cool-toned body tint separate
from the default type color, and a variant badge color that reads differently from the
generic magenta elite marker used for other variants.

## Acceptance Criteria

- Enemies with `variant === 'warded'` render with a visible cool/cyan tint on the
  enemy body mesh (distinct from the base grunt/skirmisher/miniboss palette).
- The floating variant badge for `warded` uses a dedicated color (e.g. cyan
  `0x22d3ee`), not the default `VARIANT_MARKER_COLOR` magenta.
- Non-warded enemies (including `variant: 'test'`) keep existing colors and badge
  styling.
- A `warded-enemy` debug scenario (or extension of `variant-enemy`) spawns one
  warded grunt beside a plain grunt so QA can compare side-by-side.
- Client and/or server tests cover the tint/badge branch (e.g. exported color map or
  scenario registration test); existing tests pass.

## Technical Specs

- `game/client/renderer.js`:
  - Add `WARDED_TINT` / per-variant marker color map; in the enemy sync loop (~4090),
    when `enemy.variant === 'warded'`, tint the body material (preserve windup/reveal
    flash behavior — store `_origColor` if needed, same pattern as emissive flash).
  - Update `applyVariantMarker` / `createVariantMarker` to pick marker material color
    from `enemy.variant` (`warded` → cyan, default → existing magenta).
- `game/server/debugScenarios.js`: add `warded-enemy` scenario (mirror
  `variant-enemy`): spawn grunt at `player.x + 3`, set `variant = 'warded'` and
  call `VARIANT_DEFS.warded.apply(enemy)` (or set `shieldHp`/`maxShieldHp`
  explicitly), plain grunt at `player.x - 3`.
- `game/server/test/debug-scenarios.test.js` (or `game/client/test/`): assert the new
  scenario name is registered and sets `variant: 'warded'` with shield fields.
- Depends on sub-tickets 01–02 for meaningful shield behavior in play; this ticket
  only requires `variant` and `shieldHp` in the broadcast state.

## Verification: code
