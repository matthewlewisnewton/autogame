## Survive runs show generic "Purged X / Y hostiles" in the in-game HUD
The lobby quest board gets a dedicated survive summary (`theme.json
surviveHostiles`), but the in-game objective HUD (`game/client/main.js:1782`)
unconditionally renders `Purged {defeatedEnemies} / {totalEnemies} hostiles` for
all non-collect objectives. For a `survive` run this reads identically to a
`defeat_enemies` run, losing the "outlast the siege" flavor. The suspended-run
banner similarly only has explicit progress formatting for collect-items and
defeat-enemies. Worth survive-specific in-run copy.
### Acceptance Criteria
- A `survive` run's in-game objective HUD uses survive-flavored wording distinct
  from the `defeat_enemies` text.
- The suspended-run banner includes progress for `survive` objectives.
- `collect_items` and `defeat_enemies` HUD/banner text is unchanged.

## Survive objective label is a hardcoded string, not themed
`createRunState` in `game/server/progression.js` builds the survive objective
label inline (`` `${quest.name}: outlast and defeat all ${totalSpawns}
attackers` ``) rather than sourcing it from `theme.json` like other player-facing
strings. Centralizing it keeps copy consistent and localizable.
### Acceptance Criteria
- The survive objective label text is defined in the shared theme and referenced
  from `createRunState`, with no behavior change.
