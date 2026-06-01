# Tests: Field Medic Kit — heal, range, cooldown

Add integration tests for the `field_medic_kit` key item to verify the AoE heal, radius boundary, and cooldown gate using the existing socket-based test helpers.

## Acceptance Criteria

- Test file `game/server/test/field_medic_kit.test.js` exists and passes.
- **Two players in range both heal:** connect two clients, place them within 5 m, use `field_medic_kit` — both gain HP (capped at `MAX_HP`) and MS (capped at `MAX_MAGIC_STONES`).
- **Out-of-range player unchanged:** third player placed > 5 m away sees no HP or MS change.
- **Dead players skipped:** a dead player in range does not receive the heal.
- **Cooldown gate:** using `field_medic_kit` again within 7 s returns `{ ok: false, reason: 'on_cooldown' }` and does not apply heal.
- **Caster self-heals:** the caster is included in the AoE and receives HP + MS.

## Technical Specs

| File | Change |
|---|---|
| `game/server/test/field_medic_kit.test.js` | New test file. Use `startTestServer`, `connectClient`, `waitForEvent`, `playerForSocket`, `testGameState` from `./helpers.js`. Set up 2–3 connected players in `playing` phase, position them manually on `gameState.players`, emit `useKeyItem` with `field_medic_kit`, and assert HP/MS/cooldown state. |

Follow the structure of `game/server/test/key-items.test.js` (socket handler tests) for the multi-player setup pattern.

## Verification: code
