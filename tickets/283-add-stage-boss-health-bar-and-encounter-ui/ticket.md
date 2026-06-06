# 283-add-stage-boss-health-bar-and-encounter-ui

## Difficulty: medium

## Goal

Found by the Rooms playthrough-validation (277). During an ACTIVE, locked stage-boss encounter there is no on-screen boss UI — no boss health bar and no encounter banner/name. The player gets no signal that a boss fight is happening or how much boss HP remains.

EVIDENCE (committed on main): game/validation/rooms/05-boss-active.png (encounter active+locked, boss annex_overseer at 320 HP per run-summary.json, but the screen shows only the normal player HUD + card hand — no boss bar/name).

ADD an encounter/boss UI that appears when an encounter is active or locked: a boss health bar bound to the encounter boss enemy + the boss display name (e.g. "Annex Overseer") and ideally an "encounter" banner. It must show for every per-level stage boss (Annex Overseer / Trial Warden / Canyon Warden / Summit Warden) using the encounter state already on the server (getEncounterBossId / isEncounterLocked / boss display metadata from the enemy-lockon panel work, 252).

SCOPE: game/client (HUD/boss-bar) + game/client/test; read existing server encounter/boss state, no gameplay changes.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
