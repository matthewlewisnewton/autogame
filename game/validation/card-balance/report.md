# Card balance report

Part 1 of the card-balance pass: **weapons** and **spells** only. Metrics sourced from `game/validation/card-balance/analyzeCards.mjs` (sub-ticket 01). No JSON or gameplay changes applied in this pass.

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

*(Sub-ticket 03 — pending.)*

## Enchantments

*(Sub-ticket 03 — pending.)*

## Economy

*(Sub-ticket 03 — pending.)*

## Degenerate combos

*(Sub-ticket 03 — pending.)*

## Executive summary

*(Sub-ticket 03 — pending.)*
