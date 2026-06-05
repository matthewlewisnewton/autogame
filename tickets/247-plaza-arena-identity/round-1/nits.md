## Add Arena-Specific Visual Capture For Open-Plaza Tickets

The round-1 fallback capture proved the game starts and plays, but it used the default `training_caverns` crowded layout instead of selecting an `open-plaza` quest such as `arena_trials`. A ticket-specific capture would make future holistic reviews faster and provide direct visual evidence of the dais, center ring, perimeter decor, platforms, hazards, and varied cover in one run.

### Acceptance Criteria
- The capture path selects an `open-plaza` quest through normal quest selection or a debug-only QA scenario before readying up.
- The saved metrics/screenshots include at least one gameplay screenshot where the plaza dais, center ring, perimeter decor, raised platforms, hazards, and varied cover are visible.
