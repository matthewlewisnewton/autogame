# Archive Wyrm dedicated renderer

Split `ancient_wyrm` (Archive Wyrm) out of the shared `renderWyrmSummon` /
`renderWyrmAttack` path used by `dungeon_drake` (Vault Wyrm). Register
card-specific summon and breath renderers so later polish targets only this
evolved creature without touching Vault Wyrm or other minion cards.

## Acceptance Criteria

- `ancient_wyrm` is registered in `CARD_RENDERERS` as
  `[renderArchiveWyrmSummon, renderArchiveWyrmBreath]` — not the shared
  `renderWyrmSummon` / `renderWyrmAttack` functions.
- `dungeon_drake` still resolves to `[renderWyrmSummon, renderWyrmAttack]`;
  only `ancient_wyrm` moves to the new renderers.
- `WYRM_SUMMON_STYLES.ancient_wyrm` is removed; Archive Wyrm summon styling
  lives in an archive-specific style constant used only by
  `renderArchiveWyrmSummon`.
- `renderArchiveWyrmBreath` preserves the existing payload guards from
  `renderWyrmAttack`: skip when `!data.origin`; skip deploy payloads
  (`data.minionId && !data.breathPhase`); skip duplicate cones on
  `breathPhase === 'tick'`; fire breath uses `specialEffect === 'fire_breath'`.
- `renderArchiveWyrmSummon` preserves the existing summon guard: skip when
  `data.breathPhase` is set or `minionId` is absent.
- Tests in `game/client/test/cardRenderers.test.js` assert
  `resolveRenderers('ancient_wyrm')` functions differ from
  `resolveRenderers('dungeon_drake')` and that Vault Wyrm cases still pass
  unchanged.
- Existing client + server vitest suites still pass.

## Technical Specs

- `game/client/cardRenderers.js`:
  - Add `renderArchiveWyrmSummon(data, ctx)` and `renderArchiveWyrmBreath(data, ctx)`.
    Initially migrate the current `ancient_wyrm` branches from
    `renderWyrmSummon` / `renderWyrmAttack` verbatim (same primitive calls and
    colors) so behaviour is unchanged — sub-tickets 02–03 add polish on top.
  - Add `ARCHIVE_WYRM_SUMMON_STYLE` (or equivalent) holding the current
    `{ radius: 1.85, burstCount: 18, burstSpread: 2.5 }` preset.
  - Remove `ancient_wyrm` from `WYRM_SUMMON_STYLES`.
  - Change `CARD_RENDERERS.ancient_wyrm` from
    `[renderWyrmSummon, renderWyrmAttack]` to the new functions.
  - Do not alter `renderWyrmSummon`, `renderWyrmAttack`, or
    `CARD_RENDERERS.dungeon_drake`.
- `game/client/test/cardRenderers.test.js`:
  - Assert `resolveRenderers('ancient_wyrm')[0].name` is
    `renderArchiveWyrmSummon` (not `renderWyrmSummon`).
  - Assert `resolveRenderers('ancient_wyrm')[1].name` is
    `renderArchiveWyrmBreath` (not `renderWyrmAttack`).
  - Keep existing Vault Wyrm / Archive Wyrm tests passing (update renderer
    entry points if they call shared functions directly).

## Verification: code
