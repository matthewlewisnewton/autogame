# 307-card-windup-commitment-input-lock-mechanic

## Difficulty: hard

## Goal

Add a CARD WIND-UP / COMMITMENT mechanic — a new balance lever. Today all card uses resolve instantly on the tick with no commitment. This adds an optional per-card wind-up window during which the player is COMMITTED: they cannot move or use other cards while the wind-up animation plays, then the card resolves and input resumes. This lets the hardest-hitting cards feel like big, committed power hits (and trades raw power for vulnerability/commitment).

Mirror the EXISTING ENEMY wind-up pattern in game/server/simulation.js (attackState "windup" / windupStartTime / attackWindupMs) for the player side.

DESIGN:
- New optional per-card field, e.g. windUpMs (game/shared/cardStats.json or cardDefs.json). When a card with windUpMs > 0 is used, the player enters a committed state for windUpMs: server REJECTS/queues movement input and other card-use inputs until it elapses; the cards effect resolves at the end of the wind-up (the "big hit" lands after the telegraph). After it elapses, input resumes.
- The player is committed and VULNERABLE during wind-up (cannot move/dodge) — this is the risk/reward.
- Client plays a wind-up animation + shows the lockout (input disabled feedback).
- BACKWARD COMPATIBLE: cards with no windUpMs (or 0) behave exactly as today — instant, no lock. Server-authoritative.

ACCEPTANCE: a card with windUpMs locks the players movement AND other card usage for the duration, then resolves; a normal (no-windUp) card is unaffected and still instant; client shows the wind-up animation/lock; server tests for input-lock during wind-up, resolution at end, and no regression for normal cards. SCOPE: game/server (card-use + input handling + tick), game/client (animation + input-lock feedback), game/*/test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
