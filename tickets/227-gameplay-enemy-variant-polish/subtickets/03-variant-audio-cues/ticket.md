# 03-variant-audio-cues

Add distinct audio cues for the three key variant events: volatile explosion on death, leeching tether activation (when a leeching enemy heals from a hit), and warded shield break. Each sound is a synthesized SFX using the existing Web Audio oscillator system, triggered on the client when the corresponding server event is received.

## Acceptance Criteria

- A unique sound plays when a volatile enemy explodes on death (existing `volatileExplosion` socket event path)
- A unique sound plays when a leeching enemy triggers its heal after dealing damage
- A unique sound plays when a warded enemy's shield is fully broken (shieldHp drops to 0)
- Each sound has a distinct character (e.g., different frequency/envelope) so they are audibly distinguishable
- Sounds respect the existing mute setting (`isSoundEnabled()`)
- Each event is reachable via the existing debug scenarios (`volatile-enemy`, `variant-leeching`, `warded-enemy`)

## Technical Specs

**`game/client/config.js`**
- Extend `SOUND_CONFIG` with three new entries:
  - `volatileExplosion` — low-frequency rumble with longer decay (e.g., freq: 80, duration: 0.5, gain: 0.25)
  - `leechHeal` — rising chirp (e.g., freq: 900, duration: 0.2, gain: 0.2)
  - `shieldBreak` — sharp crack (e.g., freq: 150, duration: 0.15, gain: 0.35)

**`game/client/audio.js`**
- Ensure `playSound(type)` handles the three new types from `SOUND_CONFIG` (should work automatically if config-driven; if hardcoded, add cases)

**`game/client/main.js`**
- In the `volatileExplosion` socket handler (line ~1109), add `playSound('volatileExplosion')` call

**`game/server/simulation.js`** (or `enemyVariants.js`)
- When a leeching enemy triggers `applyLeechHeal`, emit a `leechHeal` socket event with the enemy ID so the client can play the sound
- When a warded enemy's shield breaks (shieldHp reaches 0), emit a `shieldBreak` socket event with the enemy ID

**`game/client/main.js`**
- Add socket handlers for `leechHeal` and `shieldBreak` events, each calling `playSound('leechHeal')` and `playSound('shieldBreak')` respectively

**`game/server/progression.js`**
- Ensure the `volatileExplosion` emit path already exists (it does at line ~1046 in index.js) — verify no additional server work needed for this event

## Verification: code
