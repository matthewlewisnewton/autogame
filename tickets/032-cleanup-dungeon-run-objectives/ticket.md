# Cleanup nits from 025-dungeon-run-objectives

> **Staleness note.** This follow-up ticket was written against commit
> `37fe3ed` (2026-05-19). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `025-dungeon-run-objectives`.
None blocked acceptance — clean them up when convenient.

## Misleading variable names in enemy-defeat accounting
In `game/server/index.js`, the three defeat-accounting sites use locals named
`defeatedMinion`, `defeatedWeapon`, `defeatedSummon` that actually hold the
*pre-filter* enemy count, not a defeated count. The real defeated count is the
separate `*Count` variable. The names invite misreading during future edits.
### Acceptance Criteria
- The pre-filter count variables are renamed to convey "count before removal"
  (e.g. `enemiesBeforeCleanup`) at all three sites.

## Duplicated defeat-counting pattern across three sites
The same "snapshot length, filter, diff, recordEnemyDefeated" block is copied
into the minion cleanup, weapon card, and summon card paths. The ticket
explicitly allowed a small helper for this. Extracting one
`removeDeadEnemies()` helper would remove the duplication without a combat
refactor.
### Acceptance Criteria
- A single helper performs the dead-enemy filter and `recordEnemyDefeated()`
  call, used by all three enemy-removal sites.

## Inline `display:none` on objective HUD duplicates CSS intent
`game/client/index.html` sets `style="display:none;"` on `#objective-hud` while
visibility is otherwise driven entirely by `updateObjectiveHud()`/CSS. The
inline style is redundant once JS runs.
### Acceptance Criteria
- HUD initial-hidden state is expressed via CSS/JS only, with no inline
  `style` attribute on `#objective-hud`.
