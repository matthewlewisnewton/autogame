## Telepipe section still uses "Magic Stones" label

The Combat Mechanics section was updated to **Mystic Signal (MS)** per `shared/theme.json`, but the Telepipe bullet in **Run Suspend / Resume** still says "costs 0 Magic Stones." The cost (0) is correct; the player-facing name is stale within the same file.
### Acceptance Criteria
- In `game/docs/design.md` Run Suspend / Resume, replace "Magic Stones" with "Mystic Signal" or "MS" for the Telepipe cost line, consistent with the `### Player-Facing Currency` subsection.
