# Senior Review — 267-sec-hat-equip-unlock-check

## Runtime health

The captured run is clean and sufficient to judge the ticket.

| Check | Result |
|-------|--------|
| `metrics.json` present | Yes |
| `metrics.json` `"ok"` | `true` |
| `pageerrors` | `[]` (empty) |
| `failure_kind` | absent |
| `harness_failure` | absent |
| `console.log` pageerror / `[fatal]` | none |

Servers started on port 3001 / 5174; gameplay probes show connected lobby → playing transition, movement, and dodge-roll cooldown HUD. The two `[A:error] Failed to load resource: 409 (Conflict)` lines are HTTP resource failures during harness auth (duplicate registration), not uncaught page exceptions — they do not block.

## Scope of changes (bed247ce..HEAD)

Two commits, both test-focused:

1. **79dd643c** — Harden `updateProfile` starter/locked-hat unit tests in `cosmetic.test.js` (add `none` equip case, assert `cosmetic.hat` unchanged after rejection).
2. **3b6750fb** — Add `applyAppearanceChange` integration test rejecting locked `wizard` hat in `apply_appearance_change.test.js`.

No production code changed in this ticket branch. The unlock enforcement itself was already present at baseline in:

- `game/server/users.js` (`updateProfile`, lines 304–309)
- `game/server/socketHandlers/lobbyHandlers.js` (`applyAppearanceChange`, lines 257–262)

That matches the intended architecture: `validateCosmetic` stays catalog-only; account ownership is enforced at persistence / socket handler call sites.

## Acceptance criteria

### Equipping a hat verifies `unlockedHats`; reject otherwise

**Met.**

`updateProfile` validates catalog membership via `validateCosmetic`, then gates hat persistence:

```304:309:game/server/users.js
		// Equipping a hat is only allowed for hats the account has unlocked.
		if (result.value.hat !== undefined) {
			const unlocked = backfillUnlockedHats(user.unlockedHats);
			if (!unlocked.includes(result.value.hat)) {
				return { ok: false, reason: 'Hat is not unlocked for this account' };
			}
```

The lobby socket path performs the same check before delegating to `updateProfile`, so locked hats are rejected early with `appearanceError` and never reach persistence:

```257:262:game/server/socketHandlers/lobbyHandlers.js
      if (validation.value.hat !== undefined) {
        const unlocked = backfillUnlockedHats(account.unlockedHats);
        if (!unlocked.includes(validation.value.hat)) {
          socket.emit('appearanceError', { reason: 'Hat is not unlocked for this account' });
          return;
        }
      }
```

`PATCH /api/me/profile` routes through `updateProfile` (`account.js`), including hat-only changes when not blocked by the paid-appearance lobby guard. No alternate write path bypasses the unlock gate for normal player flows.

Starter hats (`none`, `bandana`, `beanie`) remain equippable on fresh accounts via default `unlockedHats`.

### Test for equip-locked-hat rejection

**Met.**

| Path | Test file | Case |
|------|-----------|------|
| `updateProfile` | `cosmetic.test.js` | Fresh account, `{ hat: 'crown' }` → `{ ok: false }`, reason matches `/not unlocked/i`, `cosmetic.hat` stays `'none'` |
| `applyAppearanceChange` | `apply_appearance_change.test.js` | Lobby socket, `{ hat: 'wizard' }` → `appearanceError`, live player and account hat unchanged |

Harness vitest run (`coverage.log`): 68 tests passed across both files, including the new locked-hat cases. Regression guard for free starter hat equip via socket (`bandana`) still passes.

## Design & requirements consistency

- Aligns with the cosmetic/hat economy model: catalog validation is separate from ownership; spending currency unlocks via `unlockHat`; equipping requires ownership.
- No changes to `game/docs/design.md` surface area; no regression to foundation requirements.
- `validateCosmetic` correctly remains catalog-only (ticket goal acknowledged this split).

## Code quality

- Defense-in-depth: unlock checked in both `lobbyHandlers` and `updateProfile` — redundant but safe; a future caller of `updateProfile` alone is still protected.
- Tests assert persisted state, not just return codes — good coverage of the original exploit (free equip of paid hats).
- No dead code, no new console errors, no debug scenarios added or modified by this ticket.

## Debug scenarios

Not in scope for this ticket. Existing debug scenarios (e.g. `avatar-wizard-hat`) remain URL-gated dev shortcuts; normal equip flow still goes through unlock + `applyAppearanceChange` / `updateProfile`.

## Harness capture note

Round-1 capture used the fallback full-flow smoke plan (lobby → gameplay → movement/dodge). It does not visually exercise hat customization, but the ticket acceptance criteria are server-side enforcement and automated tests — both are satisfied independently of the capture plan.

## Remaining gaps

None. The security fix is in place at both equip entry points, automated tests cover locked-hat rejection on profile update and lobby appearance change, the game starts and runs cleanly in capture, and vitest passes.

VERDICT: PASS
