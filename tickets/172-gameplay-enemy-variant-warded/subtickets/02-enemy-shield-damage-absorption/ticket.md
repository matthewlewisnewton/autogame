# Enemy shield damage absorption (centralized)

Route all enemy damage through a single helper in `simulation.js` that depletes
`shieldHp` before reducing `hp`, mirroring the player `shieldHp` pool logic. Every
combat path that currently does `enemy.hp -= …` must use the helper so warded
(and any future shielded enemies) behave consistently.

## Acceptance Criteria

- `damageEnemy(enemy, amount)` (or equivalent exported helper) in
  `simulation.js` absorbs damage into `shieldHp` first; only overflow reduces
  `hp`. When `shieldHp` is 0 or absent, behavior matches today.
- All direct `enemy.hp -=` sites in `simulation.js` (cone/radial/projectile/phase
  beam/returning projectile, freeze bonus damage, pending echoes, spike_trap
  enchantments, minion melee/chain attacks, and any other enemy damage in that
  file) call the helper instead.
- Hit payloads (`hits` arrays / `cardUsed` responses) still report correct `hp`
  after damage; kill detection (`hpBefore > 0 && hp <= 0`) still works.
- Server tests prove: (1) warded enemy with `shieldHp: 50` takes 30 damage →
  `shieldHp === 20`, `hp` unchanged; (2) another 25 → `shieldHp === 0`, `hp`
  unchanged; (3) another 10 → `hp` reduced by 10; (4) a non-shielded grunt loses
  HP immediately with no shield change.
- Existing server + client tests pass.

## Technical Specs

- `game/server/simulation.js`:
  - Add `function damageEnemy(enemy, amount)` near the player damage helpers (~1619).
    Logic: if `(enemy.shieldHp || 0) > 0`, `absorbed = min(shieldHp, amount)`,
    decrement `shieldHp`, reduce `amount` by `absorbed`; apply remainder to `hp`.
    Clamp `shieldHp` at 0. Return `{ hpBefore, killed }` or similar if callers need
    kill/ms bookkeeping.
  - Replace every `enemy.hp -=` in this file with `damageEnemy` (grep confirms
    ~12 call sites including minion attacks and enchantment traps).
- `game/server/test/warded_variant.test.js`: extend with `damageEnemy` tests using
  `spawnEnemy` or manual enemy objects on `gameState.enemies` after importing
  simulation helpers (follow patterns in `server.test.js` / `astral_guardian.test.js`).
- Depends on sub-ticket 01 (`shieldHp` on spawn); do not re-add registry entries here.

## Verification: code
