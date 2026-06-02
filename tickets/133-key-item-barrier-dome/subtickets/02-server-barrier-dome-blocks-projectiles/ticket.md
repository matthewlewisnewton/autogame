# Barrier Dome — Block Ranged/Projectile Damage

Make an active barrier dome block ranged/projectile damage that originates from
outside the dome and targets a player inside it, while melee damage still
applies. The dome protects any player standing inside it (co-op), not just the
caster.

## Acceptance Criteria

- `damagePlayer(playerId, amount, options)` in `game/server/simulation.js`
  accepts a ranged/projectile marker on `options` (e.g. `options.ranged === true`
  or `options.projectile === true`).
- When the targeted player is inside an active barrier dome (any living
  player's dome where `now < barrierDomeUntil` and the victim's distance to that
  dome's center `(barrierDomeX, barrierDomeZ)` ≤ `barrierDomeRadius`) AND the
  incoming attack is ranged/projectile AND the attacker position (from
  `getAttackerPosition(options)`) is outside that dome's radius, the damage is
  fully blocked (`hp` unchanged, returns `null`).
- Melee damage (no ranged/projectile marker) is NOT blocked by the dome and
  applies normally, even to a player inside the dome.
- Ranged attacks whose attacker is already INSIDE the dome are NOT blocked
  (only outside→inside is blocked). If no attacker position is resolvable, a
  ranged attack on a player inside an active dome is still blocked.
- Co-op: a player with no dome of their own who stands inside an ally's active
  dome is protected from outside ranged damage exactly as the caster would be.
- The dome check runs before HP is reduced and does not interfere with existing
  invulnerability (`invulnerableUntil`) or `guard_block` handling.
- Server tests (extend `game/server/test/barrier_dome.test.js` from sub-ticket
  01) cover: ranged damage from outside the dome is blocked (hp unchanged);
  melee damage to a player inside the dome still applies; an ally inside the
  caster's dome is protected from outside ranged damage; an expired dome
  (`barrierDomeUntil` in the past) blocks nothing.

## Technical Specs

- `game/server/simulation.js`, `damagePlayer()` (around line 1486):
  - After the `invulnerableUntil` check and before/around the `blockingUntil`
    block, add a barrier-dome check. Iterate `_gameState.players` for any living
    player `d` with `d.barrierDomeUntil && now < d.barrierDomeUntil`; compute the
    victim's distance to `(d.barrierDomeX, d.barrierDomeZ)` against
    `d.barrierDomeRadius` to decide if the victim is inside that dome.
  - Treat the attack as blockable only when it is flagged ranged/projectile on
    `options`. Use `getAttackerPosition(options)` to determine the attacker's
    position; block when the attacker is outside the dome (or position unknown).
    Return `null` (full block) on a successful block.
- Identify a real ranged damage source to tag with the marker so the mechanic is
  exercised in-game: pass the ranged/projectile flag through to `damagePlayer`
  from at least one ranged/projectile enemy or minion attack path that already
  calls `damagePlayer` (search for `damagePlayer(` call sites in
  `simulation.js`). Melee enemy strikes must remain unflagged.
- Keep the change scoped to `damagePlayer` and the call site(s) that pass the
  ranged flag; do not alter the cast handler from sub-ticket 01.

## Verification: code
