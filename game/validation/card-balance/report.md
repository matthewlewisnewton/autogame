# Card balance report

Card-balance pass parts 1–2: **weapons**, **spells**, **creatures**, **enchantments**, economy, combos, and consolidated recommendations. Metrics sourced from `game/validation/card-balance/analyzeCards.mjs` (sub-ticket 01) plus manual simulation notes (sub-ticket 03). No JSON or gameplay changes applied in this pass.

## Methodology

**Inputs.** `game/shared/cardDefs.json` (identity, type, charges, acquisition), `game/shared/cardStats.json` (combat stats), and `game/shared/cardEconomy.json` (sell values). The analyzer merges defs + stats the same way `progression.js` builds `CARD_DEFS`, with sell-value fallbacks when absent from economy.

**Primary metrics (from harness).**

| Field | Meaning |
| --- | --- |
| `damage` | Primary hit stat (`damage` field, or type proxy) |
| `effectiveBurst` | Primary damage + estimated DoT (`damagePerTick × dotTicks` or `trailDamagePerTick × dotTicks`) |
| `damagePerCharge` | `(effectiveBurst × (swingsPerUse ?? 1)) ÷ charges` |
| `damagePerMs` | `(effectiveBurst × (swingsPerUse ?? 1)) ÷ cooldownMs` (default cooldown 800 ms) |
| `utilityScore` | Heal amount, MS restore, shield HP, MS gain, or minion HP when no direct damage |

**Assumptions not captured by the harness** (documented here; spotlight cards rely on these):

- **Burn** (`fireball`, `flame_blade`): simulation applies `BURN_BASE_TICK_DAMAGE + BURN_EXTRA_FIRE_DAMAGE` (5) every 500 ms while `burningUntil` is active (`simulation.js`). Fireball ignites for 3000 ms → ~6 ticks ≈ **30 bonus damage** per hit, not in `effectiveBurst`.
- **Chain lightning** (`chain_lightning`): primary target takes full damage; up to `maxChainTargets` (2) nearby enemies take 50% each (`chain_lightning.test.js`). Max burst **44** (22 + 11 + 11) vs harness single-target **22**.
- **Slow / freeze / pull / heal / draw / portal**: utility not folded into `effectiveBurst`; judged qualitatively in verdict notes.
- **Shockwave weapons** (`echo_blade`, `resonance_edge`): periodic AoE burst omitted from harness totals.
- **Server overlay** (`SERVER_STAT_OVERLAY`): cone angles and attack intervals injected at runtime; noted per row where applicable.

**Peer bands.** Verdicts compare each card to same-type peers on `damagePerCharge` and `damagePerMs`:

- **Weapons** (13 damage-dealing rows): DPC Q1–Q3 ≈ 3.25–5.0; DPM Q1–Q3 ≈ 0.020–0.031.
- **Spells** (11 damage-dealing rows): DPC Q1–Q3 ≈ 11–42; DPM Q1–Q3 ≈ 0.014–0.053.
- **Utility-only** rows (0 damage, non-zero utility effect): verdict `ok` when role is clear; `dead` when the card has no combat or economy proxy in harness (e.g. pure draw).

**Verdict labels:** `ok` (within band or role-appropriate), `over`, `under`, `dead` (zero combat metric, niche/utility).

**Recommendation tags:** `apply-now` (small numeric tweak, low risk) or `operator-triage` (design rework, evolution intent, or harness gap).

Regenerate raw metrics: `node game/validation/card-balance/analyzeCards.mjs`

## Weapons

14 weapon cards; one row each. Efficiency column = `damagePerCharge` / `damagePerMs`.

| Name | id | charges | MS cost | burst | DPC | DPM | acquisition | verdict | recommendation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Rust-Forged Saber | iron_sword | 5 | 0 | 17 | 3.40 | 0.021 | starter | ok | — |
| Solar Edge | flame_blade | 3 | 0 | 28 | 9.33 | 0.035 | reward:0 | over | `operator-triage` — early reward outpaces evolved-band weapons; confirm intentional power spike |
| Alloy Greatblade | steel_claymore | 6 | 0 | 25 | 4.17 | 0.031 | evolved | ok | — |
| Corebreaker Greatsword | magma_greatsword | 4 | 0 | 86 | 21.50 | 0.108 | evolved | over | `operator-triage` — fire-trail DoT doubles effective burst; evolution target may be fine but dwarfs non-evolved lane |
| Saber of Light | saber_of_light | 6 | 0 | 9 | 1.50 | 0.023 | reward:3 | under | `apply-now` — raise base damage ~3 (to ~12) or reduce cooldown slightly; per-charge efficiency is bottom of band despite fast swing |
| Excalibur Photon | excalibur_photon | 6 | 0 | 14×2 | 4.67 | 0.140 | evolved | over | `operator-triage` — 200 ms cooldown + double swing dominates DPM; verify evolution rarity justifies |
| Photon Slicer | photon_slicer | 4 | 0 | 13 | 3.25 | 0.016 | reward:6 | ok | — |
| Infinite Disk | infinite_disk | 4 | 0 | 20 | 5.00 | 0.025 | evolved | ok | — |
| Arcane Bolt | arcane_bolt | 4 | 0 | 20 | 5.00 | 0.025 | reward:7 | ok | — |
| Fireball | fireball | 4 | 0 | 16 | 4.00 | 0.020 | reward:27 | ok | `apply-now` — +2 impact damage to align with arcane_bolt lane; burn/pierce already compensates (see spotlight) |
| Phase Echo | echo_blade | 5 | 0 | 15 | 3.00 | 0.019 | reward:15 | ok | `operator-triage` — shockwave every 3rd swing not in harness; qualitative bump likely |
| Resonance Edge | resonance_edge | 5 | 0 | 23 | 4.60 | 0.029 | evolved | ok | — |
| Ether Scythe | harvesting_scythe | 3 | 0 | 9 | 3.00 | 0.011 | reward:19 | under | `apply-now` — +3 base damage or +5 MS-on-hit; economy role but combat DPM is lowest weapon band |
| Deck Sifter | deck_sifter | 3 | 0 | 0 | 0 | 0 | reward:20 | dead | `operator-triage` — draw utility only; add non-damage utility scoring before numeric tuning |

### Weapon outlier notes

1. **magma_greatsword** — DPC 21.5 and DPM 0.108 sit far above Q3; fire-trail DoT (44 trail + 42 hit) makes it the clearest weapon outlier. **`operator-triage`**
2. **excalibur_photon** — DPM 0.14 is ~4.5× peer Q3 from 200 ms cooldown and `swingsPerUse: 2`; evolved rarity may justify. **`operator-triage`**
3. **saber_of_light** — DPC 1.5 is lowest in band; fast cooldown partially offsets but charge efficiency is weak vs iron_sword. **`apply-now`**
4. **flame_blade** — DPC 9.33 exceeds most evolved weapons despite being an early reward; competes with fireball/arcane_bolt unlock window. **`operator-triage`**
5. **harvesting_scythe** — Lowest weapon DPM; MS-on-hit/kill economy is the real value. **`apply-now`**

## Spells

20 spell cards; one row each. Burst = harness `effectiveBurst` (single-target unless noted).

| Name | id | charges | MS cost | burst | DPC | DPM | acquisition | verdict | recommendation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Signal Familiar | battle_familiar | 1 | 50 | 44 | 44.00 | 0.055 | reward:1 | over | `operator-triage` — high burst + summon body; early reward power budget |
| Astral Guardian | astral_guardian | 1 | 65 | 66 | 66.00 | 0.083 | evolved | over | `operator-triage` — top spell DPC/DPM; evolution + shield/minion stack |
| Cryo Burst | frost_nova | 1 | 35 | 11 | 11.00 | 0.014 | reward:4 | ok | — |
| Permafrost Lance | permafrost_lance | 1 | 30 | 8 | 8.00 | 0.010 | reward:5 | under | `apply-now` — +3 damage to match frost_nova lane or widen radius |
| Restoration Beacon | healing_font | 1 | 0 | 0 | — | — | reward:8 | ok | — (utility: +6 MS) |
| Sanctum Pulse | divine_grace | 1 | 0 | 0 | — | — | evolved | ok | — (utility: +10 MS) |
| Voltaic Chain | chain_lightning | 1 | 42 | 22 | 22.00 | 0.028 | reward:26 | ok | — (max 44 vs clusters; see spotlight) |
| Glacial Orb | ice_ball | 1 | 32 | 12 | 12.00 | 0.015 | reward:28 | ok | — |
| Glacier Rupture | glacier_collapse | 1 | 35 | 17 | 17.00 | 0.021 | evolved | ok | — |
| Purifying Pulse | purifying_pulse | 1 | 0 | 0 | — | — | reward:27 | ok | — (utility: 15 heal + cleanse; see spotlight) |
| Gravity Well | gravity_well | 1 | 45 | 0 | 0 | 0 | reward:14 | dead | `operator-triage` — pull-only; needs CC utility score |
| Event Horizon | event_horizon | 1 | 45 | 0 | 0 | 0 | evolved | dead | `operator-triage` — crush damage (33 center) not in harness primary field |
| Ether Siphon | mana_leach | 1 | 30 | 28 | 28.00 | 0.035 | reward:16 | ok | — |
| Soul Drain | soul_drain | 1 | 30 | 42 | 42.00 | 0.053 | evolved | over | `operator-triage` — top-tier single-target burst + MS leech; evolution target |
| Wyrmflare | dragons_breath | 1 | 40 | 9 | 9.00 | 0.011 | reward:17 | under | `apply-now` — +4 initial damage; DoT ticks exist in stats but lack per-tick field for harness |
| Thermal Column | inferno_pillar | 1 | 40 | 13 | 13.00 | 0.016 | evolved | ok | — |
| Mana Prism | mana_prism | 1 | 0 | 0 | 0 | 0 | reward:18 | dead | `operator-triage` — passive MS pulse; no combat metric |
| Offering Terminal | sacrificial_altar | 1 | 0 | 0 | — | — | reward:21 | ok | — (utility: +100 MS, charge restore) |
| Chrono Trigger | chrono_trigger | 1 | 0 | 0 | 0 | 0 | reward:23 | dead | `operator-triage` — adjacent charge restore; economy spell |
| Telepipe | telepipe | 1 | 0 | 0 | 0 | 0 | shop | dead | `operator-triage` — portal utility; shop price separate from combat band |

### Spell outlier notes

1. **astral_guardian** — DPC 66 / DPM 0.083 exceed all peers; 65 MS cost partially gates but burst is extreme. **`operator-triage`**
2. **soul_drain** — DPC 42 at Q3 ceiling with MS leech; evolved finisher. **`operator-triage`**
3. **permafrost_lance** — DPC 8 below Q1 (11); frost_nova outclasses for +5 MS. **`apply-now`**
4. **dragons_breath** — DPC 9 bottom of damage band; breath DoT undercounted in harness. **`apply-now`**
5. **battle_familiar** — DPC 44 on reward:1 competes with late-game evolved spells. **`operator-triage`**

## New/changed cards (294–302 spotlight)

Cards landed in tickets 294–302. Compared to same-type peers on damage, MS cost, charges, cooldown, and utility.

### fireball (297) — weapon

| Stat | Value | Peer context |
| --- | --- | --- |
| Impact damage | 16 | arcane_bolt 20, photon_slicer 13 |
| Charges / cooldown | 4 / 800 ms | Same charge pool as arcane_bolt |
| MS cost | 0 | Free to cast (weapon) |
| Utility | Pierce + burn (3000 ms) | arcane_bolt pierces only; ~30 bonus burn damage not in harness |

**Assessment.** Raw DPC (4.0) sits at weapon median; pierce-line and guaranteed burn on every hit add clear upside over arcane_bolt in multi-enemy lanes. Slightly **under** on paper vs arcane_bolt (5.0 DPC) but **ok** overall once burn is counted. Late reward (order 27) is appropriate.

**Recommendation:** `apply-now` — optional +2 impact if burn feels weak in playtests; otherwise leave numbers.

### ice_ball (294) — spell

| Stat | Value | Peer context |
| --- | --- | --- |
| Impact damage | 12 | frost_nova 11, permafrost_lance 8 |
| MS cost | 32 | frost_nova 35, permafrost_lance 30 |
| Charges / cooldown | 1 / 800 ms | Standard spell slot |
| Utility | 50% slow, 3 s, 0.5 factor | frost_nova: AoE freeze; permafrost: wider nova freeze |

**Assessment.** Best single-target damage in the frost lane for MS spent; trades AoE freeze for ranged projectile + probabilistic slow. DPC 12 is mid-band for spells. Slow is weaker than freeze but cheaper MS and safer at range (1200 ms travel).

**Recommendation:** `ok` — no numeric change unless slow proc rate feels bad; then `apply-now` raise `slowChance` to 0.65.

### chain_lightning (302) — spell

| Stat | Value | Peer context |
| --- | --- | --- |
| Primary damage | 22 | mana_leach 28 (single target) |
| Max cluster burst | 44 (22+11+11) | battle_familiar 44 (single + summon) |
| MS cost | 42 | mana_leach 30, frost_nova 35 |
| Chain | radius 5, max 2 | thunderbird minion chains similarly |
| Charges / cooldown | 1 / 800 ms | Standard spell |

**Assessment.** Harness undervalues cluster fights: at three targets, DPC-equivalent **44** matches battle_familiar at lower summon overhead. Single-target DPM (0.028) is mid-band. 42 MS is the highest among spotlight cards but fair for multi-hit potential.

**Recommendation:** `ok` — tune only if MS starvation blocks casts; then `apply-now` −5 MS cost.

### purifying_pulse (299) — spell

| Stat | Value | Peer context |
| --- | --- | --- |
| Heal | 15 HP | healing_font restores 6 MS (different resource) |
| MS cost | 0 | healing_font 0 MS |
| Radius | 5.5 | AoE ally heal + cleanse |
| Charges / cooldown | 1 / 800 ms | Same as healing_font |
| Utility | Clears burn, slow, freeze, debuffs | Unique among heals |

**Assessment.** Only zero-MS ally heal with full cleanse (`purifying_pulse.test.js`). `utilityScore` 15 is modest vs sacrificial_altar (100 MS) but combat-relevant in debuff-heavy content. No direct damage — correctly **ok** on utility verdict. Pairs with ice/fire enemy kits from same ticket batch.

**Recommendation:** `ok` — if underused, `apply-now` +5 heal or +1 m radius; cleanse value is the main draw.

## Creatures

10 creature cards; one row each. Harness `damage` uses `attackDamage` or `breathDamage`; breath/DoT and minion AI cadence are mostly **not** in harness totals (see assumptions). Overlay: `dungeon_drake` / `ancient_wyrm` receive `breathConeAngle` from `CARD_STAT_OVERLAY` in `progression.js`. Default spawn HP is **50** when `minionHp` is absent (`cardEffects.js`).

| Name | id | charges | MS cost | atk/breath | minion HP | TTL | acquisition | verdict | recommendation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Vault Wyrm | dungeon_drake | 1 | 0 | 2 | 50† | 30 | reward:2 | ok | — (see 298 spotlight) |
| Phase Stalker | null_crawler | 1 | 35 | 22 | 55 | 30 | reward:12 | over | `operator-triage` — 22 dmg beam every 2 s at range 14; confirm reward:12 intent |
| Bulkhead Mauler | bulkhead_mauler | 1 | 0 | 9 | 100 | 30 | reward:13 | ok | — (cone shockwave not in harness) |
| Aegis Sentinel | aegis_sentinel | 1 | 45 | 0 | 160 | 30 | reward:10 | ok | — (taunt + 30 shield HP) |
| Archive Wyrm | ancient_wyrm | 1 | 0 | 4 | 90 | 30 | evolved | ok | — (evolution target; no burn) |
| Necroframe Knight | skeleton_knight | 1 | 0 | 0 | 120 | 30‡ | reward:9 | ok | — (taunt wall) |
| Legion Marshal | undead_commander | 1 | 0 | 0 | 180 | 30‡ | evolved | ok | `operator-triage` — +2 skeletons (60 HP each) not in harness |
| Stormwing Drone | storm_eagle | 1 | 40 | 13 | 45 | 30 | reward:11 | over | `operator-triage` — ranged strike fires every sim tick in range (`simulation.js`); harness DPC understates |
| Thunderbird | thunderbird | 1 | 40 | 20 | 68 | 30 | evolved | ok | — (chain up to 2×20) |
| Battery Automaton | battery_automaton | 1 | 50 | 0 | 80 | 30 | reward:22 | ok | — (utility: +1 charge / 6 s pulse) |

† No `minionHp` in JSON — runtime default 50 at grind 0. ‡ No explicit `minionTtl` — runtime default 30 s.

**Peer bands (damage-dealing minions, harness DPC):** Q1–Q3 ≈ 4–13 (null_crawler and thunderbird sit above; wyrms below on paper).

### Vault Wyrm / `dungeon_drake` (ticket 298 rebalance)

Post-298 stats in `cardStats.json`: `attackDamage: 2` (mapped to `breathDamage` via `applyWyrmMinionBreathStats`), `burnDurationMs: 2000`, `specialEffect: burning_breath`, breath cone overlay `π/4` (`CARD_STAT_OVERLAY`).

| Stat | Vault Wyrm | Archive Wyrm (`ancient_wyrm`) | Peer context |
| --- | --- | --- | --- |
| `attackDamage` / breath tick | 2 / 500 ms | 4 / 500 ms | null_crawler 22 / 2000 ms; storm_eagle 13 (per tick in range) |
| Breath window | 2000 ms (4 ticks) | 2500 ms (5 ticks) | bulkhead_mauler 9 cone on contact |
| Breath interval | 2500 ms | 3000 ms | — |
| Range / hold | 6 / 3.5 | 10 / 5.5 | storm_eagle range 7 |
| Burn on breath | yes — `burnDurationMs` 2000, refresh per tick (`vault_wyrm_burning.test.js`) | no — pure fire breath (`ancient_wyrm.test.js`) | global burn tick 5 dmg / 500 ms (`BURN_BASE + BURN_EXTRA`) |
| Minion HP | 50 (default) | 90 | skeleton_knight 120 taunt |

**Breath DPS (single target in cone, grind 0).**

- **Direct breath:** 4 ticks × 2 = **8** per breath cycle (~2000 ms active).
- **Burn:** each breath tick applies/refreshes 2000 ms burn; while active, **5 DPS** (5 dmg / 500 ms). Overlap during a full breath adds ≈ **20** burn damage → **~28 total** per breath vs Archive Wyrm **20** direct (5 × 4) with no burn rider.
- **Sustained (breath + cooldown):** ~4500 ms cycle (2500 ms interval + 2000 ms breath) → **~6.2 combined DPS** vs Archive **~3.6 DPS** (5500 ms cycle). Vault trades evolution range (6 vs 10) and HP (50 vs 90) for burn attrition.
- **298 intent:** lower `attackDamage` (2) plus `burning_breath` shifts power from burst to DoT; harness `DPC 2` alone is misleading — **ok** at reward:2 when burn is counted. Archive Wyrm is the grind/evolution payoff (wider cone `π/3`, higher tick damage, +40 HP).

**Recommendation:** `ok` — no numeric change unless playtests show early reward still dominates; then `apply-now` `attackDamage` +1 **or** `burnDurationMs` +500 (not both).

### Creature outlier notes

1. **null_crawler** — Highest harness minion DPC (22); 35 MS cost is fair but power spikes vs reward:12 neighbors. **`operator-triage`**
2. **storm_eagle** — 13 dmg with no attack-interval gate in `simulation.js`; real DPS exceeds harness. **`operator-triage`**
3. **dungeon_drake** — Paper DPC 2; burn breath ~6 sustained DPS post-298. **`ok`**
4. **undead_commander** — 180 HP + skeleton spawn package; evolution finisher. **`operator-triage`**

## Enchantments

3 enchantment cards; one row each. Ground hazards use proximity trigger + TTL; `mirror_ward` is self-buff reflect.

| Name | id | charges | MS cost | burst / effect | DPC | TTL | acquisition | verdict | recommendation |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- | --- | --- |
| Spike Trap | spike_trap | 1 | 25 | 39 instant | 39 | 30 s | reward:24 | ok | — |
| Mirror Ward | mirror_ward | 1 | 30 | 50% reflect, min 17, range 11 | 17† | 20 s | reward:25 | ok | — |
| Cinder Snare | cinder_snare | 1 | 25 | 8×4 DoT + zone | 40 | 30 s | shop | ok | — |

† Harness proxy uses `minReflectDamage` (17); actual reflect scales at 50% incoming (`enchantment.test.js`).

**Vs spell peers at similar MS:** spike_trap (25 MS, 39 burst) ≈ frost_nova lane (35 MS, 11 + freeze); cinder_snare (25 MS, 40 total DoT) ≈ dragons_breath (40 MS, 9 + DoT undercounted). Mirror ward (30 MS) competes with mana_leach (30 MS, 28 dmg) on cost but is defensive — different role.

### Enchantment notes

1. **spike_trap** — Highest one-shot hazard; single enemy trigger then expires. **`ok`**
2. **cinder_snare** — Lingering zone + 32 DoT; shop-only pairs with pull combos. **`ok`**
3. **mirror_ward** — `reflectRange: 11` tested in `enchantment.test.js`; strong vs swarms if player can tank. **`ok`**

## Economy & acquisition

**Sell values (`cardEconomy.json` → `cardSellValues`).** 30 cards have explicit sell values; **17 rely on harness fallbacks** (5 weapon / 12 spell / 10 creature / 5 enchantment defaults):

| id | fallback sell | note |
| --- | ---: | --- |
| photon_slicer, echo_blade | 5 | reward weapons |
| frost_nova, permafrost_lance, healing_font, purifying_pulse, chain_lightning, gravity_well | 12 | reward spells |
| glacier_collapse, resonance_edge | 15 | evolved |
| skeleton_knight, storm_eagle | 10 | reward creatures |
| spike_trap, mirror_ward, cinder_snare | 5 | enchantments use default 5 |

**Flags:** `purifying_pulse` and `fireball` share **rewardOrder 27** — duplicate slot may skew `buildCardChoices` ordering. Shop cards (`telepipe`, `cinder_snare`) correctly omit `rewardOrder`. Evolved-only cards (no `acquisition: reward`) correctly omit reward order.

**Evolution paths (`evolutionTransforms`).** 14 base → evolved pairs; all evolved ids in defs have a transform source except shop/starter-only cards. Notable: `dungeon_drake` → `ancient_wyrm` (+10 grind, `ancient_wyrm.test.js`).

**Acquisition vs power outliers:** early rewards with high metrics — `flame_blade` (0), `battle_familiar` (1), `dungeon_drake` (2) — vs late rewards `chain_lightning` / `fireball` (27–28). Economy sell values partially compensate (e.g. battle_familiar 12 vs dungeon_drake 10) but do not fully offset combat outliers.

## Degenerate combos

Plausible multi-card loops from `cardEffects.js`, `simulation.js`, and integration tests. Severity = ladder impact if stacked in a 4-card hand; **data-only fix** = adjustable via `cardStats.json` / `cardEconomy.json` without code changes.

| Combo | Cards | Severity | Data-only fix? | Notes |
| --- | --- | --- | --- | --- |
| Sacrifice MS engine | `sacrificial_altar` + any summon (`dungeon_drake`, `battery_automaton`, `skeleton_knight`) + MS spender (`battle_familiar`, `null_crawler`) | **high** | Partial — reduce `magicStoneGain` (100) or `chargeRestore` (2) on altar; raise summon MS costs | `integration.test.js`: altar consumes oldest minion for max MS + 2 weapon charges |
| Battery + altar loop | `battery_automaton` + `sacrificial_altar` + `chrono_trigger` | **medium** | Partial — tune `chargePulseIntervalMs` (6000) or altar `chargeRestore` | Battery pulses +1 charge / 6 s; altar refills adjacent weapons; chrono restores ±2 adjacent |
| Pull into hazard | `gravity_well` / `event_horizon` + `spike_trap` / `cinder_snare` | **medium** | Yes — reduce hazard `damage` / `damagePerTick` or widen MS gap vs pull cost | Enemies pulled into ground enchantments (`new_card_pack.test.js` pull radii 12) |
| MS grind + spender | `harvesting_scythe` + `mana_prism` + `sacrificial_altar` + burst spell | **medium** | Partial — lower `magicStoneOnKill` (15) or prism `magicStonePulse` (10) | Scythe grants 5/15 MS on hit/kill; prism passively feeds spells |
| Cleanse attrition counter | `purifying_pulse` + `dungeon_drake` / fire enemies | **low** | Yes — reduce `healAmount` (15) if TTK too long | Zero-MS heal + cleanse vs burn/slow content (`purifying_pulse.test.js`) |
| Chrono weapon refresh | `chrono_trigger` + high-charge weapons (`iron_sword`, `flame_blade`) | **low** | Yes — lower `adjacentChargeRestore` (2) | `integration.test.js`: both neighbors +2 charges |

## Executive summary

- **47 cards** catalogued once across weapons (14), spells (20), creatures (10), and enchantments (3). Harness metrics flag **over** outliers on early rewards (`flame_blade`, `battle_familiar`) and evolved finishers (`magma_greatsword`, `excalibur_photon`, `astral_guardian`, `soul_drain`); **under** on `saber_of_light`, `permafrost_lance`, `dragons_breath`, `harvesting_scythe`.
- **Vault Wyrm (298):** rebalance to `attackDamage: 2` + `burning_breath` is **ok** — combined breath + burn DPS (~6) beats Archive Wyrm sustained direct (~3.6) but on a fragile 50 HP body at reward:2; evolution to Archive Wyrm remains the range/DPS upgrade path.
- **Creatures:** `null_crawler` and `storm_eagle` are the main combat outliers (harness and simulation cadence respectively). Tank/summon roles (`skeleton_knight`, `aegis_sentinel`, `undead_commander`, `battery_automaton`) read **ok** on utility.
- **Enchantments:** hazard DPS is in-band for MS cost; no mandatory tuning.
- **Economy:** 17 cards use fallback sell values; duplicate `rewardOrder: 27` on `fireball` / `purifying_pulse` should be deduped in a future data pass.
- **Combos:** altar-centric MS/charge engines are the highest-risk degenerate line; pull+hazard and chrono refresh are moderate but mostly data-tunable.
- **Sub-ticket 04 scope:** **8 `apply-now`** numeric tweaks (small stat bumps/reductions); **18 `operator-triage`** items (design intent, harness gaps, or utility scoring).

## Recommendations

Consolidated from all type tables. **No JSON applied in this sub-ticket** — field names refer to `game/shared/cardStats.json` unless noted (`cardDefs.json` for `rewardOrder`, `cardEconomy.json` for sell values).

### apply-now (small numeric tweaks)

| id | field(s) | change |
| --- | --- | --- |
| saber_of_light | `damage` | +3 (9 → 12) **or** `cooldownMs` 400 → 350 |
| fireball | `damage` | +2 (16 → 18) |
| harvesting_scythe | `damage` **or** `magicStoneOnHit` | +3 damage **or** +5 MS on hit |
| permafrost_lance | `damage` | +3 (8 → 11) |
| dragons_breath | `damage` | +4 (9 → 13) |
| ice_ball | `slowChance` | 0.5 → 0.65 (only if slow feels weak in playtests) |
| purifying_pulse | `healAmount` **or** `radius` | +5 heal **or** +1 m radius (only if underused) |
| chain_lightning | `magicStoneCost` | −5 (42 → 37; only if MS starvation blocks casts) |

Optional creature tweak (playtest-gated): `dungeon_drake` — `attackDamage` +1 **or** `burnDurationMs` +500, not both.

### operator-triage (design / harness / economy)

| id | field(s) / topic | reason |
| --- | --- | --- |
| flame_blade | `damage`, `rewardOrder` | early reward DPC exceeds evolved weapons |
| magma_greatsword | `damage`, `trailDamagePerTick`, `dotTicks` | fire-trail doubles effective burst |
| excalibur_photon | `cooldownMs`, `swingsPerUse` | DPM ~4.5× peer Q3 |
| deck_sifter | utility scoring | draw-only; no combat metric |
| battle_familiar | `damage`, `minionHp` | reward:1 burst + body |
| astral_guardian | `damage`, `magicStoneCost`, `minionHp` | top spell DPC/DPM |
| soul_drain | `damage`, `magicStoneOnHit` | evolved finisher burst |
| gravity_well | CC utility score | pull-only |
| event_horizon | `centerDamage` in harness | crush damage not in primary field |
| mana_prism | passive MS model | no combat metric |
| sacrificial_altar | `magicStoneGain`, combo balance | 100 MS + charge restore enables engines |
| chrono_trigger | `adjacentChargeRestore` | charge loop enabler |
| telepipe | shop pricing | portal utility |
| echo_blade | `shockwaveDamage`, `shockwaveEvery` | periodic AoE omitted from harness |
| null_crawler | `attackDamage`, `rewardOrder` | 22 dmg beam at reward:12 |
| storm_eagle | attack cadence in code | per-tick ranged hits |
| undead_commander | `summonSkeletonCount`, `summonSkeletonHp` | skeleton package not in harness |
| fireball + purifying_pulse | `rewardOrder` in `cardDefs.json` | duplicate order 27 |
| missing sell values | `cardSellValues` in `cardEconomy.json` | 17 cards on fallbacks (see Economy section) |
