## Remove or wire unused `readCosmeticDraft`
`game/client/cosmetic-form.js` exports `readCosmeticDraft()` and has unit tests
for it, but `main.js` never calls it — the cosmetic draft is maintained
incrementally inside the click/input handlers. This is redundant code that can
drift from the real draft logic. Either delete it (and its test) or use it as
the single source of truth for reading the draft on save.

### Acceptance Criteria
- `readCosmeticDraft` is either removed (with its test) or invoked by the save
  path / draft-read logic in `main.js`.
- `vitest run` in `game/client` still passes.

## Capture coverage does not exercise the appearance panel
The round-1 capture is a full-flow gameplay smoke (auth → lobby → movement) and
never opens the account overlay, so there is no screenshot proof of the
Appearance section, swatches, or the live Three.js preview rendering. The panel
is unit-tested and imports cleanly, but a visual capture would catch CSS/layout
or WebGL-in-overlay regressions.

### Acceptance Criteria
- A capture scenario opens the account overlay and screenshots the Appearance
  section with the live preview visible.
