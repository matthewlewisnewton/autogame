# Heavy-hitter card UI copy for wind-up commitment

Update card description and hand-slot rendering so players see that Solar Edge, Corebreaker Greatsword, and Soul Drain are slow, committed power hits with fewer uses. Depends on sub-ticket 01 stat values.

## Acceptance Criteria

- Cards with `windUpMs > 0` show a **wind-up commitment hint** in the hand UI (e.g. badge or subtitle like `650ms wind-up` derived from `CARD_DEFS`, not hardcoded per card id).
- `cardChoiceDescription()` (reward/forge pick UI) appends or substitutes wind-up language for tuned heavy hitters — e.g. `28 output technique · 650ms wind-up` for weapons and an equivalent for `soul_drain` — without breaking cards that lack `windUpMs`.
- `game/shared/theme.json` gains reusable `cardDescriptions` template string(s) for wind-up weapons and wind-up spells (e.g. `damageWeaponWindup`, `damageSpellWindup` with `{damage}` and `{windUpMs}` placeholders).
- Hand slot `title` tooltip for wind-up cards mentions the commitment lockout (cannot move/other cards during wind-up), consistent with 307 UX.
- Client tests in `game/client/test/main.test.js` and/or `game/client/test/cards.test.js` assert the wind-up hint renders for `flame_blade` / `magma_greatsword` / `soul_drain` defs and does **not** appear on `iron_sword`.
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/shared/theme.json`**: add `cardDescriptions.damageWeaponWindup` and `cardDescriptions.damageSpellWindup` (or a single `windupSuffix`) with `{damage}` / `{windUpMs}` tokens.
- **`game/server/progression.js`** — `cardChoiceDescription(def)`: when `def.windUpMs > 0` and the card has direct `damage`, use the wind-up template instead of plain `damageWeapon` / generic spell text.
- **`game/client/main.js`** — `renderHand()`: in the `content.innerHTML` block, when `CARD_DEFS[card.id]?.windUpMs > 0`, render a `<span class="card-windup-hint">` (or reuse `card-effect`) showing seconds or ms commitment; set `slot.title` to include wind-up lockout wording.
- **`game/client/style.css`**: minimal styling for `.card-windup-hint` (subtle, readable on all card accent colors).
- **`game/client/test/main.test.js`**: extend hand-render tests — call `renderHand()` with a `flame_blade` card def that includes `windUpMs: 650` and assert the hint text is in the DOM; negative case with `iron_sword`.
- **`game/client/test/cards.test.js`** (optional): assert `CARD_DEFS.flame_blade.windUpMs` is defined after client bundle merge.
- No server simulation or JSON stat changes in this sub-ticket.

## Verification: code
