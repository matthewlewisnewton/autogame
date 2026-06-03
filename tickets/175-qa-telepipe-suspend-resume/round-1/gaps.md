1. Telepipe suspend/resume screenshot evidence is missing; only `state-snapshot.json` exists, and the top-level round capture is the generic fallback flow.
   Files: `game/client/scripts/test-telepipe-suspend-resume.mjs`, `game/docs/walkthroughs/telepipe-suspend-resume/`
   Fix: Run the Telepipe smoke and preserve the generated `01-in-dungeon.png`, `02-suspended-lobby.png`, and `03-resumed-dungeon.png` alongside the state snapshot.

2. The Telepipe smoke does not assert position semantics or quest/objective progress preservation across resume.
   Files: `game/client/scripts/test-telepipe-suspend-resume.mjs`, `game/docs/walkthroughs/telepipe-suspend-resume/state-snapshot.json`
   Fix: Extend the captured snapshot/assertions to compare quest objective progress before suspend with post-resume state, and explicitly assert the intended resumed player/portal position behavior.
