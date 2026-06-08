# 05-wire-description-to-reward-choice

Wire the `description` field from card definitions into the reward-choice UI so players see wind-up commitment text when choosing card rewards. Currently `cardChoiceDescription()` ignores `def.description` and falls back to generic type-based text, making the wind-up descriptions on `flame_blade` and `magma_greatsword` invisible.

## Acceptance Criteria

- `cardChoiceDescription(def)` in `game/server/progression.js` returns `def.description` when the field is present and non-empty, before falling back to `specialEffect` or type-based generic text
- The reward-choice overlay shows the wind-up description for `flame_blade` ("…locks you during wind-up") and `magma_greatsword` ("…commits you during wind-up") when those cards appear as choices
- `cardChoiceDescription` is exported from `progression.js` for unit testing
- Add a test in `game/server/test/` asserting that `cardChoiceDescription` returns the `def.description` for both `flame_blade` and `magma_greatsword`, and still falls back to generic text for cards without a `description` field
- All existing tests still pass (`pnpm test`)

## Technical Specs

- **game/server/progression.js** — modify `cardChoiceDescription(def)` (~line 1013) to check `def.description` first:
  ```js
  function cardChoiceDescription(def) {
    if (!def) return '';
    if (def.description) return def.description;
    if (def.specialEffect) return def.specialEffect.replace(/_/g, ' ');
    // ... existing fallbacks unchanged
  }
  ```
  Add `cardChoiceDescription` to the module exports at the bottom of the file.
- **game/server/test/card_choice_description.test.js** (new) — unit tests for `cardChoiceDescription`:
  - Assert `cardChoiceDescription(CARD_DEFS.flame_blade)` returns the wind-up description string
  - Assert `cardChoiceDescription(CARD_DEFS.magma_greatsword)` returns the wind-up description string
  - Assert `cardChoiceDescription` for a card without `description` (e.g., `iron_sword`) still returns the generic type-based fallback

## Verification: code
