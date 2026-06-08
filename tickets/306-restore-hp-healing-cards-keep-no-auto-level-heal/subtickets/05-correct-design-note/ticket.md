# 05 — Correct design.md telepipe/durability note

The design doc currently says HP is "restored only at the hub Medic station, not by telepipe-up, resume, or redeploy" — which implies healing cards don't exist. Update the note to clarify that the med booth replaces AUTOMATIC start-of-level healing as the primary heal path, while healing cards remain in the game.

## Acceptance Criteria

- `game/docs/design.md` telepipe/durability bullet for HP reads that healing comes from the med booth AND healing cards (healing_font, divine_grace, soul_drain, Field Medic Kit, purifying_pulse)
- The note explicitly states there is NO automatic free heal at level start (287 behavior preserved)
- No code files are changed in this sub-ticket

## Technical Specs

**`game/docs/design.md`** — In the "Durability across telepipe suspend/resume and new sortie" section, update the HP bullet:
- Current: `**HP:** Persists across telepipe-resume **and** new sortie; restored only at the hub **Medic station** ... not by telepipe-up, resume, or redeploy.`
- Change to: `**HP:** Persists across telepipe-resume **and** new sortie; restored at the hub **Medic station** or by **healing cards** (healing_font, divine_grace, soul_drain, Field Medic Kit, purifying_pulse) during combat — no automatic free heal at level start.`

## Verification: code
