# Full roster balance report

Write the committed balance analysis report at `game/validation/card-balance/report.md`, covering the entire card roster using the metrics from sub-ticket 01. Identify outliers, degenerate combos, and split recommendations into safe data-only tunings vs operator triage items.

## Acceptance Criteria

- `game/validation/card-balance/report.md` exists with a findings-style header (`**Outcome:**`, methodology summary, and date/preset note).
- Report includes a **per-card table** with one row for every key in `game/shared/cardDefs.json` (currently 47 cards), columns at minimum: name, type, acquisition, rewardOrder, charges, MS cost, burst/utility summary, sell value, verdict (`ok` / `over` / `under` / `mispriced`), and recommended adjustment (or `—`).
- Dedicated subsection **New & recently changed cards** analyzes `ice_ball` (294), `fireball` (297), `dungeon_drake` (298), `purifying_pulse` (299), and `chain_lightning` (302) against frost/fire/heal/lightning peers.
- **Outliers** section lists every card flagged over-budget, under-budget, dead, or mispriced with one-sentence rationale tied to metrics.
- **Degenerate combos** section names at least three multi-card interactions worth operator review (e.g., MS loops, zero-cost chains, overlapping crowd-control) even if no code change is proposed.
- **Recommendations** section splits into **Tier A — safe apply** (small numeric tweaks in shared JSON only) and **Tier B — operator triage** (mechanic reworks, card merges, reward-order shifts). Tier A items must name exact field + target value.
- Report references `game/validation/card-balance/metrics-snapshot.json` from sub-ticket 01.
- No changes to `game/shared/card*.json` in this sub-ticket.

## Technical Specs

- **`game/validation/card-balance/report.md`** (new): follow the tone/structure of `game/validation/hub/findings.md` (assertion-style bullets, clear PASS/FLAG labels) but adapted for balance analysis rather than playthrough probes.
- Read **`game/shared/cardDefs.json`**, **`game/shared/cardStats.json`**, **`game/shared/cardEconomy.json`**, and **`game/validation/card-balance/metrics-snapshot.json`**; cross-check acquisition paths via `game/server/config.js` (`VICTORY_REWARD_ROTATION`, `SHOP_CARD_POOL`) and `game/server/test/card_acquisition.test.js` reachability rules.
- Compare evolved pairs listed in `cardEconomy.json` → `evolutionTransforms` for power jumps.
- Do **not** apply stat changes or modify tests here — implementation belongs in sub-ticket 03.

## Verification: code
