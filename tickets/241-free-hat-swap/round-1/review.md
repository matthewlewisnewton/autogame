## Runtime health

PASS. The captured run loaded cleanly: `metrics.json` reports `ok: true`, servers started, and `pageerrors` is empty. `console.log` contains no `pageerror` or `[fatal]` entries from game code; the only notable entries are non-fatal resource 409s plus normal Vite/scene initialization.

## Acceptance criteria findings

1. Swapping to an unlocked hat is free from booth and main menu.

PASS. The shared appearance diff helper excludes `hat` from paid appearance fields, so hat-only changes are treated as free. The booth path sends `applyAppearanceChange`; the server computes `paidChange` with `hasAppearanceFieldChanges()` and applies hat-only changes with cost `0`. The main-menu/account path uses `PATCH /api/me/profile`; when a live lobby player exists, it blocks paid appearance edits but still permits hat-only edits, and `updateProfile()` persists the cosmetic without charging currency. Tests cover hat-only free socket changes, persistence without currency deduction, and hat-only profile PATCH success.

2. Equipping verifies the hat is unlocked.

PASS. Both server entry points validate the proposed hat against `backfillUnlockedHats(account.unlockedHats)` before applying it. `updateProfile()` rejects hats not unlocked for the account, and the socket `applyAppearanceChange` handler performs the same check before any currency or cosmetic mutation. Tests cover rejection of locked hats without updating live or account cosmetic.

3. Test.

PASS. `coverage.log` shows the vitest run completed successfully: 10 test files passed, 226 tests passed. Relevant coverage includes `apply_appearance_change.test.js`, `appearance_change_persistence.test.js`, `cosmetic_appearance.test.js`, `characterBooth.test.js`, and the new `debug-hatswap-hook.test.js`.

## Debug scenario / shortcut review

PASS. The new `?booth=hatswap` shortcut is only reachable through the URL parameter and only on local debug hosts. It opens the character booth in lobby phase, emits the existing `hats-unlocked` debug scenario once, and rebuilds the booth hat list when the scenario result reports unlocked hats. The server-side debug scenario gate still requires loopback or explicit debug enablement, and the scenario documents that the same owned-hat state is reachable through normal currency earning and hat unlocking. Normal gameplay can still reach the equivalent end state through the character booth plus the regular unlock/equip flow.

## Design / requirements consistency

PASS. The implementation stays within the existing lobby/account customization model and does not affect the 3D rendering, server-client socket architecture, multiplayer visualization, or movement synchronization requirements. No regressions were evident in the live smoke capture.

## Remaining gaps

None.

VERDICT: PASS
