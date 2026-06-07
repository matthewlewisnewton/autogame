# Refresh balance report post-tuning

Sub-tickets 01–04 landed the metrics snapshot, initial report, Tier A tunings, and a green vitest suite, but `report.md` still reflects pre-tuning metrics. Rewrite the report so every per-card verdict, Outliers entry, Snapshot reference, and recommendation matches the committed `metrics-snapshot.json` produced after the applied tunings.

## Acceptance Criteria

- **`game/validation/card-balance/report.md`** header notes post-tuning refresh (date unchanged or bumped) and that Tier A tunings from sub-ticket 03 are reflected in the analysis, not pending.
- **Per-card table** (47 rows): each row's burst/utility summary, sell value, verdict, and recommended adjustment match the corresponding entry in `metrics-snapshot.json` and current shared JSON. Specifically:
  - `Deck Sifter` (`deck_sifter`) verdict is **`under`**, not `ok`.
  - `Cryo Burst` (`frost_nova`) verdict is **`under`**, not `ok`.
  - Tier A–tuned cards show post-tuning values and verdict **`ok`**: `Permafrost Lance`, `Saber of Light`, `Ether Scythe`, `Mirror Ward`, `Purifying Pulse`, `Fireball` (rewardOrder **29**).
  - `Vault Wyrm` (`dungeon_drake`) shows post-tuning burst **45** (attackDamage 3) and remains **`under`**.
- **Outliers → Under-budget** lists exactly the seven cards flagged `under-budget` in the snapshot: `battery_automaton`, `deck_sifter`, `dungeon_drake`, `frost_nova`, `gravity_well`, `mirror_ward`, `telepipe`. Does **not** list resolved cards: `permafrost_lance`, `purifying_pulse`, `saber_of_light`, `harvesting_scythe`.
- **Outliers → Mispriced** no longer cites a `fireball` / `purifying_pulse` reward-order collision; economy outliers (e.g. `bulkhead_mauler`, `null_crawler`, `storm_eagle` sell ratios) remain if still valid in snapshot sellValueRatio fields.
- **New & recently changed cards** subsection reassesses `fireball`, `dungeon_drake`, and `purifying_pulse` using post-tuning metrics (Fireball collision resolved; Purifying Pulse heal 22 now `ok`; Vault Wyrm still under at burst 45).
- **Recommendations → Tier A** is marked **applied** (or moved to Applied tunings appendix only) — no duplicate pending Tier A rows for already-landed changes.
- **Snapshot reference** section states `rewardOrderCollisions: []` and lists the current under-budget id set above; does not claim a collision at rewardOrder 27.
- No edits to `game/shared/card*.json`, no test file changes, no snapshot regeneration.

## Technical Specs

- **`game/validation/card-balance/report.md`** (edit only): re-derive all table rows and outlier bullets from **`game/validation/card-balance/metrics-snapshot.json`** (`generatedAt: 2026-06-06`, `cardCount: 47`, `rewardOrderCollisions: []`). Use card display names from **`game/shared/cardDefs.json`**; cross-check applied stat values in **`game/shared/cardStats.json`** and **`game/shared/cardDefs.json`** (e.g. `fireball.rewardOrder: 29`, `purifying_pulse.healAmount: 22`, `dungeon_drake.attackDamage: 3`).
- Key snapshot fields per row: `peerBandFlag`, `comparisonValue` / `estimatedBurstDamage` / `utilityScore`, `rewardOrder`, `sellValue`, `sellValueRatio`. Map `peerBandFlag: "under-budget"` → verdict `under`; `ok` → `ok`. Derive `mispriced` from sellValueRatio outliers (&lt; 1.3 or &gt; 12 on obtainable cards) per existing report methodology.
- Preserve existing report sections (Methodology, Degenerate combos, Tier B recommendations, Applied tunings appendix, Test notes) but update any prose that contradicts the final snapshot. Keep **Applied tunings** table from sub-ticket 03 intact.
- Read-only references: **`game/server/config.js`**, **`game/server/test/card_balance_metrics.test.js`** (confirms snapshot is source of truth; do not modify).

## Verification: code
