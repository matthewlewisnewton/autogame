# level settings: 'Money this run' and return lines show em-dash placeholders during an active run

## Difficulty: easy

## Goal

Opening the Lv (level settings) overlay mid-run shows 'Money this run: —' and the return-currency line as '—' even when the run has collected money. The give-up cost text renders fine. Repro: launch any run, collect some loot, click the 'Lv' toolbar button. Expected: the overlay shows the actual money collected this run and what would be kept/forfeited on give-up — that is the information the player needs to decide. (Give-up itself works: returns to lobby, HP injuries kept.)

## Acceptance Criteria

- Lv overlay shows live run-money collected and the correct keep/forfeit amounts; values update if reopened after collecting more loot.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
