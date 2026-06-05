# 227-gameplay-enemy-variant-polish

## Difficulty: medium

## Goal

The 4 enemy variants (volatile/warded/leeching/frenzied) shipped server logic + basic client tints/badges, but several have no real player-facing feedback. Frenzied enrages at HP<50% (getFrenziedCombatMultipliers) with no telegraph; there is no variant codex/legend; no audio cues.

## Acceptance Criteria

- 1. Add a pre-enrage telegraph for frenzied (visual tell before the speed/attack boost). 2. Add a variant codex/legend in the HUD so players can read what each variant does. 3. Add audio cues for the distinctive variant events (volatile explosion, leech tether, warded shield break). Each is debug-scenario reachable for capture.

## Verification

Builds on the shipped variant visuals. SIMPLICITY/feature polish. Medium.
