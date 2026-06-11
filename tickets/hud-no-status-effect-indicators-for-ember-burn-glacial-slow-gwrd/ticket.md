# hud: no status-effect indicators for ember burn / glacial slow (DoT and slow are invisible to the player)

## Difficulty: medium

## Goal

Ember burn DoT verifiably ticks (HP samples while burned: 69 -> 64 -> 51 -> 46 -> 41 ... -> 0, matching the validation suite's burnTickDamageApplied PASS) and glacial throwers apply a movement slow, but the HUD gives zero feedback for either: no status icon, no HP-bar tint, no screen effect, no 'Burning'/'Slowed' badge (DOM scan for status/burn/slow/chill elements found nothing). The player just sees their HP melt or their character feel sluggish with no explanation, which makes the themed-level hazards read as bugs rather than mechanics. Expected: a small status-effect strip near the HP/MS bars showing active effects with remaining duration (burning, slowed, and future effects like wards/buffs — Echo Strike / Guard Block etc. have the same problem).

## Acceptance Criteria

- While player.burningUntil or a glacial slow is active, a visible status indicator appears on the HUD and clears when the effect expires; indicator covered by a client test or capture; works for at least burn + slow.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
