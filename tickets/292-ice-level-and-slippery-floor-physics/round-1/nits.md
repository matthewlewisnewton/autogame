## Fix Ice Cavern Palette Test Profile Name
`game/client/test/dungeon.test.js` compares the ice palette against `getProfileMaterialColors('sunken-cavern')`, which appears to be a typo for the real `sunken-canyon` profile. The assertion still passes because it compares against fallback colors, but it weakens the intended regression check.

### Acceptance Criteria
- The test uses the real `sunken-canyon` profile name and still confirms the ice-cavern palette is distinct.
