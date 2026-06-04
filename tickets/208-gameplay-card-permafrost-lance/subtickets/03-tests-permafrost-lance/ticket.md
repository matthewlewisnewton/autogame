# 03-tests-permafrost-lance

Add tests verifying the `permafrost_lance` card definition exists with correct stats and that the freeze behavior works via the shared `applyFreezeInRadius` function. Ensure full vitest suite remains green.

## Acceptance Criteria

- Server test verifies `CARD_DEFS.permafrost_lance` exists with `type: 'spell'`, `magicStoneCost: 30`, `damage: 8`, `radius: 6`, `freezeDurationMs: 2000`, `effect: 'frost_nova'`.
- Server test verifies `permafrost_lance` is in `SHOP_CARD_POOL` (obtainable in-game).
- Server test verifies `applyFreezeInRadius` correctly freezes an enemy in range using `permafrost_lance`'s radius (6) and damage (8).
- Client test verifies `CARD_DEFS.permafrost_lance` exists on the client side with matching `magicStoneCost` and `effect`.
- Full vitest suite passes (`pnpm test` from `game/`).

## Technical Specs

- **game/server/test/new_card_pack.test.js** — Extend or add a new `describe` block:
  - Assert `CARD_DEFS.permafrost_lance` has expected fields
  - Assert `permafrost_lance` is in `SHOP_CARD_POOL`
  - Test `applyFreezeInRadius(0, 0, 6, 2000, 8)` freezes enemy at `(3, 0)` and deals 8 damage
- **game/client/test/cards.test.js** — Add assertion for `CARD_DEFS.permafrost_lance` type, magicStoneCost, and effect; verify `CARD_ACCENT_STYLE.permafrost_lance` exists with color/icon.
- Run `pnpm test` from `game/` to verify full suite is green.

## Verification: code
