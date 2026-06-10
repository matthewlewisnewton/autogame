# Cleanup nits from 372-playthrough-validate-ice-level

> **Staleness note.** This follow-up ticket was written against commit
> `669b40ee` (2026-06-10). The codebase may have moved on since it was filed —
> before acting, re-check every file path and code reference below
> against the CURRENT code, and skip any nit that is already resolved.

Minor, non-blocking nits the reviewer noted while passing `372-playthrough-validate-ice-level`.
None blocked acceptance — clean them up when convenient.

## Difficulty: easy

## Clarify Glacial Slow Screenshot

`game/validation/ice/05-glacial-slow.png` is saved after the slow probe succeeds, but the Sortie Complete overlay is already visible, which makes the screenshot weaker visual evidence for the ice-ball slow impact even though `run-summary.json` and `probes.json` prove the slow and HP hit. Capture the frame before the victory overlay appears, or hide the overlay before saving this specific screenshot.

### Acceptance Criteria
- `game/validation/ice/05-glacial-slow.png` visibly shows active in-run play during or immediately after the glacial thrower slow-on-hit event, without the Sortie Complete overlay obscuring the scene.
