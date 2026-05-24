# Fix knockback through walls and client collision regression

> **Staleness note.** This follow-up ticket was written against commit
> `b299845` (2026-05-23). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Two regressions landed alongside the dungeon/quest/crystal work in `d212b52`. (1) `applyKnockback` blindly adds displacement with no collider check — enemies can be punted through walls or out of the dungeon, potentially blocking `collect_items` / `defeat_enemies` victory conditions. (2) `game/client/collision.js` gained an unconditional `else if` that returns `true` whenever a segment enters the expanded AABB, including the endpoint-touch case other paths rely on; this can stick the player against walls.

## Difficulty: hard

## Code references

> The references in this section were reviewed at commit `b299845`; verify them against the current code before editing.

- `game/server/simulation.js:868-880` `applyKnockback` — adds `dirX * strength` / `dirZ * strength` to enemy position with no wall/dungeon-bounds check. `pullEnemiesToward` has the same shape (pre-existing), but knockback amplifies it on every hit.
- `game/client/collision.js:198-200` — newly added `else if` branch returns `true` for any segment that enters the expanded AABB, including endpoint-touch positions. Previously such positions silently passed. No new test exercises the false branch.
- `game/server/simulation.js` `tryPlayerMove` / wall collider list — the server-side resolver to reuse for enemy knockback already exists; share it instead of re-implementing.

## Acceptance Criteria

- Knockback resolution refuses to move an enemy through a wall collider or out of the dungeon bounds. The enemy is clamped at the obstacle (or slid along it, matching `tryPlayerMove` semantics) and never ends up in an unreachable cell.
- Regression test: load a layout with a wall adjacent to an enemy, apply a knockback impulse perpendicular to the wall, assert the enemy's resulting position is on the walkable side of the wall.
- `pullEnemiesToward` either gets the same wall-respecting resolver or is documented as pre-existing behavior (pick one — preferably fix both).
- Client `collision.js` `else if` either is removed, or has its branch refined to exclude the endpoint-touch case that `allowEndpointTouch === false` callers depend on.
- New unit test on `game/client/test/collision.*` covering the endpoint-touch case that the broken `else if` would have falsely flagged.

## Technical Specs

- Likely files: `game/server/simulation.js`, `game/client/collision.js`, `game/client/test/collision-*.test.js`, possibly a shared helper if you choose to consolidate wall resolution between movement and knockback.
- Be careful with the slide semantics: the server-side `tryPlayerMove` already handles axis slide; reusing it (or extracting a shared helper) keeps player and enemy behavior consistent.

## Verification: code
