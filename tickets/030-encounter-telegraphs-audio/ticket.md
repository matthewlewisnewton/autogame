# Encounter Telegraphs and Audio Cues

Add basic enemy attack telegraphs and lightweight audio cues so combat feels intentional instead of silent and instantaneous.

## Dependencies

This ticket should come after `029-combat-feedback-readability`, which adds clearer hit and damage feedback.

## Goal

Players should be able to anticipate danger and receive sensory confirmation for major combat actions. Keep this small and system-driven: no large asset pipeline, no complex animation system.

## Acceptance Criteria
- Enemy attacks are no longer completely invisible before damage is applied.
- Before an enemy damages a player, the server exposes or emits a short wind-up/telegraph state.
- The client renders enemy wind-up clearly, such as:
  - enemy color change
  - ground warning circle/cone
  - brief scale pulse
- The telegraph duration is long enough to be visible in screenshots and reactable in play.
- Damage is applied after the telegraph window, not at the exact same instant it starts.
- If a target leaves range before the telegraph resolves, the server either cancels the attack or validates range again before applying damage.
- The server remains authoritative for whether damage lands.
- Add lightweight audio cues for:
  - player card activation
  - enemy hit
  - player damaged
  - loot pickup
  - run victory/failure if those events exist
- Audio is optional/mutable in browsers: failure to play sound must not throw or break gameplay.
- Add a simple mute toggle or respect a single client-side `soundEnabled` boolean.
- No external paid or large binary assets are required; generated oscillator beeps or tiny local placeholder files are acceptable.

## Implementation Notes
- Prefer a small enemy attack state machine:
  - `idle/chasing`
  - `windup`
  - `recovering`
- Keep values named constants:
  - `ENEMY_ATTACK_RANGE`
  - `ENEMY_ATTACK_DAMAGE`
  - `ENEMY_ATTACK_WINDUP_MS`
  - `ENEMY_ATTACK_RECOVERY_MS`
- Emit or include enough state for client rendering:
  - enemy id
  - telegraph start time
  - target player id
  - attack radius/range
- Avoid full animation blending or imported asset packs.
- This ticket should not implement smarter pathfinding; leave wall-aware navigation to `024-entity-ai-improvements`.

## Files
- `game/server/index.js`
- `game/client/main.js`
- `game/client/index.html`
- `game/client/style.css`
- `game/server/test/server.test.js`
- `game/server/test/integration.test.js`
- `game/client/test/main.test.js`

## Tests
- Unit test enemy attack wind-up transitions.
- Unit test range revalidation before damage lands.
- Integration test that a nearby enemy emits or exposes a telegraph before player HP changes.
- Integration test that moving out of range before telegraph resolution avoids or cancels damage, if that behavior is chosen.
- Client test that sound helper does not throw when browser audio playback is blocked.

## Visual QA Checklist
- Stand near an enemy and verify a wind-up cue appears before HP drops.
- Move away during wind-up and verify expected server behavior.
- Use cards, take damage, pick up loot, and finish/fail a run to verify audio cues or muted fallback behavior.

## Verification: visual
