# 10 — Update design doc for durable vitals and no checkpoint restore

`game/docs/design.md` still documents Telepipe as suspend/resume with full run checkpoint restore. Replace that section with the owner decision: player HP and magic stones persist continuously; telepipe-up returns to the hub; redeploy starts a fresh dungeon; only the hub Medic station restores health.

## Acceptance Criteria

- The `## Run Suspend / Resume` section (or renamed equivalent) no longer describes `captureRunCheckpoint`, `restoreRunCheckpoint`, or enemy/layout/objective preservation on redeploy.
- Updated prose covers: telepipe portal placement and per-player extract; hub return when all players extract; **fresh** dungeon on redeploy (new layout/run); **durable** player `hp` and `magicStones` across hub↔sortie transitions and across runs; med booth as the **only** full-health restoration.
- Card charge persistence is explicitly out of scope / unchanged (per parent ticket).
- No contradictions with implemented server behavior from sub-tickets 01–09.

## Technical Specs

- **`game/docs/design.md`** — Rewrite the Telepipe / run-evacuation section (~lines 28–35) to match durable-vitals + fresh-redeploy model. Remove suspend/resume checkpoint bullet points; add med-booth-only healing note cross-referencing hub Medic station.

## Verification: code
