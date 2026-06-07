# Weapons & spells balance report (part 1)

Run the metrics harness from sub-ticket 01 and author the first half of `game/validation/card-balance/report.md`: methodology, a per-card markdown table for all **weapon** and **spell** cards, peer-band outlier notes, and a dedicated spotlight on recently landed cards (`fireball`, `ice_ball`, `chain_lightning`, `purifying_pulse`). Tag each recommendation as `apply-now` (clearly safe, low-risk numeric tweak) or `operator-triage` (needs rework or design call). Do not apply JSON changes yet.

## Acceptance Criteria

- `game/validation/card-balance/report.md` exists with sections: `# Card balance report`, `## Methodology`, `## Weapons`, `## Spells`, `## New/changed cards (294–302 spotlight)`.
- Every card with `type: "weapon"` or `type: "spell"` in `game/shared/cardDefs.json` appears **exactly once** in the weapons or spells table with columns for at least: name, id, charges, MS cost, primary damage/burst stat, derived efficiency metric, acquisition/rewardOrder, verdict (`ok` / `over` / `under` / `dead`), and recommendation.
- Spotlight subsection explicitly analyzes `fireball` (297), `ice_ball` (294), `chain_lightning` (302), and `purifying_pulse` (299) against same-type peers on damage, MS cost, charges, cooldown, and utility (burn, slow, chain, heal+cleanse).
- At least three weapon/spell outliers are identified with one-sentence rationale each; recommendations use `apply-now` or `operator-triage` labels.
- No edits to `game/shared/card*.json` or card effect/simulation code.

## Technical Specs

- **`game/validation/card-balance/report.md`**: create file; embed or reference output from `analyzeCards.mjs`; use findings-style tone similar to `game/validation/open-plaza/findings.md` (outcome-oriented headers, assertion-like verdicts) but focused on balance tables rather than playthrough probes.
- **Inputs**: `game/shared/cardDefs.json`, `game/shared/cardStats.json`, `game/shared/cardEconomy.json`, metrics from `game/validation/card-balance/analyzeCards.mjs`.
- **Peer context**: read `game/server/test/fireball_card.test.js`, `ice_ball_card.test.js`, `chain_lightning.test.js`, `purifying_pulse.test.js`, and `game/server/cardEffects.js` / `simulation.js` only as needed to interpret effective behavior (burn ticks, slow chance, chain targets, AoE radius) — document assumptions in Methodology.
- Leave placeholders or stub headings for `## Creatures`, `## Enchantments`, `## Economy`, `## Degenerate combos`, and `## Executive summary` to be completed in sub-ticket 03.

## Verification: code
