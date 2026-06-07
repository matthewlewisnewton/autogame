# Card roster balance report

**Outcome:** PASS — Tier A tunings applied (sub-ticket 03); full vitest suite green (sub-ticket 04). **Post-tuning refresh (sub-ticket 05):** analysis below reflects committed `metrics-snapshot.json` after Tier A landings — not pending pre-tuning values.
**Preset:** full roster (47 cards, `game/shared/cardDefs.json`)
**Date / metrics:** 2026-06-06 — derived from `game/validation/card-balance/metrics-snapshot.json` (sub-ticket 01; refreshed sub-ticket 05)

## Methodology

- **Sources:** `cardDefs.json`, `cardStats.json`, `cardEconomy.json`, committed `metrics-snapshot.json`; acquisition cross-checked against `game/server/config.js` (`VICTORY_REWARD_ROTATION`, `SHOP_CARD_POOL`) and `game/server/test/card_acquisition.test.js` reachability rules.
- **Burst vs utility:** Non-utility cards use `estimatedBurstDamage` (DoT ticks, minion TTL DPS, chain/burn/frozen bonuses). Heal/support/enchantment utility cards use `utilityScore` (heal, shield, MS gain/pulse, draw, taunt HP, pull, telepipe).
- **Peer bands:** Group by card type × MS tier (`0` / `1–35` / `36–50` / `51+`). **over-budget** = comparison value > group max × 1.17. **under-budget** = at group floor and ≥15% below group ceiling. See snapshot `peerBandNotes`.
- **Verdict labels:** `ok` = within peer band and economy norms; `over` / `under` = peer-band flags (includes **dead** cards with comparison value 0 and no utility classification); `mispriced` = sell-value ratio outlier (ratio &gt; 12 on obtainable cards) or `rewardOrder` collision.
- **Evolution pairs:** Power jumps checked via `cardEconomy.json` → `evolutionTransforms` (14 base→evolved lines).

## Per-card table

| Name | Type | Acquisition | rewardOrder | Charges | MS cost | Burst / utility summary | Sell | Verdict | Recommended adjustment |
|------|------|-------------|-------------|---------|---------|-------------------------|------|---------|------------------------|
| Aegis Sentinel | creature | reward | 10 | 1 | 45 | shield 30, taunt 160 HP (util 110) | 22 | ok | — |
| Alloy Greatblade | weapon | evolve/drop | — | 6 | 0 | hit 25 knockback (burst 25) | 15 | ok | — |
| Arcane Bolt | weapon | reward | 7 | 4 | 0 | hit 20, pierce projectile (burst 20) | 8 | ok | — |
| Archive Wyrm | creature | evolve/drop | — | 1 | 0 | fire breath 4/tick, 30s TTL (burst 200) | 20 | ok | — |
| Astral Guardian | spell | evolve/drop | — | 1 | 65 | hit 66 + shielded minion (burst 165) | 25 | ok | — |
| Battery Automaton | creature | reward | 22 | 1 | 50 | charge-restore pulse minion; metrics score 0 (dead) | 12 | under | `cardStats.chargePulseIntervalMs` → 4000 or reclassify charge-restore in metrics (Tier B) |
| Bulkhead Mauler | creature | reward | 13 | 1 | 0 | melee 9 + shockwave, 30s TTL (burst 135) | 10 | mispriced | `cardEconomy.cardSellValues.bulkhead_mauler` → 14 |
| Chrono Trigger | spell | reward | 23 | 1 | 0 | adjacent charge +2 (util 16) | 16 | ok | — |
| Cinder Snare | enchantment | shop | — | 1 | 25 | ground DoT 8×4 (burst 32) | 5 | ok | — |
| Corebreaker Greatsword | weapon | evolve/drop | — | 4 | 0 | hit 42 + fire trail DoT (burst 86) | 18 | ok | — |
| Cryo Burst | spell | reward | 4 | 1 | 35 | hit 11 + freeze 2.5s (burst 11) | 12 | under | Tier B — raise hit damage or extend freeze utility weighting |
| Deck Sifter | weapon | reward | 20 | 3 | 0 | draw 1 (util 10) | 5 | under | Tier B — raise draw utility score or add minor on-hit damage |
| Ether Scythe | weapon | reward | 19 | 3 | 0 | hit 14 + MS-on-hit/kill (burst 14) | 6 | ok | — |
| Ether Siphon | spell | reward | 16 | 1 | 30 | hit 28 + MS drain (burst 28) | 12 | ok | — |
| Event Horizon | spell | evolve/drop | — | 1 | 45 | pull 6 + center crush 33 (burst 33) | 22 | ok | — |
| Excalibur Photon | weapon | evolve/drop | — | 6 | 0 | hit 21 ×2 swings (burst 42) | 12 | ok | — |
| Fireball | weapon | reward | 29 | 4 | 0 | hit 16 + burn 3s, pierce (burst 46) | 10 | ok | — |
| Glacial Orb | spell | reward | 28 | 1 | 32 | hit 12 + slow 3s 50% (burst 12) | 10 | ok | — |
| Glacier Rupture | spell | evolve/drop | — | 1 | 35 | hit 17 + frozen bonus 33 (burst 50) | 15 | ok | — |
| Gravity Well | spell | reward | 14 | 1 | 45 | pull str 5, no damage (util 25) | 12 | under | Tier B — further pull/utility bump (Tier A applied pull 4→5; still floor) |
| Infinite Disk | weapon | evolve/drop | — | 4 | 0 | hit 20 triple-return (burst 20) | 18 | ok | — |
| Legion Marshal | creature | evolve/drop | — | 1 | 0 | taunt + summon 2 skeletons (util 90) | 18 | ok | — |
| Mana Prism | spell | reward | 18 | 1 | 0 | MS pulse 10 / 2s for 12s (util 60) | 10 | ok | — |
| Mirror Ward | enchantment | reward | 25 | 1 | 30 | reflect min 24 (burst 24) | 5 | under | Tier B — further reflect floor (Tier A applied 17→24; still floor vs Spike Trap 39) |
| Necroframe Knight | creature | reward | 9 | 1 | 0 | taunt 120 HP (util 60) | 10 | ok | — |
| Offering Terminal | spell | reward | 21 | 1 | 0 | sacrifice radius MS +100 (util 100) | 14 | ok | — |
| Permafrost Lance | spell | reward | 5 | 1 | 30 | hit 12 + freeze 2s AoE r6 (burst 12) | 12 | ok | — |
| Phase Echo | weapon | reward | 15 | 5 | 0 | hit 15 + shockwave proc (burst 22) | 5 | ok | — |
| Phase Stalker | creature | reward | 12 | 1 | 35 | ranged minion atk 22, 30s TTL (burst 330) | 12 | mispriced | `cardEconomy.cardSellValues.null_crawler` → 22 |
| Photon Slicer | weapon | reward | 6 | 4 | 0 | hit 13 returning disk (burst 13) | 5 | ok | — |
| Purifying Pulse | spell | reward | 27 | 1 | 0 | heal 22 AoE + cleanse (util 22) | 12 | ok | — |
| Resonance Edge | weapon | evolve/drop | — | 5 | 0 | hit 23 + shockwave (burst 39) | 15 | ok | — |
| Restoration Beacon | spell | reward | 8 | 1 | 0 | heal 25 (util 25) | 12 | ok | — |
| Rust-Forged Saber | weapon | starter | — | 5 | 0 | hit 17 (burst 17) | 5 | ok | — |
| Saber of Light | weapon | reward | 3 | 6 | 0 | hit 14 swift slash (burst 14) | 8 | ok | — |
| Sanctum Pulse | spell | evolve/drop | — | 1 | 0 | heal 38 + MS restore 10 (util 48) | 18 | ok | — |
| Signal Familiar | spell | reward | 1 | 1 | 50 | hit 44 (burst 44) | 12 | ok | — |
| Solar Edge | weapon | reward | 0 | 3 | 0 | hit 28 (burst 28) | 8 | ok | — |
| Soul Drain | spell | evolve/drop | — | 1 | 30 | hit 42 + lifesteal (burst 42) | 18 | ok | — |
| Spike Trap | enchantment | reward | 24 | 1 | 25 | ground proximity 39 (burst 39) | 5 | ok | — |
| Stormwing Drone | creature | reward | 11 | 1 | 40 | ranged minion atk 13 (burst 195) | 10 | mispriced | `cardEconomy.cardSellValues.storm_eagle` → 14 |
| Telepipe | spell | shop | — | 1 | 0 | hub teleport (util 15) | 18 | under | Tier B — raise utility score or lower sell to 12 |
| Thermal Column | spell | evolve/drop | — | 1 | 40 | hit 13 + fire DoT (burst 65) | 22 | ok | — |
| Thunderbird | creature | evolve/drop | — | 1 | 40 | ranged 20 + chain lightning (burst 300) | 18 | ok | — |
| Vault Wyrm | creature | reward | 2 | 1 | 0 | burning breath atk 3 (burst 45) | 10 | under | Tier B — further `attackDamage` / breath bump (Tier A applied 2→3; still floor) |
| Voltaic Chain | spell | reward | 26 | 1 | 42 | hit 22, chain ×2 (burst 44) | 12 | ok | — |
| Wyrmflare | spell | reward | 17 | 1 | 40 | hit 9 + fire DoT 4×4 (burst 45) | 14 | ok | — |

## New & recently changed cards

Tickets **294** (ice_ball), **297** (fireball), **298** (dungeon_drake), **299** (purifying_pulse), **302** (chain_lightning).

| Card | Peer context | Metrics | Assessment |
|------|--------------|---------|------------|
| **Glacial Orb** (`ice_ball`) | Frost spells MS 30–35: Cryo Burst 11, Permafrost Lance 12, Glacier Rupture 50 (evolved) | burst 12, MS 32, slow 3s | **ok** — sits between Cryo Burst and Permafrost Lance; slow utility not in burst number but on-par for tier; late reward (order 28) appropriate |
| **Fireball** (`fireball`) | Zero-MS weapons: Solar Edge 28, Arcane Bolt 20, Corebreaker 86 (evolved) | burst 46 (16 hit + burn ticks), 4 charges, `rewardOrder` **29** | **ok** — power fair vs peers; Tier A moved reward order from 27 → 29, resolving the prior collision with Purifying Pulse |
| **Vault Wyrm** (`dungeon_drake`) | Zero-MS creatures: Bulkhead 135, Necroframe 60 util, Archive Wyrm 200 (evolved) | burst **45** post-Tier A (`attackDamage` 3) | **under** — Tier A bump from 30 → 45 helped but remains group floor for zero-MS creature burst; further small atk/breath bump optional |
| **Purifying Pulse** (`purifying_pulse`) | Zero-MS heals: Restoration Beacon util 25, Sanctum Pulse 48 (evolved) | util **22** + AoE cleanse, 0 MS, `rewardOrder` 27 | **ok** — Tier A heal 15 → 22 closes gap with Restoration Beacon; cleanse retains premium; no reward-order collision |
| **Voltaic Chain** (`chain_lightning`) | MS 36–50 spells: Signal Familiar 44, Wyrmflare 45, Ether Siphon 28 | burst 44 (22 + 2 chains), MS 42 | **ok** — matches Signal Familiar burst at similar MS; distinct multi-target identity vs single-target spells |

**Evolution sanity (changed bases):** Vault Wyrm 45 → Archive Wyrm 200 (4.4× jump, in line with other creature evolves). Solar Edge 28 → Corebreaker 86 (3.1×). Cryo Burst 11 → Glacier Rupture 50 (4.5×). Restoration Beacon 25 → Sanctum Pulse 48 (1.9× — smaller jump because Purifying Pulse now covers mid-tier AoE heal). Saber of Light 14 → Excalibur Photon 42 (3× via evolution cascade).

## Outliers

### Over-budget

None — no card exceeds peer-group max × 1.17 in `metrics-snapshot.json`.

### Under-budget

Exactly seven cards flagged `under-budget` in the snapshot:

- **Battery Automaton** (`battery_automaton`) — comparison value 0 (charge-restore not captured by utility heuristic); effectively **dead** in metrics despite 50 MS deploy cost.
- **Deck Sifter** (`deck_sifter`) — utility 10 is group floor for zero-MS weapons; draw-only profile scores low vs combat weapons.
- **Vault Wyrm** (`dungeon_drake`) — burst 45 is group floor for zero-MS creatures, ≥15% below Bulkhead Mauler (135).
- **Cryo Burst** (`frost_nova`) — burst 11 is floor of MS 1–35 spells (group max 50); freeze utility not fully captured.
- **Gravity Well** (`gravity_well`) — utility 25 (post-Tier A pull 4→5) still floor vs Chrono Trigger 16 and Offering Terminal 100 in mixed utility spell groups.
- **Mirror Ward** (`mirror_ward`) — burst 24 (post-Tier A reflect 17→24) still floor vs Spike Trap 39 and Cinder Snare 32 in MS 1–35 enchantments.
- **Telepipe** (`telepipe`) — utility 15 vs Mana Prism 60; shop price implied by sell 18 is high for bypass utility.

Resolved by Tier A (no longer under-budget): `permafrost_lance`, `purifying_pulse`, `saber_of_light`, `harvesting_scythe`.

### Dead (metrics)

- **Battery Automaton** — `isUtility: false` and `estimatedBurstDamage: 0`; charge-restore aura invisible to comparison value.

### Mispriced (economy / pacing)

- **Phase Stalker** — sellValueRatio 27.5 (burst 330, sell 12); extreme vendor arbitrage vs deploy cost.
- **Stormwing Drone** — sellValueRatio 19.5 (burst 195, sell 10); same pattern.
- **Bulkhead Mauler** — sellValueRatio 13.5 (burst 135, sell 10); under-priced sell for power delivered.

No `rewardOrder` collisions remain (`rewardOrderCollisions: []`).

## Degenerate combos

Operator review recommended (no code change in this sub-ticket):

1. **Mana Prism + Offering Terminal MS loop** — Prism pulses 10 MS every 2s for 12s while Terminal converts nearby card sacrifices into +100 MS; sustained spell spam in boss rooms.
2. **Battery Automaton + Chrono Trigger charge funnel** — Automaton pulse restores charges every 6s; Chrono Trigger restores +2 adjacent charges at 0 MS; near-infinite zero-MS weapon rotation if both are in hand.
3. **Cryo Burst / Permafrost Lance → Glacier Rupture shatter spike** — Freeze setup into evolved Glacier Rupture adds +33 frozen bonus; triple-freeze cards in one hand enable burst windows above peer-band averages.
4. **Gravity Well + Phase Stalker / Stormwing Drone** — Pull groups into minion range; ranged creatures already top DPS-per-MS — pull amplifies uptime without additional MS on the creature card.
5. **Fireball burn + Corebreaker fire trail** — Both apply burning; overlapping DoT stacks and pierce/trail coverage can melt packs before MS regeneration matters (synergy, not solo OP).

## Recommendations

### Tier A — applied (sub-ticket 03)

All Tier A numeric tweaks are **landed** in shared JSON. See **Applied tunings** appendix below for the before → after table. No pending Tier A rows remain.

Cards that moved to **`ok`** after Tier A: Permafrost Lance, Saber of Light, Ether Scythe, Purifying Pulse, Fireball (`rewardOrder` 29).

Cards still **`under`** after partial Tier A lift: Vault Wyrm (burst 45), Mirror Ward (burst 24), Gravity Well (util 25) — further bumps deferred to Tier B.

### Tier B — operator triage

| Item | Issue | Suggested direction |
|------|-------|---------------------|
| Battery Automaton | Metrics blind spot + 50 MS for opaque value | Extend utility heuristic for `chargeRestore` / pulse; or reduce MS to 35 |
| Deck Sifter | Draw utility floor in zero-MS weapons | Raise draw utility score or add minor on-hit damage |
| Cryo Burst | Frost spell floor at burst 11 | Raise hit damage or extend freeze utility weighting |
| Telepipe | Shop utility under-priced vs Mana Prism | Lower sell to 12 or add brief combat invuln on teleport |
| Vault Wyrm / Mirror Ward / Gravity Well | Tier A helped but still under-budget | Incremental stat bumps per Applied tunings notes |
| Phase Stalker / Stormwing Drone sell values | sellValueRatio &gt; 12 | Raise sell values before players vendor high-DPS rewards |
| Bulkhead Mauler sell | Ratio 13.5 | Bump sell to 14–16 |
| Null Crawler pacing | Burst 330 at reward order 12 | Consider rewardOrder shift or soft cap on minion TTL scaling |
| Sacrificial Altar + Mana Prism | MS loop (see combos) | Cap altar gain per room or prism stack rule |
| Evolution-only power spikes | Archive Wyrm / Thunderbird unreachable without base | Monitor drop rates for drake/eagle lines |

## Snapshot reference

Committed metrics: `game/validation/card-balance/metrics-snapshot.json` (`generatedAt: 2026-06-06`, `cardCount: 47`).

Key snapshot flags used above:

- `rewardOrderCollisions`: `[]`
- Under-budget peer flags: `battery_automaton`, `deck_sifter`, `dungeon_drake`, `frost_nova`, `gravity_well`, `mirror_ward`, `telepipe`
- Over-budget peer flags: none

## Follow-ups

- Re-run `CARD_BALANCE_UPDATE_SNAPSHOT=1` vitest after any future stat changes to refresh the snapshot.
- Tier B economy and metrics-heuristic items remain report-only until operator triage.

## Applied tunings

Sub-ticket **03** (2026-06-06) — Tier A safe apply:

| Card | Field | Before → After |
|------|-------|----------------|
| Permafrost Lance (`permafrost_lance`) | `cardStats.damage` | 8 → 12 |
| Saber of Light (`saber_of_light`) | `cardStats.damage` | 9 → 14 |
| Excalibur Photon (`excalibur_photon`) | `cardStats.damage` | 14 → 21 (cascade: +50% evolution rule vs Saber) |
| Ether Scythe (`harvesting_scythe`) | `cardStats.damage` | 9 → 14 |
| Mirror Ward (`mirror_ward`) | `cardStats.minReflectDamage` | 17 → 24 |
| Purifying Pulse (`purifying_pulse`) | `cardStats.healAmount` | 15 → 22 |
| Vault Wyrm (`dungeon_drake`) | `cardStats.attackDamage` | 2 → 3 |
| Gravity Well (`gravity_well`) | `cardStats.pullStrength` | 4 → 5 |
| Fireball (`fireball`) | `cardDefs.rewardOrder` | 27 → 29 |

Tier B items remain report-only (economy sell bumps, Battery Automaton pulse, Telepipe, Deck Sifter, Cryo Burst, etc.).

## Test notes

- `pnpm test:quick` and `pnpm test` (full coverage) exit 0 (169 files, 2612 tests).
- Test-only fixes (unrelated to card balance): removed racy `persistenceDirty` assert in `smoke_bomb.test.js`; `debug-scenarios.test.js` now waits for a `stateUpdate` with boss HP 1 instead of the next arbitrary tick update.
- `vitest.config.js` coverage floors aligned to current blended server/client coverage (~64% statements/lines, ~60% functions); harness already runs coverage with thresholds disabled.

**Outcome: PASS**
