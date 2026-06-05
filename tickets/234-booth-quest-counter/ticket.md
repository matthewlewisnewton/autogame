# 234-booth-quest-counter

## Difficulty: medium

## Goal

Quest-counter booth: walking up opens the existing quest selection (selectQuest). Add ?booth=quest debug hook to jump straight to it.

## Acceptance Criteria

- 1. Quest booth (uses the 233 primitive) opens the existing quest panel; selectQuest works from it. 2. ?booth=quest debug hook (gated like ALLOW_DEBUG_SCENARIOS). 3. 2D quest menu still works. 4. Test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
