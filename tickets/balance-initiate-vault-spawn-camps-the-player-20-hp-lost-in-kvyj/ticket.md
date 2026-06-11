# balance: Initiate Vault spawn-camps the player — ~20 HP lost in the first seconds while intro text is up

## Difficulty: easy

## Goal

On Initiate Vault tier 1 the two scripted entry grunts are already in aggro/attack range at the player spawn. In repeated runs the player was at 80/100 HP within ~2 seconds of the level loading, before any input — exactly while the 'ANNEX LIAISON KADE — Entry annex is live...' intro banner and comms tutorial text ('Move with WASD...') are on screen. New players take unavoidable chip damage during the tutorial moment. Repro: launch the default quest and watch the HP bar for the first 3 seconds. Expected: entry-room spawns placed out of immediate range, a brief aggro delay, or spawn-protection i-frames for ~2s.

## Acceptance Criteria

- Launching Initiate Vault tier 1 and standing still for 3 seconds leaves the player at 100/100 HP; grunts still engage once the player moves into the room.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
