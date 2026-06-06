## 06-boss-defeated frame shows the summary overlay, not a combat-defeat frame

For presets driven by a 1-HP instakill `bossLowHp` scenario (open-plaza), the
Sortie Complete run-summary overlay appears almost immediately after the killing
blow, so `06-boss-defeated.png` ends up showing the same overlay as
`07-victory.png`. The two files are byte-distinct only because the run-summary
spinner keeps animating between captures, not because they depict genuinely
different game states. The `main.js` comment claims `06-boss-defeated` "can
capture pre-summary combat", but in practice it does not for this path. This
makes the distinctness guard rely on animation noise and weakens the diagnostic
value of the boss-defeated screenshot.

### Acceptance Criteria
- `06-boss-defeated.png` captures the boss-defeat moment *before* the Sortie
  Complete overlay is visible (e.g. capture immediately on `bossDefeated`
  becoming true and gate on the overlay still being hidden), so it depicts a
  distinct game state from `07-victory.png` rather than a different animation
  frame of the same overlay.
- The `assertDistinctVictoryScreenshots` guard continues to pass on the
  regenerated artifacts.
