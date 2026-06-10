# Wave-gated doors: blocking gates in passages that unlock when a scripted wave is cleared

## Difficulty: hard

## Goal

PSO model: quest doors stay locked until specific waves are cleared, which turns flat layouts into paced, room-by-room encounters.

DESIGN
- Server: gate entity declared in the quest script ({ passage/position, unlockOn: { waveCleared: id } }). While locked it acts as a wall collider (hook into the existing wall/movement collision used by movement validation); on unlock, remove the collider and broadcast.
- Client: render a visible gate mesh (themed slab/forcefield) and remove it with a brief effect on unlock, so the cause ("cleared the room -> door opened") reads clearly. Show a small toast/radio line on unlock (pairs with the dialogue bead).

ACCEPTANCE
- A locked gate blocks both player movement and enemy pathing through its passage.
- Clearing the bound wave unlocks it within one tick; clients see it disappear.
- A scripted quest can chain: room A wave -> gate to room B opens -> room B wave -> gate to treasure room.
- No gates in non-scripted quests; telepipe escape still works while gated.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
