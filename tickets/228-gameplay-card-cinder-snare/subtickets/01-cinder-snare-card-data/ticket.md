# Cinder Snare card data + obtainability

Add the new T2 enchantment `cinder_snare` to the shared card definitions
(identity + gameplay stats) and the client visual layer, and make it
obtainable through `SHOP_CARD_POOL`. This sub-ticket adds the data only —
the trap-trigger DoT mechanic is wired in sub-ticket 02.

## Acceptance Criteria

- `game/shared/cardDefs.json` has a `cinder_snare` identity stub:
  `id: "cinder_snare"`, `name: "Cinder Snare"`, `type: "enchantment"`,
  `charges: 1`, `acquisition: "shop"`.
- `game/shared/cardStats.json` has a `cinder_snare` stat object with:
  `magicStoneCost: 25`, `effect: "cinder_snare"`, `target: "ground"`,
  `radius: 2.5`, `damagePerTick: 8`, `dotTicks: 4`, `dotIntervalMs: 500`,
  `ttlMs: 30000`, `specialEffect: "proximity_hazard"`.
- Server `CARD_DEFS.cinder_snare` and client `CARD_DEFS.cinder_snare` both
  resolve (the merged identity+stats object) and stay in sync.
- `SHOP_CARD_POOL` (from `game/server/config.js`) contains `'cinder_snare'`.
- The client renders the card: `game/client/cards.js` color/icon map has a
  `cinder_snare` entry, and `game/client/cardRenderers.js` maps `cinder_snare`
  to a ground-enchantment renderer (reuse `renderGroundEnchantment`).
- Card-count assertions are updated from 42 to 43 in both
  `game/client/test/cards.test.js` and `game/server/test/new_card_pack.test.js`.
- Full vitest suite is green (notably `card_sync.test.js`, `cards.test.js`,
  `new_card_pack.test.js`).

## Technical Specs

- `game/shared/cardDefs.json`: add the `cinder_snare` identity entry. Use
  `acquisition: "shop"` so `shopOnlyIds` (config.js:47-49) picks it up into
  `SHOP_CARD_POOL` — do NOT use `acquisition: "reward"` (that path requires a
  unique `rewardOrder` and changes the victory rotation).
- `game/shared/cardStats.json`: add the `cinder_snare` stat object as above.
  Both server (`progression.js:139-144`) and client (`cards.js:19`) build
  `CARD_DEFS` by merging `cardDefs.json` + `cardStats.json`, so adding to the
  shared JSON syncs both sides automatically.
- `game/client/cards.js`: add a `cinder_snare` entry to the color/icon map
  (near `spike_trap`/`inferno_pillar`, ~lines 166-177) — a fire/ember theme
  (e.g. icon `🔥`, a warm red/orange color).
- `game/client/cardRenderers.js`: add `cinder_snare: renderGroundEnchantment`
  to the renderer map (near `spike_trap` ~line 285).
- `game/client/test/cards.test.js:17`: bump `toHaveLength(42)` → `43`.
- `game/server/test/new_card_pack.test.js:72`: bump `toHaveLength(42)` → `43`.
- Do NOT add any combat/trigger logic in this sub-ticket.

## Verification: code
