# Astral Guardian conservative stat trim

Apply a small direct reduction to `astral_guardian` base stats in shared JSON. Slower grind scaling does not address this card's late-game outlier burst/shield stack — trim one or two fields conservatively so it remains top-tier evolved finisher without dominating harness DPC/DPM.

## Acceptance Criteria

- `game/shared/cardStats.json` `astral_guardian` receives a **small** reduction to burst and/or shield/minion fields (e.g. `damage` 66 → 62–64, and/or `shieldHp` 15 → 13–14, and/or `attackDamage` 11 → 10) — pick the minimal change that moves metrics toward peers; do not gut the card.
- `magicStoneCost` (65) and evolution identity (`isEvolved`, `effect`, `specialEffect`) are unchanged.
- `game/server/test/astral_guardian.test.js` expectations updated to match new base values (definitions block, shield absorb tests, cast damage if asserted).
- Any other server tests with hardcoded `astral_guardian` damage/shield literals are updated (grep `66`, `shieldHp: 15`, `attackDamage: 11`).
- `cd game && pnpm test:quick` passes.
- No changes to grind-scaling maps or `battle_familiar` / `null_crawler` in this sub-ticket.

## Technical Specs

- **`game/shared/cardStats.json`**: trim `astral_guardian` only (`damage`, `shieldHp`, `minionHp`, `attackDamage` — one or two fields, conservative).
- **`game/server/test/astral_guardian.test.js`**: update `toMatchObject` literals for trimmed fields.
- **`game/server/test/integration.test.js`**, **`game/server/test/key-items.test.js`**, **`game/server/debugScenarios.js`**: update only if they hardcode pre-trim astral stats (grep before editing).
- Do **not** edit `progression.js` grind scaling or `cardEffects.js` effect logic unless a test forces a comment-only doc sync.

## Verification: code
