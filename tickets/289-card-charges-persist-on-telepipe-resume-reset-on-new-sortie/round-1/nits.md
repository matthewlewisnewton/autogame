## Update Telepipe Design Documentation
`game/docs/design.md` still describes the post-287 policy where Telepipe clears transient dungeon state, has no checkpoint/resume path, and leaves card-charge persistence out of scope. The owner decision for this ticket supersedes that behavior, so the design doc should be updated after the runtime behavior is corrected.

### Acceptance Criteria
- The Telepipe Evacuation section describes telepipe resume as returning to the same suspended run, with card charges preserved on resume and reset only on a fresh new sortie.
- The doc continues to state that hp and magic stones persist across both telepipe resume and new sorties, with healing only at the Medic station.
