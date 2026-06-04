# 01-add-card-definitions

Add the `permafrost_lance` identity stub to `game/shared/cardDefs.json` and the full server-side definition to `CARD_DEFS` in `game/server/progression.js`. The card reuses the existing `frost_nova` effect branch with cheaper stats (magicStoneCost 30, damage 8, radius 6, freezeDurationMs 2000).

## Acceptance Criteria

- `game/shared/cardDefs.json` contains a `permafrost_lance` entry with `id`, `name` ("Permafrost Lance"), `type: "spell"`, `charges: 1`.
- `game/server/progression.js` `CARD_DEFS` includes a `permafrost_lance` key spreading `CARD_IDENTITY.permafrost_lance` plus server-only fields: `magicStoneCost: 30`, `effect: 'frost_nova'`, `damage: 8`, `radius: 6`, `freezeDurationMs: 2000`, `specialEffect: 'freeze'`.
- Existing tests still pass (no regression in CARD_DEFS count or frost_nova behavior).

## Technical Specs

- **game/shared/cardDefs.json** — Add `"permafrost_lance": { "id": "permafrost_lance", "name": "Permafrost Lance", "type": "spell", "charges": 1 }` to the JSON object.
- **game/server/progression.js** — Add `permafrost_lance` entry to `CARD_DEFS` object (near `frost_nova`/`glacier_collapse`), mirroring the frost_nova pattern:
  ```js
  permafrost_lance: {
    ...CARD_IDENTITY.permafrost_lance,
    magicStoneCost: 30,
    effect: 'frost_nova',
    damage: 8,
    radius: 6,
    freezeDurationMs: 2000,
    specialEffect: 'freeze',
  },
  ```

## Verification: code
