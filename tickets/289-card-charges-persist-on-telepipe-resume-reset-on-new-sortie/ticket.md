# 289-card-charges-persist-on-telepipe-resume-reset-on-new-sortie

## Difficulty: hard

## Goal

OWNER DECISION (2026-06-06, follow-up to 287): "Card usage resets on starting a new sortie but not on resuming with a telepipe."

DESIRED END-STATE behavior matrix (this bead completes the picture started by 287):
- Health: persists across telepipe-resume AND new sortie; restored ONLY at the med booth (per 287).
- Magic stones: persist across telepipe-resume AND new sortie (per 287).
- CARD charges/usage: PERSIST when RESUMING an in-progress run via telepipe (telepipe-up to hub -> redeploy back into the SAME run keeps each players card charges); RESET to a fresh draw deck when starting a NEW sortie (fresh run).

So the ONLY thing that differs between "telepipe-resume" and "new sortie" is card charges (reset only on new sortie). Health + stones are durable regardless.

IMPLEMENTATION: this requires distinguishing "resuming the same in-progress run via telepipe" from "starting a new sortie". 287 makes health+stones durable and may have removed/!simplified the suspend/resume checkpoint machinery; if so, re-introduce the MINIMAL notion of "resuming the same run" needed to carry card-charge state across the telepipe-up -> hub -> redeploy cycle. On a brand-new sortie, rebuild the draw deck fresh (cards reset). Do NOT regress 287s health/stones durability.

ACCEPTANCE:
- Player spends card charges, takes telepipe-up, returns to hub, redeploys into the SAME run -> card charges are preserved (not reset).
- Player starts a NEW sortie (fresh quest/run) -> card charges reset to a fresh deck.
- Health + magic stones persist in BOTH cases (regression-guard 287).
- Server tests covering both paths (telepipe-resume preserves cards; new sortie resets cards; health/stones persist in both).

SCOPE: game/server/progression.js (deploy/resume/new-sortie + draw-deck paths), game/server, game/server/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
