# 11 — Remove combat HP healing from cards and key items

Round-2 review found that dungeon cards and the Field Medic Kit still increase player HP during normal gameplay, violating the owner decision that only the hub Medic station (`healAtMedic()`) may restore health. Redesign or remove those HP restoration paths while keeping each card/key item useful (e.g. Magic Stone restore, damage, or support effects).

## Acceptance Criteria

- Casting `healing_font` (`Restoration Beacon`) does **not** increase the caster's HP. The card still consumes its charge and emits `CARD_USED`; its gameplay effect is redesigned (recommended: restore Magic Stones instead of HP).
- Casting `divine_grace` (`Sanctum Pulse`) does **not** increase HP. It may still restore Magic Stones via `magicStoneRestore`.
- `soul_drain` radial hits do **not** call `healPlayer` or raise attacker HP via `healOnHit` / `healOnKill`. Damage and Magic Stone gain on hit/kill remain unchanged.
- Using `field_medic_kit` does **not** increase any player's HP. Nearby living allies may still receive Magic Stones; dead/extracted players are skipped as today.
- `healAtMedic()` remains the **only** production code path that sets a player's `hp` above its current value (excluding new-player initialization when `hp` is unset, and debug scenarios).
- `game/shared/cardStats.json` no longer defines `healAmount` on `healing_font` / `divine_grace` or `healOnHit` / `healOnKill` on `soul_drain` unless tests explicitly assert their absence.
- Server tests updated: card/key-item tests that expected HP gain now assert HP unchanged (or MS-only effects); add or extend a test that `healAtMedic()` is still the sole full-heal path for hub players.
- Client copy/descriptions for affected cards and `field_medic_kit` no longer claim HP healing.

## Technical Specs

- **`game/server/cardEffects.js`** — In the `healing_font` and `divine_grace` effect branches (~lines 561–595), remove `healPlayer(...)` calls. Redesign `healing_font` to grant Magic Stones (add `magicStoneRestore` in stats if needed) or another non-HP utility; keep `divine_grace` MS restore. Stop emitting misleading `healAmount` in `CARD_USED` payloads (omit or set to 0).
- **`game/server/simulation.js`** — In `collectRadialHits()` (~lines 1174–1199), remove `healOnHit` / `healOnKill` handling and `hpHealed` accumulation. Remove or stop exporting `healPlayer()` if no production callers remain after card changes.
- **`game/server/keyItemEffects.js`** — In the `field_medic_kit` branch (~lines 98–128), delete the `p.hp = Math.min(...)` line; keep MS restore loop. Rename response field `healed` to something accurate (e.g. `alliesRestored`) or document that it counts MS recipients only.
- **`game/server/progression.js`** — Update `KEY_ITEM_DEFS.field_medic_kit` description and remove `healPercent` / healing-oriented fields.
- **`game/shared/cardStats.json`** — Remove `healAmount` from `healing_font` and `divine_grace`; remove `healOnHit` / `healOnKill` from `soul_drain`; add/adjust non-HP stats for redesigned effects.
- **`game/server/test/new_card_pack.test.js`** — Replace HP-heal assertions for Restoration Beacon / Sanctum Pulse with MS-or-no-HP-change assertions; update soul_drain radial test expectations.
- **`game/server/test/field_medic_kit.test.js`** — Rewrite tests that expect HP gain to assert HP unchanged and MS still restored.
- **`game/server/test/card_evolution.test.js`** — Update any soul_drain stat expectations if heal fields are removed.
- **`game/client/main.js`** / **`game/client/cards.js`** / **`game/client/renderer.js`** — Update player-facing descriptions or tooltips that mention healing for these cards/key item, if present.
- **`game/client/test/cards.test.js`**, **`game/client/test/cardRenderers.test.js`**, **`game/client/test/main.test.js`** — Adjust expectations for heal-related card metadata or VFX triggers (e.g. divine_grace heal ring only when appropriate).

## Verification: code
