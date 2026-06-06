# 03-revalidate-hub-screenshots

Re-run the hub playthrough validation (`--preset hub --steps full`) and verify the corrected screenshots show the walkable 3D ship hub with the lobby menu dismissed, including party-mate presence.

## Acceptance Criteria

- Run `cd game && pnpm run validate:hub` (or equivalent `node ../harness/validate/playthrough.mjs --preset hub --steps full --out game/validation/hub`) and confirm it exits with code 0
- `game/validation/hub/01-hub-overview.png` shows the 3D ship hub canvas **without** the "Lobby Connection" menu overlay dominating the frame
- `game/validation/hub/02-room-operations.png`, `03-room-commerce.png`, `04-room-salon.png` each show the corresponding 3D room zone with the menu dismissed
- Party-mate avatars (second player) are visible in at least one of the hub screenshots
- All hub assertions still pass (`boothDeductsGold`, `hatSwapFree`, `telepipeUpReset`)
- `game/validation/hub/findings.md` and `run-summary.json` are regenerated with updated screenshot paths

## Technical Specs

- **Files to verify (outputs):** `game/validation/hub/*.png`, `game/validation/hub/run-summary.json`, `game/validation/hub/findings.md`
- No code changes — this is a re-validation pass to produce corrected artifacts
- Run from the `game/` directory: `pnpm run validate:hub`

## Verification: visual
