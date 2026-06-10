# 03 — Frost Crossing ice-sheet set piece

Rework `frost_crossing` tier 1 into an authored ice-band set piece: a small wave on the stone dock, a passage gate into the slippery ice arena, ranged `glacial_thrower` placements across the ice (slow-ball + slippery-floor identity), and a **Rimecast the Slow** named-rare finale — fixing the opening spawn-swarm (5 enemies at deploy) by construction.

## Acceptance Criteria

- Deploying `frost_crossing` tier 1 spawns **only** the dock's first scripted wave (≤2 hostiles); no run-start bulk swarm from `questScript` / `enemyPool`.
- At least **one** `passageLock` blocks entry to the ice band until the dock wave clears.
- Ice-band `scriptedEncounters` place **two or more** `glacial_thrower` spawns with authored `offset` positions at range across the ice room (not clustered on the player spawn).
- Final ice-band wave includes **Rimecast the Slow** as a `namedRare` on a `glacial_thrower` spawn (`displayName === 'Rimecast the Slow'`).
- **Three or more** distinct mid-run dialogue beats (dock briefing, ice-band entry, post-Rimecast or objective-complete).
- Slippery ice band remains active on the ice room floor (`band === 'ice'` layout); throwers use slow projectiles as today.
- `cd game && pnpm test:quick` passes; `frost_crossing_named_rare.test.js` updated (deploy enemy count, Rimecast spawn, passage-lock progression).

## Technical Specs

- **`game/server/quests.js`** — Rewrite `frost_crossing.tiers[1].scriptedEncounters` (dock room, ice `band: 'ice'` room, `passageLocks`, ranged thrower offsets) and `dialogueBeacons` / `dialogue`. **Remove** `script: buildFrostCrossingTier1Script()` (and the builder if unused) so `usesScriptedEncounterRuntime` is true via `passageLocks` alone — single spawn authority.
- **`game/server/scriptedEncounters.js`** — Reuse `offset` / `anchor` spawn resolution for ranged placements; no new unlock logic beyond existing passage locks.
- **`game/server/test/frost_crossing_named_rare.test.js`** — Assert deploy starts with dock wave count only; walk dock clear → lock opens → ice entry → Rimecast wave.
- **`game/server/test/ice_enemy.test.js`** — Update any assertions that assumed `questScript` bulk bypass.
- **Do not** change `frost_crossing` tier 2 (none exists) or unrelated quests.

## Verification: code
