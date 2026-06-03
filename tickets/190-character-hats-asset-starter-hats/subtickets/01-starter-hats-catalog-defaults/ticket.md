# Starter hats: add free default-owned hats to the server catalog

Ticket 189 added a purchasable hat catalog (`cap`, `wizard`, `crown`) where the
only default-owned hat is `none`. This sub-ticket adds a small set of **free
starter hats** that every account owns automatically, so players (and the
upcoming customization panel) have cosmetic choices without spending currency.

Add two new starter hats — `bandana` ("Bandana") and `beanie` ("Beanie") — to
the server hat catalog at price `0`, make them part of the default-owned set, and
backfill them onto existing accounts.

## Acceptance Criteria
- `HAT_CATALOG` in `game/server/cosmetic.js` includes `bandana` ("Bandana") and
  `beanie` ("Beanie"), each with `price: 0`. The existing `none`/`cap`/`wizard`/
  `crown` entries and their prices are unchanged.
- `DEFAULT_UNLOCKED_HATS` includes `none`, `bandana`, and `beanie` (in that
  order), so a newly created account owns all three.
- `backfillUnlockedHats` seeds the full default-owned starter set (`none`,
  `bandana`, `beanie`) before appending any previously-stored ids, so legacy
  accounts retroactively gain the starter hats. It still dedupes, drops unknown
  ids, and preserves any additionally-unlocked catalog ids.
- Both new ids pass `validateCosmetic({ hat })` (they are members of `HAT_IDS`),
  and equipping them succeeds for a default account via `users.updateProfile`
  because they are in the default-owned set.
- `unlockHat` / the unlock-with-currency flow is unaffected: unlocking a free
  starter hat is a harmless idempotent success and never changes currency.
- `game/server/test/cosmetic.test.js` is extended with tests asserting: the two
  starter hats exist in the catalog at price 0; `DEFAULT_UNLOCKED_HATS` contains
  them; `backfillUnlockedHats(undefined)` and `backfillUnlockedHats(['none'])`
  both return the full starter set; and a fresh account can equip `bandana`/
  `beanie` without unlocking them first.
- `pnpm test` (from `game/`) passes.

## Technical Specs
- `game/server/cosmetic.js`:
  - Append `{ id: 'bandana', name: 'Bandana', price: 0 }` and
    `{ id: 'beanie', name: 'Beanie', price: 0 }` to `HAT_CATALOG` (after the
    existing entries). `HAT_IDS` is derived from the catalog, so it updates
    automatically.
  - Change `DEFAULT_UNLOCKED_HATS` to `['none', 'bandana', 'beanie']`.
  - In `backfillUnlockedHats`, replace the single `add('none')` seed with a loop
    that seeds every id in `DEFAULT_UNLOCKED_HATS` first, then appends ids from
    the `existing` array (keeping the current dedupe + `HAT_IDS` membership
    guard). Do not change the function signature or return type.
- `game/server/test/cosmetic.test.js`: add the assertions listed above. Reuse
  the existing import of `cosmetic.js` exports and `users.js` helpers as the file
  already does.
- Do NOT touch the client renderer here — the matching meshes are sub-ticket 02.
  Keep the new ids in sync with what sub-ticket 02 will render.

## Verification: code
