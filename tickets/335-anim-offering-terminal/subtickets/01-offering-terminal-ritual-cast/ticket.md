# Offering Terminal ritual cast: altar structure and minion consumption visual

Redesign the `sacrificial_altar` ("Offering Terminal") client renderer so its
cast reads unmistakably as a *ritual sacrifice* — a dark altar/terminal structure
rises at the cast origin, the sacrifice zone telegraphs at `data.radius`, and the
consumed minion's position shows a red collapse/implosion effect. Replace the
current minimal gold ring + burst with a richer, thematically appropriate
composition using the 315 shared VFX primitives.

This is sub-ticket 01 of 335-anim-offering-terminal. Sub-ticket 02 builds on
this to add the energy-return / reward-feedback aftermath.

## Acceptance Criteria

- `renderSacrificialAltar` (in `game/client/cardRenderers.js`) still keys off
  `data.radius` and the cast `origin`, and bails out only when `data.radius`
  is undefined (current guard preserved).
- On cast it composes a clearly *sacrificial* ritual using shared VFX primitives:
  - A dark altar/terminal structure at the cast origin — a small vertical pillar
    or column (dark body color, e.g. 0x1c1917 or similar near-black, with a
    gold emissive rim 0xfbbf24) spawned via `ctx.spawnSummonEffect` or a
    dedicated `spawnImpactDecal` at origin with a small radius (~1.0–1.5) to
    read as a raised terminal base.
  - An expanding ritual telegraph ring at `data.radius` (sacrifice radius 10)
    using the existing gold/red palette (`SACRIFICIAL_ALTAR_COLOR` 0xfbbf24,
    `SACRIFICIAL_ALTAR_EMISSIVE` 0xef4444) via `ctx.spawnTelegraphRing`.
  - A red implosion/collapse burst at the consumed minion's position when
    `data.sacrificedMinionId` is present in the payload — a smaller,
    inward-reading burst (e.g. `ctx.spawnParticleBurst` at the minion origin
    with red/dark palette, lower `spread` than the caster burst to read as
    consumption rather than explosion).
  - A gold/red ember burst at the caster origin (existing behavior preserved,
    may increase `count`/`spread` for richer look).
- The renderer must remain visually distinct from `mana_prism` (economy crystal),
  `astral_guardian` (shield summon), and `chrono_trigger` (time ripple).
- `renderSacrificialAltar` and `renderManaPrism` still resolve to different
  functions and produce a different set of primitive calls for an equivalent
  radial payload (existing distinctness tests keep passing).
- All effects fire synchronously inside `renderSacrificialAltar` — no
  `setTimeout`, `scheduleAfter`, or async delay — matching the server's instant
  sacrificial_altar-branch resolution (no wind-up, no projectile travel).
- A client test asserts the new primitive composition (altar structure at origin,
  telegraph ring at `radius`, consumption burst when `sacrificedMinionId` is
  present, ember burst at origin, gold/red palette).
- Full client + server vitest suite passes; no perf regression (no new
  per-frame work, no unbounded particle counts).

## Technical Specs

- `game/client/cardRenderers.js`: rewrite `renderSacrificialAltar` (around line
  2160). Compose the ritual from these primitives:
  - `ctx.spawnSummonEffect(origin, ~1.2, { color: 0x1c1917, emissive: 0xfbbf24 })`
    for the dark altar/terminal pillar at origin (or a small `spawnImpactDecal`
    if summon effect is too large).
  - `ctx.spawnTelegraphRing(origin, data.radius, { color, emissive })` for the
    sacrifice zone ring (keep existing gold/red palette).
  - When `data.sacrificedMinionId` is truthful: spawn a red consumption burst.
    The minion's position is NOT in the current `CARD_USED` payload
    (`game/server/cardEffects.js` ~693 only sends `sacrificedMinionId` as a
    string id). Use the cast `origin` as the consumption point (the minion is
    consumed at the ritual center), OR if the minion's last-known position is
    available from scene state, use that. For simplicity, fire the consumption
    burst at `origin` with a distinct red palette
    (`color: 0x991b1b, emissive: 0xef4444, count: 10, spread: 1.0`) to read as
    implosion, separate from the gold ember burst.
  - `ctx.spawnParticleBurst(origin, { color, emissive, count: 16, spread: 2.4 })`
    for the caster's gold/red ember burst (existing, may enrich).
  - Keep the existing `SACRIFICIAL_ALTAR_COLOR` and `SACRIFICIAL_ALTAR_EMISSIVE`
    constants. Keep `getAccentHex` fallback pattern.
- Keep the function registered as `sacrificial_altar: renderSacrificialAltar`
  (around line 2252) — do not change the registration table key.
- Server `CARD_USED` payload for `sacrificial_altar`
  (`game/server/cardEffects.js` ~693–707):
  `{ playerId, cardId, slotIndex, origin, radius, sacrificedMinionId,
    magicStonesGained, restoredCharges }` — read from these fields; do NOT
    modify the server.
- `game/client/test/cardRenderers.test.js`: update the existing
  `sacrificial_altar adds a gold/red ritual telegraph and burst...` test
  (around line 2575) to assert the new composition (altar summon at origin,
  telegraph ring at radius, consumption burst when `sacrificedMinionId` present,
  ember burst at origin). Add a negative test: when `sacrificedMinionId` is
  absent, no consumption burst fires.
- Do NOT touch the server, `cardEffects.js`, `cardStats.json`, or any other
  card's renderer.

## Verification: code
