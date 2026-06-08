## Align Weapon Debug Scenario Metadata
The new weapon visual debug scenarios hard-code a few card details that can drift from the shared definitions. For example, `heavy-greatsword-slash-ready` gives Alloy Greatblade and Excalibur Photon fewer charges than `cardDefs.json`, and the `weapon-slash-ready` comment describes Solar Edge as a starter card even though it is a reward card.
### Acceptance Criteria
- Debug-scenario hand setup for weapon QA derives card names and charges from shared card definitions, or the hard-coded values are corrected to match them.
- Scenario comments accurately describe how each showcased card is reached through normal gameplay.
