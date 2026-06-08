# Card balance report

Card-balance pass parts 1–2: **weapons**, **spells**, **creatures**, **enchantments**, economy, combos, and consolidated recommendations. Metrics sourced from `game/validation/card-balance/analyzeCards.mjs` (sub-ticket 01) plus manual simulation notes (sub-ticket 03). Ticket 303 sub-ticket 04 applied five `apply-now` tunings in `cardStats.json`; ticket 311 sub-ticket 04 reconciles this report to post-311 live stats (grind-scale map + Astral Guardian trim); ticket **308** sub-ticket 04 reconciles heavy-hitter wind-up + charge pass for `flame_blade`, `magma_greatsword`, and `soul_drain` (report-only; data applied in ticket 308 sub-tickets 01–03).

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

- **Weapons** (13 damage-dealing rows): DPC Q1–Q3 ≈ 3.4–5.0; DPM Q1–Q3 ≈ 0.021–0.031.
- **Spells** (11 damage-dealing rows): DPC Q1–Q3 ≈ 11–35; DPM Q1–Q3 ≈ 0.014–0.044.
- **Utility-only** rows (0 damage, non-zero utility effect): verdict `ok` when role is clear; `dead` when the card has no combat or economy proxy in harness (e.g. pure draw).

**Verdict labels:** `ok` (within band or role-appropriate), `over`, `under`, `dead` (zero combat metric, niche/utility).

**Recommendation tags:** `apply-now` (small numeric tweak, low risk) or `operator-triage` (design rework, evolution intent, or harness gap).

Regenerate raw metrics: `node game/validation/card-balance/analyzeCards.mjs`

## Weapons

14 weapon cards; one row each. Efficiency column = `damagePerCharge` / `damagePerMs`.

| Name | id | charges | MS cost | burst | DPC | DPM | acquisition | verdict | recommendation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Rust-Forged Saber | iron_sword | 5 | 0 | 17 | 3.40 | 0.021 | starter | ok | — |
| Solar Edge | flame_blade | 2 | 0 | 28 | 14.00 | 0.019 | reward:0 | ok | **done** (ticket 308) — `windUpMs` 650 ms + charges 3→2; burst 28 unchanged; DPM folds into 1450 ms cycle |
| Alloy Greatblade | steel_claymore | 6 | 0 | 25 | 4.17 | 0.031 | evolved | ok | — |
| Corebreaker Greatsword | magma_greatsword | 2 | 0 | 86 | 43.00 | 0.054 | evolved | over | **done** (ticket 308) — charges 4→2; `windUpMs` 800 ms (307) folds into 1600 ms cycle; fire-trail burst unchanged |
| Saber of Light | saber_of_light | 6 | 0 | 12 | 2.00 | 0.030 | reward:3 | under | **done** (sub-ticket 04) — DPC still below Q1 despite 12 base; 400 ms cooldown keeps DPM in band |
| Excalibur Photon | excalibur_photon | 6 | 0 | 14×2 | 4.67 | 0.035 | evolved | ok | **done** (sub-ticket 02–03) — `windUpMs` 600 ms folds into cycle; per-hit 14×2 burst unchanged |
| Photon Slicer | photon_slicer | 4 | 0 | 13 | 3.25 | 0.016 | reward:6 | ok | — |
| Infinite Disk | infinite_disk | 4 | 0 | 20 | 5.00 | 0.025 | evolved | ok | — |
| Arcane Bolt | arcane_bolt | 4 | 0 | 20 | 5.00 | 0.025 | reward:7 | ok | — |
| Fireball | fireball | 4 | 0 | 18 | 4.50 | 0.023 | reward:27 | ok | **done** (sub-ticket 04) — impact 18 aligns with arcane_bolt lane; burn/pierce unchanged (see spotlight) |
| Phase Echo | echo_blade | 5 | 0 | 15 | 3.00 | 0.019 | reward:15 | ok | `operator-triage` — shockwave every 3rd swing not in harness; qualitative bump likely |
| Resonance Edge | resonance_edge | 5 | 0 | 23 | 4.60 | 0.029 | evolved | ok | — |
| Ether Scythe | harvesting_scythe | 3 | 0 | 12 | 4.00 | 0.015 | reward:19 | under | **done** (sub-ticket 04) — DPC in band but DPM still lowest weapon band; MS-on-hit/kill economy unchanged |
| Deck Sifter | deck_sifter | 3 | 0 | 0 | 0 | 0 | reward:20 | dead | `operator-triage` — draw utility only; add non-damage utility scoring before numeric tuning |

### Weapon outlier notes

1. **magma_greatsword** — **done** (ticket 308): charges 4→2 and 800 ms wind-up (307) yield harness DPC 43 / DPM 0.054 on a 1600 ms cycle; fire-trail DoT still drives high per-charge burst but sustained DPM is halved vs pre-tune 0.108.
2. **excalibur_photon** — **done** (sub-ticket 02–03): `windUpMs` 600 ms corrects harness DPM from 0.14 (cooldown-only) to 0.035 on an 800 ms effective cycle; double 14-damage swings unchanged.
3. **saber_of_light** — Post-tuning DPC 2.0 remains lowest in band (6 charges); 400 ms cooldown yields DPM 0.030 in band. Further bump needs charge-pool or cooldown pass. **`operator-triage`**
4. **flame_blade** — **done** (ticket 308): 650 ms wind-up + charges 3→2; harness DPC 14 / DPM 0.019 (1450 ms cycle). Early-reward burst 28 unchanged; commitment and smaller charge pool replace raw DPM spike.
5. **harvesting_scythe** — Post-tuning DPM 0.015 is still lowest weapon band; MS-on-hit/kill economy is the real value. **`operator-triage`**

## Spells

20 spell cards; one row each. Burst = harness `effectiveBurst` (single-target unless noted).

| Name | id | charges | MS cost | burst | DPC | DPM | acquisition | verdict | recommendation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Signal Familiar | battle_familiar | 1 | 50 | 44 | 44.00 | 0.055 | reward:1 | over | **addressed in 311** — grind-0 harness row unchanged; `CARD_GRIND_STAT_SCALE` 0.03 (vs global 0.05) slows late damage/minion growth; early reward intent preserved |
| Astral Guardian | astral_guardian | 1 | 65 | 63 | 63.00 | 0.079 | evolved | over | **addressed in 311** — `damage` 66→63, `shieldHp` 15→14; still top evolved finisher, DPC/DPM reduced vs pre-311 |
| Cryo Burst | frost_nova | 1 | 35 | 11 | 11.00 | 0.014 | reward:4 | ok | — |
| Permafrost Lance | permafrost_lance | 1 | 30 | 11 | 11.00 | 0.014 | reward:5 | ok | **done** (sub-ticket 04) — matches frost_nova DPC/DPM lane |
| Restoration Beacon | healing_font | 1 | 0 | 0 | — | — | reward:8 | ok | — (utility: +6 MS) |
| Sanctum Pulse | divine_grace | 1 | 0 | 0 | — | — | evolved | ok | — (utility: +10 MS) |
| Voltaic Chain | chain_lightning | 1 | 37 | 22 | 22.00 | 0.028 | reward:26 | ok | — (max 44 vs clusters; see spotlight) |
| Glacial Orb | ice_ball | 1 | 32 | 12 | 12.00 | 0.015 | reward:28 | ok | — |
| Glacier Rupture | glacier_collapse | 1 | 35 | 17 | 17.00 | 0.021 | evolved | ok | — |
| Purifying Pulse | purifying_pulse | 1 | 0 | 0 | — | — | reward:27 | ok | — (utility: 20 heal + cleanse; see spotlight) |
| Gravity Well | gravity_well | 1 | 45 | 0 | 0 | 0 | reward:14 | dead | `operator-triage` — pull-only; needs CC utility score |
| Event Horizon | event_horizon | 1 | 45 | 0 | 0 | 0 | evolved | dead | `operator-triage` — crush damage (33 center) not in harness primary field |
| Ether Siphon | mana_leach | 1 | 30 | 28 | 28.00 | 0.035 | reward:16 | ok | — |
| Soul Drain | soul_drain | 1 | 30 | 42 | 42.00 | 0.028 | evolved | ok | **done** (ticket 308) — `windUpMs` 700 ms folds into 1500 ms cycle; burst 42 + MS leech unchanged |
| Wyrmflare | dragons_breath | 1 | 40 | 13 | 13.00 | 0.016 | reward:17 | ok | **done** (sub-ticket 04) — initial burst in band; DoT ticks exist in stats but lack per-tick field for harness |
| Thermal Column | inferno_pillar | 1 | 40 | 13 | 13.00 | 0.016 | evolved | ok | — |
| Mana Prism | mana_prism | 1 | 0 | 0 | 0 | 0 | reward:18 | dead | `operator-triage` — passive MS pulse; no combat metric |
| Offering Terminal | sacrificial_altar | 1 | 0 | 0 | — | — | reward:21 | ok | — (utility: +100 MS, charge restore) |
| Chrono Trigger | chrono_trigger | 1 | 0 | 0 | 0 | 0 | reward:23 | dead | `operator-triage` — adjacent charge restore; economy spell |
| Telepipe | telepipe | 1 | 0 | 0 | 0 | 0 | shop | dead | `operator-triage` — portal utility; shop price separate from combat band |

### Spell outlier notes

1. **astral_guardian** — Post-311 DPC 63 / DPM 0.079 still above peers but trimmed from 66 / 0.083; shield 14 HP. **`addressed in 311`**
2. **soul_drain** — **done** (ticket 308): 700 ms wind-up commitment; harness DPM 0.028 (was 0.053 cooldown-only); DPC 42 and MS leech unchanged — evolved finisher with telegraphed cast.
3. **battle_familiar** — Harness grind-0 DPC 44 on reward:1; late scaling capped via per-card grind scale 0.03. **`addressed in 311`**

## New/changed cards (294–302 spotlight)

Cards landed in tickets 294–302. Compared to same-type peers on damage, MS cost, charges, cooldown, and utility.

### fireball (297) — weapon

| Stat | Value | Peer context |
| --- | --- | --- |
| Impact damage | 18 | arcane_bolt 20, photon_slicer 13 |
| Charges / cooldown | 4 / 800 ms | Same charge pool as arcane_bolt |
| MS cost | 0 | Free to cast (weapon) |
| Utility | Pierce + burn (3000 ms) | arcane_bolt pierces only; ~30 bonus burn damage not in harness |

**Assessment.** Raw DPC (4.5) sits mid-band; pierce-line and guaranteed burn on every hit add clear upside over arcane_bolt in multi-enemy lanes. Post-tuning impact (18) closes the gap vs arcane_bolt (5.0 DPC) while burn remains extra upside. Late reward (order 27) is appropriate.

**Recommendation:** **done** (sub-ticket 04) — +2 impact applied (16 → 18); burn/pierce unchanged.

### ice_ball (294) — spell

| Stat | Value | Peer context |
| --- | --- | --- |
| Impact damage | 12 | frost_nova 11, permafrost_lance 11 |
| MS cost | 32 | frost_nova 35, permafrost_lance 30 |
| Charges / cooldown | 1 / 800 ms | Standard spell slot |
| Utility | 65% slow, 3 s, 0.5 factor | frost_nova: AoE freeze; permafrost: wider nova freeze |

**Assessment.** Best single-target damage in the frost lane for MS spent; trades AoE freeze for ranged projectile + probabilistic slow. DPC 12 is mid-band for spells. Slow is weaker than freeze but cheaper MS and safer at range (1200 ms travel).

**Recommendation:** **done** (ticket 310) — `slowChance` raised 0.5 → 0.65 for a more reliable slow proc; damage/cost unchanged.

### chain_lightning (302) — spell

| Stat | Value | Peer context |
| --- | --- | --- |
| Primary damage | 22 | mana_leach 28 (single target) |
| Max cluster burst | 44 (22+11+11) | battle_familiar 44 (single + summon) |
| MS cost | 37 | mana_leach 30, frost_nova 35 |
| Chain | radius 5, max 2 | thunderbird minion chains similarly |
| Charges / cooldown | 1 / 800 ms | Standard spell |

**Assessment.** Harness undervalues cluster fights: at three targets, DPC-equivalent **44** matches battle_familiar at lower summon overhead. Single-target DPM (0.028) is mid-band. Post-tune 37 MS keeps it slightly above the mid-spell band while easing back-to-back casts.

**Recommendation:** **done** (ticket 310) — `magicStoneCost` lowered 42 → 37 to ease MS starvation; damage/chain unchanged.

### purifying_pulse (299) — spell

| Stat | Value | Peer context |
| --- | --- | --- |
| Heal | 20 HP | healing_font restores 6 MS (different resource) |
| MS cost | 0 | healing_font 0 MS |
| Radius | 5.5 | AoE ally heal + cleanse |
| Charges / cooldown | 1 / 800 ms | Same as healing_font |
| Utility | Clears burn, slow, freeze, debuffs | Unique among heals |

**Assessment.** Only zero-MS ally heal with full cleanse (`purifying_pulse.test.js`). `utilityScore` 20 is modest vs sacrificial_altar (100 MS) but combat-relevant in debuff-heavy content. No direct damage — correctly **ok** on utility verdict. Pairs with ice/fire enemy kits from same ticket batch.

**Recommendation:** **done** (ticket 310) — `healAmount` raised 15 → 20; cleanse remains the main draw, radius/0 MS unchanged.

## Creatures

10 creature cards; one row each. Harness `damage` uses `attackDamage` or `breathDamage`; breath/DoT and minion AI cadence are mostly **not** in harness totals (see assumptions). Overlay: `dungeon_drake` / `ancient_wyrm` receive `breathConeAngle` from `CARD_STAT_OVERLAY` in `progression.js`. Default spawn HP is **50** when `minionHp` is absent (`cardEffects.js`).

| Name | id | charges | MS cost | atk/breath | minion HP | TTL | acquisition | verdict | recommendation |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| Vault Wyrm | dungeon_drake | 1 | 0 | 2 | 50† | 30 | reward:2 | ok | — (see 298 spotlight) |
| Phase Stalker | null_crawler | 1 | 35 | 22 | 55 | 30 | reward:12 | over | **addressed in 311** — grind-0 harness row unchanged (22 dmg / 55 HP); `CARD_GRIND_STAT_SCALE` 0.03 slows high-grind beam/minion growth |
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

1. **null_crawler** — Grind-0 harness DPC still highest (22); per-card scale 0.03 tapers reward:12 power at high grind. **`addressed in 311`**
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

**Vs spell peers at similar MS:** spike_trap (25 MS, 39 burst) ≈ frost_nova lane (35 MS, 11 + freeze); cinder_snare (25 MS, 40 total DoT) ≈ dragons_breath (40 MS, 13 + DoT undercounted). Mirror ward (30 MS) competes with mana_leach (30 MS, 28 dmg) on cost but is defensive — different role.

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
| Cleanse attrition counter | `purifying_pulse` + `dungeon_drake` / fire enemies | **low** | Yes — reduce `healAmount` (20) if TTK too long | Zero-MS heal + cleanse vs burn/slow content (`purifying_pulse.test.js`) |
| Chrono weapon refresh | `chrono_trigger` + high-charge weapons (`iron_sword`, `flame_blade`) | **low** | Yes — lower `adjacentChargeRestore` (2) | `integration.test.js`: both neighbors +2 charges |

## Executive summary

- **47 cards** catalogued once across weapons (14), spells (20), creatures (10), and enchantments (3). Harness metrics flag **over** outliers on early rewards (`battle_familiar` grind-0 row) and evolved finishers (`magma_greatsword` DPC, `astral_guardian`); **under** on `saber_of_light` and `harvesting_scythe` only (post-tuning `fireball`, `permafrost_lance`, `dragons_breath`, `excalibur_photon`, `flame_blade`, and `soul_drain` now **ok**). **Ticket 308:** `flame_blade`, `magma_greatsword`, and `soul_drain` received wind-up commitment + charge-pool tuning (alongside ticket **312** `excalibur_photon` wind-up). **Ticket 311:** `battle_familiar` and `null_crawler` keep strong grind-0 bases but scale at 0.03 per grind (vs global 0.05); `astral_guardian` trimmed to damage 63 / shield 14 (harness DPC 63, DPM 0.079).
- **Vault Wyrm (298):** rebalance to `attackDamage: 2` + `burning_breath` is **ok** — combined breath + burn DPS (~6) beats Archive Wyrm sustained direct (~3.6) but on a fragile 50 HP body at reward:2; evolution to Archive Wyrm remains the range/DPS upgrade path.
- **Creatures:** `null_crawler` grind-0 harness row still **over** but **addressed in 311** via slower per-grind scaling; `storm_eagle` remains **`operator-triage`** (simulation cadence). Tank/summon roles (`skeleton_knight`, `aegis_sentinel`, `undead_commander`, `battery_automaton`) read **ok** on utility.
- **Enchantments:** hazard DPS is in-band for MS cost; no mandatory tuning.
- **Economy:** 17 cards use fallback sell values; duplicate `rewardOrder: 27` on `fireball` / `purifying_pulse` should be deduped in a future data pass.
- **Combos:** altar-centric MS/charge engines are the highest-risk degenerate line; pull+hazard and chrono refresh are moderate but mostly data-tunable.
- **Ticket 303 sub-ticket 04 scope:** **5 `apply-now` tunings applied** in `cardStats.json`; the **3 optional `apply-now`** items (ice_ball, purifying_pulse, chain_lightning) are now **applied in ticket 310** (see `## Applied tunings`). **Ticket 311 sub-ticket 04:** reconciled harness rows and triage notes for `battle_familiar`, `null_crawler`, and `astral_guardian`. **Ticket 312 sub-tickets 02–03:** **`excalibur_photon` wind-up DPM** addressed via `windUpMs` and report reconciliation. **Ticket 308 sub-ticket 04:** reconciled `flame_blade`, `magma_greatsword`, and `soul_drain` wind-up/charge pass (data in sub-tickets 01–03). **12 `operator-triage`** items remain in backlog.

## Recommendations

Consolidated from all type tables. Five **apply-now** items were applied in sub-ticket 04 (see `## Applied tunings`); remaining rows are optional or triage backlog.

### apply-now (small numeric tweaks)

| id | field(s) | change | status |
| --- | --- | --- | --- |
| saber_of_light | `damage` | +3 (9 → 12) | **done** — see Applied tunings |
| fireball | `damage` | +2 (16 → 18) | **done** — see Applied tunings |
| harvesting_scythe | `damage` | +3 (9 → 12) | **done** — see Applied tunings |
| permafrost_lance | `damage` | +3 (8 → 11) | **done** — see Applied tunings |
| dragons_breath | `damage` | +4 (9 → 13) | **done** — see Applied tunings |
| ice_ball | `slowChance` | 0.5 → 0.65 | **done** — see Applied tunings |
| purifying_pulse | `healAmount` | +5 (15 → 20) | **done** — see Applied tunings |
| chain_lightning | `magicStoneCost` | −5 (42 → 37) | **done** — see Applied tunings |

Optional creature tweak (playtest-gated): `dungeon_drake` — `attackDamage` +1 **or** `burnDurationMs` +500, not both.

### operator-triage (design / harness / economy)

| id | field(s) / topic | reason |
| --- | --- | --- |
| ~~flame_blade~~ | `windUpMs`, `charges` | **done (ticket 308)** — 650 ms wind-up, charges 3→2; see Applied tunings |
| ~~magma_greatsword~~ | `charges`, `windUpMs` | **done (ticket 308)** — charges 4→2; 800 ms wind-up (307); see Applied tunings |
| deck_sifter | utility scoring | draw-only; no combat metric |
| battle_familiar | `damage`, `minionHp` | **addressed in 311** — per-card `CARD_GRIND_STAT_SCALE` 0.03; base `cardStats` unchanged |
| astral_guardian | `damage`, `magicStoneCost`, `minionHp` | **addressed in 311** — `damage` 66→63, `shieldHp` 15→14; harness DPC 63 |
| ~~soul_drain~~ | `windUpMs` | **done (ticket 308)** — 700 ms wind-up; burst/MS leech unchanged; see Applied tunings |
| gravity_well | CC utility score | pull-only |
| event_horizon | `centerDamage` in harness | crush damage not in primary field |
| mana_prism | passive MS model | no combat metric |
| sacrificial_altar | `magicStoneGain`, combo balance | 100 MS + charge restore enables engines |
| chrono_trigger | `adjacentChargeRestore` | charge loop enabler |
| telepipe | shop pricing | portal utility |
| echo_blade | `shockwaveDamage`, `shockwaveEvery` | periodic AoE omitted from harness |
| null_crawler | `attackDamage`, `rewardOrder` | **addressed in 311** — per-card `CARD_GRIND_STAT_SCALE` 0.03; grind-0 base 22 dmg / 55 HP unchanged |
| storm_eagle | attack cadence in code | per-tick ranged hits |
| undead_commander | `summonSkeletonCount`, `summonSkeletonHp` | skeleton package not in harness |
| fireball + purifying_pulse | `rewardOrder` in `cardDefs.json` | duplicate order 27 |
| missing sell values | `cardSellValues` in `cardEconomy.json` | 17 cards on fallbacks (see Economy section) |

## Applied tunings

Combat stat changes in `game/shared/cardStats.json` (ticket 303 sub-ticket 04). Sub-ticket 02 added `excalibur_photon` `windUpMs` (ticket 312; documented below). Per-card grind scaling and Astral Guardian trim (ticket 311 sub-tickets 01–03) documented below. Ticket **308** heavy-hitter wind-up + charge pass documented below. Remaining **`operator-triage`** backlog excludes `excalibur_photon`, the three cards marked **addressed in 311**, and `flame_blade` / `magma_greatsword` / `soul_drain`.

| id | field | before → after | notes |
| --- | --- | --- | --- |
| saber_of_light | `damage` | 9 → 12 | per-charge efficiency bump |
| excalibur_photon | `windUpMs` | none → 600 ms | DPM 0.14 (200 ms cooldown-only) → 0.035 (800 ms effective cycle); per-hit 14×2 burst unchanged (sub-ticket 02 data, sub-ticket 03 behavior test) |
| fireball | `damage` | 16 → 18 | align impact with arcane_bolt lane; burn/pierce unchanged |
| harvesting_scythe | `damage` | 9 → 12 | combat DPM lift; MS-on-hit economy unchanged |
| permafrost_lance | `damage` | 8 → 11 | match frost_nova lane |
| dragons_breath | `damage` | 9 → 13 | initial burst bump; DoT ticks unchanged |
| ice_ball | `slowChance` | 0.5 → 0.65 | ticket 310 — stronger slow proc; damage/cost unchanged |
| purifying_pulse | `healAmount` | 15 → 20 | ticket 310 — more heal; cleanse/radius/0 MS unchanged |
| chain_lightning | `magicStoneCost` | 42 → 37 | ticket 310 — cheaper cast; damage/chain unchanged |
| flame_blade | `windUpMs` | none → 650 ms | ticket 308 — DPM 0.035 (cooldown-only) → 0.019 (1450 ms effective cycle); burst 28 unchanged |
| flame_blade | `charges` | 3 → 2 | ticket 308 — smaller charge pool pairs with wind-up commitment; harness DPC 9.33 → 14 |
| magma_greatsword | `charges` | 4 → 2 | ticket 308 — DPM 0.108 → 0.054 (1600 ms cycle with `windUpMs` 800 ms from 307); harness DPC 21.5 → 43; fire-trail burst unchanged |
| soul_drain | `windUpMs` | none → 700 ms | ticket 308 — DPM 0.053 → 0.028 (1500 ms effective cycle); DPC 42 and MS leech unchanged |

### Ticket 311 tunings

| id | change | notes |
| --- | --- | --- |
| battle_familiar | `CARD_GRIND_STAT_SCALE` **0.03** (global `GRIND_STAT_SCALE` 0.05) | base `cardStats` unchanged (`damage` 44, `magicStoneCost` 50); harness grind-0 row unchanged; late damage/minion HP grow slower per grind |
| null_crawler | `CARD_GRIND_STAT_SCALE` **0.03** | base `cardStats` unchanged (`attackDamage` 22, `minionHp` 55); harness grind-0 row unchanged; high-grind beam/minion stats taper vs default curve |
| astral_guardian | `damage` 66 → **63**, `shieldHp` 15 → **14** | direct base-stat trim in `cardStats.json`; `magicStoneCost` 65 and evolution identity unchanged; harness DPC 63 / DPM 0.079 / `utilityScore` 14 (shield) |

**Deferred — no safe change identified**

| id | recommendation | reason |
| --- | --- | --- |
| dungeon_drake | `attackDamage` +1 or `burnDurationMs` +500 | optional playtest-gated tweak; post-298 burn breath already `ok` |
