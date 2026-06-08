# Server: wind-up for spell, creature, and enchantment cards

Close the per-card-type gap: weapon wind-ups already commit costs at
`tryBeginCardWindup` and skip re-payment on `fromWindupResolution`, but spell and
creature deferred paths still deduct magic stones, apply cooldown, and consume/replace
hand cards again at resolution. Enchantments never call `tryBeginCardWindup`, so
`windUpMs` is ignored. Make `windUpMs` a reliable optional field on every card type.

## Acceptance Criteria

- `executeUseCard` spell and creature branches mirror the weapon pattern: when
  `options.fromWindupResolution === true`, skip magic-stone deduction,
  `applySlotCooldown`, `replaceConsumedCard` / `beginCreatureBurnDown`, and any
  `pendingSummons` bookkeeping that was already handled at commit.
- Enchantment branch calls `tryBeginCardWindup` (after validation, before side
  effects) when `cardDef.windUpMs > 0`; deferred resolution uses the locked
  `pendingCardUse` origin like weapons.
- Add non-zero `windUpMs` exemplars in `cardStats.json` for at least one spell
  (e.g. `glacier_collapse`), one creature (e.g. `dungeon_drake`), and one
  enchantment (e.g. `spike_trap`) so each type is exercisable in tests.
- New server tests in `card_windup_types.test.js` prove for each exemplar:
  (a) commit enters `cardUseState: "windup"` with no immediate `CARD_USED`;
  (b) magic stones, slot cooldown, and hand state change exactly once across
  commit + resolution (no double charge or double discard);
  (c) `CARD_USED` and the card effect land only after `windUpMs` elapses.
- Existing weapon wind-up tests (`card_windup_state.test.js`,
  `card_windup_resolution.test.js`) and instant-card regression tests still pass.

## Technical Specs

- `game/shared/cardStats.json` — add `windUpMs` to one spell, one creature, and
  one enchantment exemplar (suggested: `glacier_collapse: 700`, `dungeon_drake:
  600`, `spike_trap: 500`; adjust if balance docs prefer other cards).
- `game/server/cardEffects.js` — in the spell branch (~line 485+), wrap MS
  deduction, `pendingSummons.add`, `applySlotCooldown`, and `replaceConsumedCard`
  calls with `if (!fromWindup)` (match weapon guards at ~lines 313–315 and
  449–454). In the creature branch (~line 1146+), guard MS deduction,
  `applySlotCooldown`, and `beginCreatureBurnDown` the same way; ensure
  `applyAstralShieldCast` is not double-charged when resolved from wind-up. In the
  enchantment branch (~line 1078+), insert `tryBeginCardWindup({ ..., magicStoneCost
  })` before `pendingSummons` / cost payment, and guard instant-path cost/cooldown/
  hand consumption with `fromWindup` on the deferred resolver path.
- `game/server/test/card_windup_types.test.js` (new) — integration tests per card
  type using manual `cardWindupStartTime` advancement and `processPendingCardWindups`
  (same patterns as `card_windup_resolution.test.js`).

## Verification: code
