## Name the room-0 tutorial grunt balance literals

The room-0 wave-0 grunt overrides (`hp: 50`, `attackDamage: 7`) are inline magic numbers in
`game/server/quests.js`. They encode a deliberate tutorial-difficulty decision that future balance
tickets may need to find and tune. Lifting them to a named constant (e.g.
`TUTORIAL_GRUNT_STATS`) with a short comment explaining "halved HP / reduced damage so a cold-start
starter deck can clear the opening room" would make the intent discoverable and prevent accidental
regression.

### Acceptance Criteria
- The room-0 wave-0 grunt `hp`/`attackDamage` values are defined via a named, commented constant
  rather than bare literals in the spawn def.
- `tier1_quest_identity.test.js` and `training_caverns_room0_starter_fight.test.js` still pass.
