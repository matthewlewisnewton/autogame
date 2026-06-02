# Echo Strike — delayed 50% weapon echo

When `echoStrikePending` is armed, the caster's next WEAPON card hit also lands a
delayed second damage packet at 50% on the same target(s); the pending flag is
consumed by that one weapon use. Spell and creature/summon cards never trigger
the echo.

## Acceptance Criteria

- With `player.echoStrikePending === true`, using a weapon card that hits an enemy
  applies the normal damage immediately AND a second packet equal to 50% (rounded,
  min 1) of the same hit damage to the same enemy/enemies, landing shortly after
  (a short delay, processed on a later tick — not in the same synchronous swing).
- The echo packet targets only the enemies struck by the primary weapon hit
  (same target(s)), not an area burst.
- `player.echoStrikePending` is set back to `false` after that one weapon use
  (consumed after exactly one proc), regardless of whether any enemy was hit.
- Using a `spell` card or a creature/summon card while `echoStrikePending` is true
  does NOT consume the flag and does NOT produce an echo packet — the flag stays
  armed until a weapon card is used.
- A single armed weapon use against one enemy results in two damage events to that
  enemy (primary then echo); a subsequent weapon use produces only one (echo not
  re-armed).
- Echo damage uses the actual damage dealt by the primary swing (after grind /
  echoDamage scaling), multiplied by the key item's `echoFraction` (0.5).

## Technical Specs

- `game/server/index.js`, `useCard` handler, weapon branch (`cardDef.type ===
  'weapon'`, around line 1552): after the primary `hits` are collected, if
  `player.echoStrikePending`, record the struck enemy IDs and the per-hit damage,
  enqueue a pending echo (e.g. push to `state.pendingEchoes` with `{ attackerId,
  targets: [{ enemyId, damage }], applyAt: now + delayMs }` using
  `Math.max(1, Math.round(damage * echoFraction))`), then set
  `player.echoStrikePending = false`. Do NOT add this to the `spell` or
  creature/summon branches.
- `game/server/simulation.js`: add a `processPendingEchoes()` (or similar) that,
  each tick, applies due echo packets by subtracting damage from the still-living
  target enemies (reuse the `enemy.hp -= damage` + `lastDamagedBy` pattern and
  `cleanupAfterDamage()`), then drops applied/expired entries. Call it from the
  main per-tick update alongside `updateAreaEffects()` (around line 2067) and
  export it. Initialise `state.pendingEchoes` where game state is reset.
- Read `echoFraction` from the `echo_strike` `KEY_ITEM_DEFS` entry (default 0.5).
- Add tests in `game/server/test/key-items.test.js`: weapon use yields two damage
  packets to the target and consumes the flag; a second weapon use yields only one;
  a spell/summon use leaves the flag armed and deals no echo. Drive the delayed
  application via the exported tick/echo-processing function.

## Verification: code
