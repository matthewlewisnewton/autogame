# Client CARD_DEFS spreads from the shared stat source

Switch the **client** consumer onto the shared stat source created in
sub-ticket 01, removing the partial hand-retyped stat copy in `client/cards.js`.
This eliminates the stat-copy drift between client and server.

## Acceptance Criteria

- `client/cards.js` `CARD_DEFS` is rebuilt by spreading the shared per-card stat
  object for each card (the same source the server uses), instead of the current
  per-card hand-typed stat literals.
- No card in client `CARD_DEFS` carries a stat value that contradicts the shared
  source; the previously-duplicated literals (e.g. `battle_familiar.damage: 44`,
  `astral_guardian.damage: 66`, `aegis_sentinel.damage: 0`) now come from the
  shared source, not retyped.
- Client-only rendering helpers stay in `client/cards.js` and keep working:
  `CARD_TYPE_STYLE`, `CARD_ACCENT_STYLE`, `DESPERATION_CARD_DEFS`,
  `createStartingDeck`, the `weaponCardIds`/`spellCardIds`/`creatureCardIds`/
  `enchantmentCardIds` Sets, and all exported functions.
- `cd game && pnpm test` passes; the existing `card_sync.test.js` id/name/type/
  charges checks still pass.

## Technical Specs

- Files: `game/client/cards.js` (CARD_DEFS block L13-246).
- Client imports the shared stats via Vite JSON import
  (`import ... from '../shared/<file>' with { type: 'json' }`) matching the
  existing `cardIdentity` import pattern, or from the shared JS module if 01
  chose that form.
- The shared stat object already includes identity fields, so the separate
  `...cardIdentity.<id>` spread may be folded into the single shared spread as
  long as id/name/type/charges remain correct.
- Do NOT change `CARD_SELL_VALUES`, `EVOLUTION_TRANSFORMS`, or
  `getCardSellValue` here — that is sub-ticket 03.

## Verification: code
