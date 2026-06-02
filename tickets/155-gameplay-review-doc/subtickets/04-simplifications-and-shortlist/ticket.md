# Simplifications, Shortlist & Doc Polish

Finish `game/docs/gameplay-review.md` with **Simplifications**, a **Prioritized shortlist**, and a final pass so the parent ticket’s acceptance criteria are fully met in a single markdown file.

## Acceptance Criteria

- `game/docs/gameplay-review.md` is the **only** file in the working tree diff for gameplay-review work (no runtime code changes).
- Section order matches the parent ticket:
  1. **Current gameplay** (from sub-tickets 01–02, lightly edited for flow if needed)
  2. **Improvements** (from sub-ticket 03, unchanged or tightened)
  3. **Simplifications** — at least **4** proposals; each states what to simplify, why, and what is lost vs gained.
  4. **Prioritized shortlist** — exactly **5** items drawn from Improvements and/or Simplifications, ordered by impact, each with a one-line justification.
- Every item in Simplifications and the shortlist names a real mechanic/system in this game (same bar as Improvements).
- Document is self-contained: a reader needs no other repo files to understand the review (brief expansion allowed where **Current gameplay** referenced jargon).
- No empty sections, “TODO”, or stub headings.

## Technical Specs

- **Edit only:** `game/docs/gameplay-review.md`.
- Simplifications should target real complexity surfaced in earlier sections: duplicate spell/weapon roles (`design.md` playtesting note), deck/hand UI surface (`deck-viewer.js`, `hand.js`), lock-on settings matrix (`lockOn.js`, `controls.md`), lobby/HUD layers (`main.js`, `vanguard-hud.js`), telepipe tier-2 edge cases (`telepipe-tier2-context.md`), grind/shop loops (`progression.js`, `config.js`).
- Shortlist: pick the five highest-leverage changes for a small team's next iteration; do not introduce new proposals here that lack detail in Improvements or Simplifications.

## Verification: code
