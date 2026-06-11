# Senior Review: medic heal button affordability feedback

**Ticket:** medic: heal button silently disabled when the player cannot afford it  
**Baseline:** `87c8a43061c5e43c0ffd0bdc35c1bfd5d62ce7f6`  
**Commits:** `97b0f7d4` — `medic-heal-button-silently-disabled-when-the-player-cannot-a-y199/01-medic-affordability-shortfall-message`

## Runtime health

| Check | Result | Evidence |
|-------|--------|----------|
| `metrics.json` present and healthy | **PASS** | `"ok": true`, servers started, `sceneInitialized: true`, gameplay probes complete |
| Browser page errors | **PASS** | `pageerrors: []`, `pageerrors.json` empty |
| Console fatal / pageerror | **PASS** | `console.log` has no `pageerror` or `[fatal]` lines; only benign Vite connect logs and a 409 username-conflict on register (harness noise) |

The captured run proves the game loads and plays. Round-1 capture used the generic fallback smoke plan (dungeon movement/dodge), not a medic-tab scenario; acceptance for this ticket relies on unit tests and code inspection.

## Scope of change

One functional line in `renderGuildMedic()` plus targeted test updates:

- `game/client/main.js` — broke-injured cost line now reads `Need 10 money — you have {currency}. Free triage available.`
- `game/client/test/medicHud.test.js` — asserts shortfall copy, paid copy when affordable, and `#medic-error` stays hidden

No server changes, no new debug scenarios.

## Per-criterion findings

### When wallet < heal cost, medic panel states the shortfall reason; message clears once affordable

**PASS**

`renderGuildMedic()` branches on `canAffordMedic = currency >= MEDIC_HEAL_COST`:

```3004:3011:game/client/main.js
	if (costDisplayEl) {
		if (atFull) {
			costDisplayEl.textContent = 'You are already at full health.';
		} else if (!canAffordMedic) {
			costDisplayEl.textContent = `Need ${formatCurrencyPrice(MEDIC_HEAL_COST)} — you have ${currency}. Free triage available.`;
		} else {
			costDisplayEl.textContent = `Full restore: ${formatCurrencyPrice(MEDIC_HEAL_COST)}`;
		}
	}
```

For HP 50 / money 0 this renders `Need 10 money — you have 0. Free triage available.` — cost, wallet, and shortfall are all explicit. `#medic-error` is cleared on every render via `showMedicError('')`.

When `currency >= MEDIC_HEAL_COST` and not at full HP, the shortfall line is replaced by `Full restore: 10 money` with no triage wording. Tests cover both broke and affordable injured cases.

**Wording vs. charity medic:** The parent ticket Goal still describes a *disabled* heal button (pre–charity-medic UX). The live game gives broke injured players a **enabled** free-triage button (`healBtnEl.disabled = atFull` only). The decompose plan correctly scoped work to cost-line shortfall messaging rather than re-disabling the button. The acceptance criterion’s “reason the button is disabled” is satisfied in spirit: the panel explains why the **paid** restore is unavailable (need vs. have) while noting free triage. This matches `game/docs/design.md` Post-death recovery (charity medic at 0 cost when broke).

**Refresh paths:** `renderGuildMedic()` runs when the Medic tab is selected (`setLobbyTab`), after `MEDIC_HEALED`, and when returning to lobby with collection changes. The normal post-run flow (earn money → return to hub → open Medic tab) clears shortfall copy. A pre-existing edge case where currency updates via `stateUpdate` while the Medic tab stays open may not re-render until tab switch or heal event; this is not introduced by this ticket and does not block the primary repro path.

### Consistency with design.md and requirements.md

**PASS**

- Charity medic behavior (free heal when broke, paid when funded) is documented in `design.md` and unchanged server-side (`healAtMedic()` sets `cost = 0` when `currency < MEDIC_HEAL_COST`).
- No regression to foundation requirements (3D render, socket connect, multiplayer, movement) — smoke capture and full test suite pass.

### Code quality

**PASS**

- Minimal, focused diff; uses existing `formatCurrencyPrice` for consistency with paid copy.
- No dead code, no new console errors.
- `medicHud.test.js` (3 cases) passes; round-1 `coverage.log` shows full client suite green (315 tests).

### Debug scenarios

**N/A — no new or changed `?debugScenario=` shortcuts in this ticket.**

## Integration check

Sub-ticket `01-medic-affordability-shortfall-message` passed its own QA. Holistic review confirms the single sub-ticket fully covers the parent acceptance criterion; no integration gaps between client HUD and server charity heal logic.

## Remaining gaps

None blocking.

VERDICT: PASS
