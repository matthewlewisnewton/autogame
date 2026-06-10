## Clarify Glacial Slow Screenshot

`game/validation/ice/05-glacial-slow.png` is saved after the slow probe succeeds, but the Sortie Complete overlay is already visible, which makes the screenshot weaker visual evidence for the ice-ball slow impact even though `run-summary.json` and `probes.json` prove the slow and HP hit. Capture the frame before the victory overlay appears, or hide the overlay before saving this specific screenshot.

### Acceptance Criteria
- `game/validation/ice/05-glacial-slow.png` visibly shows active in-run play during or immediately after the glacial thrower slow-on-hit event, without the Sortie Complete overlay obscuring the scene.
