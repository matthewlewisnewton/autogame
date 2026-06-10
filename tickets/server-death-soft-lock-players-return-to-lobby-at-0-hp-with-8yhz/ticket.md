# Server: death soft-lock — players return to lobby at 0 HP with 0 money (LOBBY_REVIVE_HP is dead code), redeploy = instant Signal Lost

## Difficulty: easy

## Goal

Found while playtesting (2026-06-09). Dying on your first run with no money permanently bricks the account's ability to progress.

WHAT HAPPENS
- Die in a run -> return to the hub lobby still at 0 HP.
- Medic heal costs MEDIC_HEAL_COST = 10 money (game/server/config.js ~line 36), but a fresh player who died has 0 money.
- Ready-up at 0 HP -> run starts and immediately fails ("Signal Lost"), no rewards, still 0 money. Loop forever.
- LOBBY_REVIVE_HP = 10 is defined and exported in config.js (~line 38, commit b4a5bb8) but is referenced NOWHERE else in game/server — the lobby revive it implies was never wired up (grep -rn LOBBY_REVIVE_HP game/server returns only config.js).

REPRO
1. Fresh account, deploy into training_caverns, let enemies kill you (currency 0 at death).
2. Back in lobby: HP shows 0, money 0. Medic booth refuses (insufficient funds).
3. Ready up again: run fails within seconds with Signal Lost.
4. Repeat step 3 indefinitely — no way to recover without another player/account.

FIXED WHEN
Returning to the lobby after a failed run restores at least LOBBY_REVIVE_HP (or deploying clamps HP to a minimum, or medic heal is free at 0 money — any one path breaks the lock). A fresh account that dies at 0 money can subsequently complete a run.

NOTE: refs at commit b4a5bb8; lines may drift.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
