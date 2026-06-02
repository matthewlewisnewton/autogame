## Creature-card echo_strike regression test

Spell cards are tested to ensure they do not consume `echoStrikePending` or enqueue echoes, but there is no parallel test for `type: 'creature'` summon cards. The server branches are separate and should behave identically; a small test mirroring the frost_nova case would guard against future refactors accidentally merging branches.

### Acceptance Criteria
- With `echoStrikePending === true`, using a creature card does not set the flag to false and leaves `state.pendingEchoes` empty.
- A subsequent weapon hit still procs the echo (two damage packets) after the creature play.
