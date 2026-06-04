# 01-add-card-identity

Add the `permafrost_lance` identity stub to `game/shared/cardDefs.json` so the card is known to the identity registry.

## Acceptance Criteria

- `game/shared/cardDefs.json` contains a `permafrost_lance` entry with:
  - `"id": "permafrost_lance"`
  - `"name": "Permafrost Lance"` (or similar descriptive name)
  - `"type": "spell"`
  - `"charges": 1`
- JSON remains valid (no trailing commas, proper syntax).

## Technical Specs

- **File:** `game/shared/cardDefs.json`
- Add one new key `permafrost_lance` following the existing pattern (e.g., match the structure of `frost_nova`: `{ "id": "frost_nova", "name": "Cryo Burst", "type": "spell", "charges": 1 }`).

## Verification: code
