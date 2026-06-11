# run-end: simulation keeps running under 'Sortie Complete' overlay; summary money diverges from wallet

## Difficulty: medium

## Goal

On victory the Sortie Complete overlay appears immediately, but the player can still move, pick up loot, and use key items behind the modal. Repro: Initiate Vault, kill final hostile, then walk over remaining loot drops while the overlay is up. Observed: wallet HUD went 22 -> 43 money while the overlay's 'Money collected: 22' / '+22 money earned' lines stayed frozen, so the reward screen contradicts the wallet. Key-item use attempts during this state also flash the cooldown HUD while doing nothing. Expected: either input is locked when the summary shows (with a short loot-vacuum grace before the overlay), or the summary live-updates to include post-victory pickups.

## Acceptance Criteria

- After victory fires, either player movement/pickup is disabled once the summary overlay is visible, or the summary's money/reward lines match the wallet delta earned during the run including post-victory pickups; no interactive sim actions are possible behind the modal.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
