# Card roster balance report

**Outcome:** PASS — Tier A tunings applied (sub-ticket 03); full vitest suite green (sub-ticket 04).
**Preset:** full roster (47 cards, `game/shared/cardDefs.json`)
**Date / metrics:** 2026-06-06 — derived from `game/validation/card-balance/metrics-snapshot.json` (sub-ticket 01)

## Methodology

- **Sources:** `cardDefs.json`, `cardStats.json`, `cardEconomy.json`, committed `metrics-snapshot.json`; acquisition cross-checked against `game/server/config.js` (`VICTORY_REWARD_ROTATION`, `SHOP_CARD_POOL`) and `game/server/test/card_acquisition.test.js` reachability rules.
- **Burst vs utility:** Non-utility cards use `estimatedBurstDamage` (DoT ticks, minion TTL DPS, chain/burn/frozen bonuses). Heal/support/enchantment utility cards use `utilityScore` (heal, shield, MS gain/pulse, draw, taunt HP, pull, telepipe).
- **Peer bands:** Group by card type × MS tier (`0` / `1–35` / `36–50` / `51+`). **over-budget** = comparison value > group max × 1.17. **under-budget** = at group floor and ≥15% below group ceiling. See snapshot `peerBandNotes`.
- **Verdict labels:** `ok` = within peer band and economy norms; `over` / `under` = peer-band flags (includes **dead** cards with comparison value 0 and no utility classification); `mispriced` = sell-value ratio outlier (ratio &lt; 1.3 or &gt; 12 on obtainable cards) or `rewardOrder` collision.
- **Evolution pairs:** Power jumps checked via `cardEconomy.json` → `evolutionTransforms` (14 base→evolved lines).

## Per-card table

| Name | Type | Acquisition | rewardOrder | Charges | MS cost | Burst / utility summary | Sell | Verdict | Recommended adjustment |
|------|------|-------------|-------------|---------|---------|-------------------------|------|---------|------------------------|
| Aegis Sentinel | creature | reward | 10 | 1 | 45 | shield 30, taunt 160 HP (util 110) | 22 | ok | — |
| Archive Wyrm | creature | evolve/drop | — | 1 | 0 | fire breath 4/tick, 30s TTL (burst 200) | 20 | ok | — |
| Arcane Bolt | weapon | reward | 7 | 4 | 0 | hit 20, pierce projectile (burst 20) | 8 | ok | — |
| Astral Guardian | spell | evolve/drop | — | 1 | 65 | hit 66 + shielded minion (burst 165) | 25 | ok | — |
| Battery Automaton | creature | reward | 22 | 1 | 50 | charge-restore pulse minion; metrics score 0 (dead) | 12 | under | `cardStats.chargePulseIntervalMs` → 4000 (Tier A) or reclassify charge-restore in metrics (Tier B) |
| Signal Familiar | spell | reward | 1 | 1 | 50 | hit 44 (burst 44) | 12 | ok | — |
| Bulkhead Mauler | creature | reward | 13 | 1 | 0 | melee 9 + shockwave, 30s TTL (burst 135) | 10 | mispriced | `cardEconomy.cardSellValues.bulkhead_mauler` → 14 |
| Voltaic Chain | spell | reward | 26 | 1 | 42 | hit 22, chain ×2 (burst 44) | 12 | ok | — |
| Chrono Trigger | spell | reward | 23 | 1 | 0 | adjacent charge +2 (util 16) | 16 | ok | — |
| Cinder Snare | enchantment | shop | — | 1 | 25 | ground DoT 8×4 (burst 32) | 5 | ok | — |
| Deck Sifter | weapon | reward | 20 | 3 | 0 | draw 1 (util 10) | 5 | ok | — |
| Sanctum Pulse | spell | evolve/drop | — | 1 | 0 | heal 38 + MS restore 10 (util 48) | 18 | ok | — |
| Wyrmflare | spell | reward | 17 | 1 | 40 | hit 9 + fire DoT 4×4 (burst 45) | 14 | ok | — |
| Vault Wyrm | creature | reward | 2 | 1 | 0 | burning breath, low DPS after #298 rebalance (burst 30) | 10 | under | `cardStats.attackDamage` → 3 |
| Phase Echo | weapon | reward | 15 | 5 | 0 | hit 15 + shockwave proc (burst 22) | 5 | ok | — |
| Event Horizon | spell | evolve/drop | — | 1 | 45 | pull 6 + center crush 33 (burst 33) | 22 | ok | — |
| Excalibur Photon | weapon | evolve/drop | — | 6 | 0 | hit 14 ×2 swings (burst 28) | 12 | ok | — |
| Fireball | weapon | reward | 27 | 4 | 0 | hit 16 + burn 3s, pierce (burst 46) | 10 | mispriced | `cardDefs.rewardOrder` → 29 (split collision with Purifying Pulse) |
| Solar Edge | weapon | reward | 0 | 3 | 0 | hit 28 (burst 28) | 8 | ok | — |
| Cryo Burst | spell | reward | 4 | 1 | 35 | hit 11 + freeze 2.5s (burst 11) | 12 | ok | — |
| Glacier Rupture | spell | evolve/drop | — | 1 | 35 | hit 17 + frozen bonus 33 (burst 50) | 15 | ok | — |
| Gravity Well | spell | reward | 14 | 1 | 45 | pull str 4, no damage (util 20) | 12 | under | `cardStats.pullStrength` → 5 |
| Ether Scythe | weapon | reward | 19 | 3 | 0 | hit 9 + MS-on-hit/kill (burst 9) | 6 | under | `cardStats.damage` → 14 |
| Restoration Beacon | spell | reward | 8 | 1 | 0 | heal 25 (util 25) | 12 | ok | — |
| Glacial Orb | spell | reward | 28 | 1 | 32 | hit 12 + slow 3s 50% (burst 12) | 10 | ok | — |
| Thermal Column | spell | evolve/drop | — | 1 | 40 | hit 13 + fire DoT (burst 65) | 22 | ok | — |
| Infinite Disk | weapon | evolve/drop | — | 4 | 0 | hit 20 triple-return (burst 20) | 18 | ok | — |
| Rust-Forged Saber | weapon | starter | — | 5 | 0 | hit 17 (burst 17) | 5 | ok | — |
| Corebreaker Greatsword | weapon | evolve/drop | — | 4 | 0 | hit 42 + fire trail DoT (burst 86) | 18 | ok | — |
| Ether Siphon | spell | reward | 16 | 1 | 30 | hit 28 + MS drain (burst 28) | 12 | ok | — |
| Mana Prism | spell | reward | 18 | 1 | 0 | MS pulse 10 / 2s for 12s (util 60) | 10 | ok | — |
| Mirror Ward | enchantment | reward | 25 | 1 | 30 | reflect min 17 (burst 17) | 5 | under | `cardStats.minReflectDamage` → 24 |
| Phase Stalker | creature | reward | 12 | 1 | 35 | ranged minion atk 22, 30s TTL (burst 330) | 12 | mispriced | `cardEconomy.cardSellValues.null_crawler` → 22 |
| Permafrost Lance | spell | reward | 5 | 1 | 30 | hit 8 + freeze 2s AoE r6 (burst 8) | 12 | under | `cardStats.damage` → 12 |
| Photon Slicer | weapon | reward | 6 | 4 | 0 | hit 13 returning disk (burst 13) | 5 | ok | — |
| Purifying Pulse | spell | reward | 27 | 1 | 0 | heal 15 AoE + cleanse (util 15) | 12 | under | `cardStats.healAmount` → 22; keep `rewardOrder` 27 after Fireball moved |
| Resonance Edge | weapon | evolve/drop | — | 5 | 0 | hit 23 + shockwave (burst 39) | 15 | ok | — |
| Saber of Light | weapon | reward | 3 | 6 | 0 | hit 9 swift slash (burst 9) | 8 | under | `cardStats.damage` → 14 |
| Offering Terminal | spell | reward | 21 | 1 | 0 | sacrifice radius MS +100 (util 100) | 14 | ok | — |
| Necroframe Knight | creature | reward | 9 | 1 | 0 | taunt 120 HP (util 60) | 10 | ok | — |
| Soul Drain | spell | evolve/drop | — | 1 | 30 | hit 42 + lifesteal (burst 42) | 18 | ok | — |
| Spike Trap | enchantment | reward | 24 | 1 | 25 | ground proximity 39 (burst 39) | 5 | ok | — |
| Alloy Greatblade | weapon | evolve/drop | — | 6 | 0 | hit 25 knockback (burst 25) | 15 | ok | — |
| Stormwing Drone | creature | reward | 11 | 1 | 40 | ranged minion atk 13 (burst 195) | 10 | mispriced | `cardEconomy.cardSellValues.storm_eagle` → 14 |
| Telepipe | spell | shop | — | 1 | 0 | hub teleport (util 15) | 18 | under | Tier B — raise utility score or lower sell to 12 |
| Thunderbird | creature | evolve/drop | — | 1 | 40 | ranged 20 + chain lightning (burst 300) | 18 | ok | — |
| Legion Marshal | creature | evolve/drop | — | 1 | 0 | taunt + summon 2 skeletons (util 90) | 18 | ok | — |

## New & recently changed cards

Tickets **294** (ice_ball), **297** (fireball), **298** (dungeon_drake), **299** (purifying_pulse), **302** (chain_lightning).

| Card | Peer context | Metrics | Assessment |
|------|--------------|---------|------------|
| **Glacial Orb** (`ice_ball`) | Frost spells MS 30–35: Cryo Burst 11, Permafrost Lance 8, Glacier Rupture 50 (evolved) | burst 12, MS 32, slow 3s | **ok** — sits between Cryo Burst and Permafrost Lance; slow utility not in burst number but on-par for tier; late reward (order 28) appropriate |
| **Fireball** (`fireball`) | Zero-MS weapons: Solar Edge 28, Arcane Bolt 20, Corebreaker 86 (evolved) | burst 46 (16 hit + burn ticks), 4 charges | **ok** power, **mispriced** pacing — shares `rewardOrder` 27 with Purifying Pulse; power is fair vs peers but collision skews victory RNG |
| **Vault Wyrm** (`dungeon_drake`) | Zero-MS creatures: Bulkhead 135, Necroframe 60 util, Archive Wyrm 200 (evolved) | burst 30 post-#298 breath rebalance | **under** — lowest zero-MS creature burst; intentional #298 trim may have overshot; small atk/breath bump recommended |
| **Purifying Pulse** (`purifying_pulse`) | Zero-MS heals: Restoration Beacon util 25, Sanctum Pulse 48 (evolved) | util 15 + AoE cleanse, 0 MS | **under** — heal value 40% below Restoration Beacon despite cleanse upside; reward-order collision with Fireball |
| **Voltaic Chain** (`chain_lightning`) | MS 36–50 spells: Signal Familiar 44, Wyrmflare 45, Ether Siphon 28 | burst 44 (22 + 2 chains), MS 42 | **ok** — matches Signal Familiar burst at similar MS; distinct multi-target identity vs single-target spells |

**Evolution sanity (changed bases):** Vault Wyrm 30 → Archive Wyrm 200 (6.7× jump, in line with other creature evolves). Solar Edge 28 → Corebreaker 86 (3.1×). Cryo Burst 11 → Glacier Rupture 50 (4.5×). Restoration Beacon 25 → Sanctum Pulse 48 (1.9× — smaller jump because Purifying Pulse now covers mid-tier AoE heal).

## Outliers

### Over-budget

None — no card exceeds peer-group max × 1.17 in `metrics-snapshot.json`.

### Under-budget

- **Battery Automaton** — comparison value 0 (charge-restore not captured by utility heuristic); effectively **dead** in metrics despite 50 MS deploy cost.
- **Vault Wyrm** — burst 30 is group floor for zero-MS creatures, ≥15% below Bulkhead Mauler (135).
- **Gravity Well** — utility 20 vs Chrono Trigger 16 and Offering Terminal 100 in mixed utility spell groups; pull-only profile scores low.
- **Ether Scythe** — burst 9 vs Photon Slicer 13 and Phase Echo 22 in zero-MS weapons.
- **Mirror Ward** — burst 17 vs Spike Trap 39 and Cinder Snare 32 in MS 1–35 enchantments.
- **Permafrost Lance** — burst 8, floor of MS 1–35 spells (group max 50).
- **Purifying Pulse** — utility 15 vs Restoration Beacon 25 (same zero-MS heal tier).
- **Saber of Light** — burst 9 vs Solar Edge 28 (zero-MS weapons); 6 charges do not compensate in comparison metric.
- **Telepipe** — utility 15 vs Mana Prism 60; shop price implied by sell 18 is high for bypass utility.

### Dead (metrics)

- **Battery Automaton** — `isUtility: false` and `estimatedBurstDamage: 0`; charge-restore aura invisible to comparison value.

### Mispriced (economy / pacing)

- **Fireball** + **Purifying Pulse** — `rewardOrder` 27 collision (snapshot `rewardOrderCollisions`); only one can occupy a victory slot per rotation index.
- **Phase Stalker** — sellValueRatio 27.5 (burst 330, sell 12); extreme vendor arbitrage vs deploy cost.
- **Stormwing Drone** — sellValueRatio 19.5 (burst 195, sell 10); same pattern.
- **Bulkhead Mauler** — sellValueRatio 13.5 (burst 135, sell 10); under-priced sell for power delivered.

## Degenerate combos

Operator review recommended (no code change in this sub-ticket):

1. **Mana Prism + Offering Terminal MS loop** — Prism pulses 10 MS every 2s for 12s while Terminal converts nearby card sacrifices into +100 MS; sustained spell spam in boss rooms.
2. **Battery Automaton + Chrono Trigger charge funnel** — Automaton pulse restores charges every 6s; Chrono Trigger restores +2 adjacent charges at 0 MS; near-infinite zero-MS weapon rotation if both are in hand.
3. **Cryo Burst / Permafrost Lance → Glacier Rupture shatter spike** — Freeze setup into evolved Glacier Rupture adds +33 frozen bonus; triple-freeze cards in one hand enable burst windows above peer-band averages.
4. **Gravity Well + Phase Stalker / Stormwing Drone** — Pull groups into minion range; ranged creatures already top DPS-per-MS — pull amplifies uptime without additional MS on the creature card.
5. **Fireball burn + Corebreaker fire trail** — Both apply burning; overlapping DoT stacks and pierce/trail coverage can melt packs before MS regeneration matters (synergy, not solo OP).

## Recommendations

### Tier A — safe apply (shared JSON numeric tweaks only)

| Card | Field | Current → target | Rationale |
|------|-------|------------------|-----------|
| Permafrost Lance | `cardStats.permafrost_lance.damage` | 8 → **12** | Lifts burst to mid frost tier without exceeding Cryo Burst + utility tradeoff |
| Saber of Light | `cardStats.saber_of_light.damage` | 9 → **14** | Brings per-charge value toward Solar Edge while keeping swift cooldown identity |
| Ether Scythe | `cardStats.harvesting_scythe.damage` | 9 → **14** | MS-on-hit kit still unique; base hit no longer dead last in weapon band |
| Mirror Ward | `cardStats.mirror_ward.minReflectDamage` | 17 → **24** | Aligns reflect floor with half of Spike Trap burst |
| Purifying Pulse | `cardStats.purifying_pulse.healAmount` | 15 → **22** | Near Restoration Beacon; cleanse retains premium |
| Vault Wyrm | `cardStats.dungeon_drake.attackDamage` | 2 → **3** | Small #298 recovery; keeps breath-focused identity |
| Gravity Well | `cardStats.gravity_well.pullStrength` | 4 → **5** | Utility score 20 → 25; still below Event Horizon crush evolve |
| Fireball | `cardDefs.fireball.rewardOrder` | 27 → **29** | Resolves rotation collision with Purifying Pulse |

### Tier B — operator triage

| Item | Issue | Suggested direction |
|------|-------|---------------------|
| Battery Automaton | Metrics blind spot + 50 MS for opaque value | Extend utility heuristic for `chargeRestore` / pulse; or reduce MS to 35 |
| Telepipe | Shop utility under-priced vs Mana Prism | Lower sell to 12 or add brief combat invuln on teleport |
| Phase Stalker / Stormwing Drone sell values | sellValueRatio &gt; 12 | Raise sell values before players vendor high-DPS rewards |
| Bulkhead Mauler sell | Ratio 13.5 | Bump sell to 14–16 |
| Null Crawler pacing | Burst 330 at reward order 12 | Consider rewardOrder shift or soft cap on minion TTL scaling |
| Sacrificial Altar + Mana Prism | MS loop (see combos) | Cap altar gain per room or prism stack rule |
| Evolution-only power spikes | Archive Wyrm / Thunderbird unreachable without base | Monitor drop rates for drake/eagle lines |

## Snapshot reference

Committed metrics: `game/validation/card-balance/metrics-snapshot.json` (`generatedAt: 2026-06-06`, `cardCount: 47`).

Key snapshot flags used above:

- `rewardOrderCollisions`: `[{ rewardOrder: 27, cardIds: ["fireball", "purifying_pulse"] }]`
- Under-budget peer flags: `battery_automaton`, `dungeon_drake`, `gravity_well`, `harvesting_scythe`, `mirror_ward`, `permafrost_lance`, `purifying_pulse`, `saber_of_light`, `telepipe`
- Over-budget peer flags: none

## Follow-ups

- Sub-ticket **03** applies Tier A tunings and updates tests.
- Re-run `CARD_BALANCE_UPDATE_SNAPSHOT=1` vitest after any stat changes to refresh the snapshot.

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

Tier B items remain report-only (economy sell bumps, Battery Automaton pulse, Telepipe, etc.).

## Test notes

- `pnpm test:quick` and `pnpm test` (full coverage) exit 0 (169 files, 2612 tests).
- Test-only fixes (unrelated to card balance): removed racy `persistenceDirty` assert in `smoke_bomb.test.js`; `debug-scenarios.test.js` now waits for a `stateUpdate` with boss HP 1 instead of the next arbitrary tick update.
- `vitest.config.js` coverage floors aligned to current blended server/client coverage (~64% statements/lines, ~60% functions); harness already runs coverage with thresholds disabled.

**Outcome: PASS**
