# Enemy variant display metadata in VARIANT_DEFS

Add a one-line `description` and `surfacedStats` array to every entry in `VARIANT_DEFS`. Each variant already has a `name` field that serves as its display name; this sub-ticket completes the metadata set needed by the future lock-on info panel.

## Acceptance Criteria

- Every key in `VARIANT_DEFS` (`test`, `volatile`, `warded`, `leeching`, `frenzied`) has:
  - `name`: already present — must remain a non-empty string (do not remove or blank).
  - `description`: non-empty one-line string explaining the variant's gameplay hook.
  - `surfacedStats`: non-empty array of strings naming variant-specific stats the lock-on panel should surface (e.g. `'radius'`, `'damage'`, `'leechFraction'`, `'chaseSpeedMult'`).
- Each `surfacedStats` entry maps to a real field on that variant's registry entry (or a well-defined composite token documented inline in the test, such as `'shieldHp'` for warded if chosen).
- Variant behavior hooks (`apply`, combat multipliers, bonus drops) are unchanged.
- Vitest coverage asserts `description` and `surfacedStats` on all five variants.
- Harness vitest suite passes.

## Technical Specs

- `game/server/enemyVariants.js`:
  - Add `description` and `surfacedStats` to each `VARIANT_DEFS` entry. Suggested themes (implementer may tune copy):
    - `test` — placeholder affix; surfaces bonus-drop info.
    - `volatile` — explodes on death; surface `radius`, `damage`.
    - `warded` — spawns with a damage shield; surface shield-related keys.
    - `leeching` — heals when dealing damage; surface `leechFraction`.
    - `frenzied` — enrages below half HP; surface `chaseSpeedMult`, `attackWindupMult`.
  - Do not rename existing `name` values unless they are empty.
- `game/server/test/enemy_variants.test.js` (or a new `enemy_variant_display.test.js`):
  - Add a `describe` block that iterates `Object.keys(VARIANT_DEFS)` and asserts each def has non-empty `name` and `description`, and `surfacedStats` is a non-empty array of strings with every entry corresponding to a field on that def.
- Do **not** change `ENEMY_DEFS`, `spawnEnemy`, or client code in this sub-ticket.

## Verification: code
