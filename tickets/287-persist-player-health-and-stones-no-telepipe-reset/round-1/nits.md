## design.md still describes the removed checkpoint capture/restore model
`game/docs/design.md:33-35` describes Telepipe suspend as "the server captures a checkpoint with the run, layout, enemies, ... and portal position" and Deploy as "the checkpoint is restored". This ticket replaced that machinery with a durable in-memory pause (no `captureRunCheckpoint`/`restoreRunCheckpoint`/`suspendedCheckpoint`), so the doc is now stale and misleading for future work.
### Acceptance Criteria
- design.md describes Telepipe suspend/resume as an in-memory pause of the existing run (state stays live; HP and Magic Stones persist; health restores only at the med booth) with no checkpoint capture/restore wording.
- No references to `captureRunCheckpoint`, `restoreRunCheckpoint`, `suspendedCheckpoint`, or `suspendedRunSummary` remain in design.md.

## Telepipe smoke script / debug test use stale checkpoint wording and controls
`game/client/scripts/test-telepipe-suspend-resume.mjs` and a debug-scenario test still use stale checkpoint terminology, and the smoke script appears to click the retired `#ready-btn` rather than the current Launch Bay / test ready-up path. Worth aligning so developer smoke commands match the shipped flow.
### Acceptance Criteria
- Telepipe smoke/debug tests use current in-memory-pause terminology and deploy through the Launch Bay / test hook path, not the removed `#ready-btn`.

## Health/Magic-Stone state is not durable across a server restart
`extractPersistentData()` (game/server/progression.js:855) is the saved-player serializer and is called on telepipe extract and return-to-lobby, but it omits `hp`, `dead`, and `magicStones`; `buildPlayerRecord()` (game/server/index.js:886) likewise resets them to `MAX_HP`/`STARTING_MAGIC_STONES` when rebuilding from saved data. In-session continuity (the acceptance scenario) works because the in-memory record survives, but a server restart / cold record rebuild loses the "forever" durability the goal calls for.
### Acceptance Criteria
- `hp`, `dead`, and `magicStones` round-trip through `extractPersistentData()` → save → `buildPlayerRecord()` load.
- A persistence test asserts a damaged player with spent Magic Stones reloads with the same `hp`/`magicStones` after a simulated cold reconnect.

## Clarify death-respawn vs. "med booth is the only heal" intent
On death, `simulation.js:1971-1983` auto-respawns the player to `MAX_HP` (`dead = false`) after `RESPAWN_DELAY_MS`. This is pre-existing and untouched by the ticket, and the hub/lobby flow correctly no longer auto-heals — but it is a full health restore outside the med booth, in tension with the owner decision's "the ONLY thing that restores health is the MED BOOTH". Worth an explicit owner call on whether in-dungeon death should still full-heal.
### Acceptance Criteria
- A documented decision (in design.md or the ticket) on whether in-dungeon death respawn should heal, and the respawn code + `server.test.js:485` reflect it.
