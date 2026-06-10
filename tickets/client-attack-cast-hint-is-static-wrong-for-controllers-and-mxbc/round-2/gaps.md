1. 8BitDo 64 hand-slot remaps are ignored by the displayed hand badges and attack/cast hint.
   Files: game/client/input.js, game/client/test/attack-cast-hint.test.js, game/client/test/input.test.js
   Fix: In the 8BitDo branch of `getHandSlotInputHints()`, describe the resolved binding before falling back to default A/B/C labels, and add tests proving remapped 8BitDo `useSlotN` bindings update `getHandSlotInputHints()` and `getAttackCastHint()`.
