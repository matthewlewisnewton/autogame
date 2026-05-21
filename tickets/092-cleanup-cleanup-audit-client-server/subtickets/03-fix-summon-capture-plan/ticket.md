# Fix capture plan summon slot resolution

The capture plan for this ticket hard-codes `pressCard` on slot `0` to test summon card reconciliation, but the `summon-ready` debug scenario places the summon card in the first non-summon slot (not guaranteed to be slot 0). The harness `pressCard` action only accepts a static slot index, so the capture plan cannot dynamically locate the summon slot. Add support for resolving a card slot by card type or ID.

## Acceptance Criteria

- The `pressCard` action in `harness/screenshot.mjs` accepts an optional `cardType` field (e.g. `"summon"`) that, when present, resolves the slot index at runtime by querying the DOM for a `.card-slot` element matching that card type.
- When `cardType` is provided, the harness reads the card type from the DOM (e.g., via `data-card-type` attribute on `.card-slot` elements) and presses the corresponding slot.
- If `cardType` is provided but no matching slot is found, the harness logs a warning and skips the press (does not crash).
- When both `slot` and `cardType` are absent, the default behavior (slot 0) is preserved.
- The capture-plan prompt template (`harness/prompts/capture-plan.md`) documents the new `cardType` field on `pressCard`.
- A new capture plan using `pressCard` with `cardType: "summon"` validates without error through `validateRecipe()`.

## Technical Specs

- **File:** `harness/screenshot.mjs`
  - In `validateRecipe()` (~line 158), accept an optional `cardType` string field on `pressCard` steps (validate with a regex like `/^[a-z]+$/`).
  - In `executeRecipe()` (~line 356), when `step.cardType` is present on a `pressCard` step, query the page for `.card-slot[data-card-type="${step.cardType}"]` to find the matching slot, read its `data-slot-index`, and press that key. Fall back to a warning if no match.
- **File:** `harness/prompts/capture-plan.md`
  - Add `cardType` to the `pressCard` action description: "Fields: player, slot, cardType (optional — card type name to resolve slot dynamically), ms."
- **File:** `game/client/main.js` — `renderHand()` (~line 233) currently sets innerHTML on `.card-slot` elements but does **not** set a `data-card-type` attribute. Add `slot.dataset.cardType = card.type` (or equivalent) inside the `if (card)` branch, and `delete slot.dataset.cardType` in the `else` branch, so the harness can query slots by type.
- No other changes. Do not touch server code, test files, or game logic beyond the `renderHand` attribute addition.

## Verification: code
