# Client: convey heavy wind-up on card UI

Update lobby and in-run card presentation so players can see which cards require a committed wind-up before they fire, including the heavy hitters tuned in sub-tickets 01–02. This is copy/structure only — the wind-up mechanic itself already exists from ticket 307.

## Acceptance Criteria

- In-run hand slots (`renderHand` in `main.js`): any card whose def has `windUpMs > 0` shows a visible wind-up label (e.g. **"0.7s wind-up"** rounded to one decimal) in the slot content, and the slot `title` tooltip mentions commitment/lockout during the wind-up.
- Photon Forge stat preview (`getForgeAttunePreview` in `cards.js` + `renderPhotonForge`): cards with `windUpMs` gain a **Wind-up** row showing seconds (e.g. `0.7s`); row is omitted when `windUpMs` is absent.
- Post-run card reward choices (`cardChoiceDescription` in `progression.js`): descriptions for wind-up cards mention the commitment (e.g. append **"— heavy wind-up"** or use a `theme.json` template with `{seconds}`).
- Heavy hitters from sub-tickets 01–02 (`flame_blade`, `magma_greatsword`, `battle_familiar`, `soul_drain`, `astral_guardian`) all surface wind-up text in hand + forge views when those defs are loaded.
- Existing wind-up exemplars (`steel_claymore`, `glacier_collapse`, `dungeon_drake`, `spike_trap`) also show the label — not limited to the five heavy hitters.
- Client tests assert the wind-up label/helper exists and formats `windUpMs` correctly (extend `game/client/test/cards.test.js` and/or `main.test.js`).
- `cd game && pnpm test:quick` passes.

## Technical Specs

- **`game/client/main.js`**: in `renderHand()`, read `CARD_DEFS[card.id]?.windUpMs`; inject `.card-windup` span and enriched `slot.title` when `windUpMs > 0`. Add a small helper e.g. `formatWindUpLabel(windUpMs)` near `formatCardChargesDisplay`.
- **`game/client/cards.js`**: extend `getForgeAttunePreview(def, grind)` with a Wind-up row when `def.windUpMs > 0` (wind-up is not grind-scaled).
- **`game/server/progression.js`**: in `cardChoiceDescription(def)`, append wind-up hint when `def.windUpMs > 0` (use `THEME.cardDescriptions` template).
- **`game/shared/theme.json`**: add `cardDescriptions.windUpCommit` (or similar) template string with `{seconds}` placeholder.
- **`game/client/style.css`**: minimal `.card-windup` styling consistent with `.card-effect` / `.card-ms-cost` (muted accent, does not crowd the slot).
- **`game/client/test/cards.test.js`**, **`game/client/test/main.test.js`**: unit tests for `formatWindUpLabel` / forge row / hand HTML snippet.
- Do **not** change `windUpMs` or `charges` values in shared JSON (data sub-tickets 01–02 own those).

## Verification: code
