# balance: death spiral — die with empty wallet and you respawn at 10/100 HP with no way to heal

## Difficulty: medium

## Goal

Dying ends the run with +0 money earned (run money is forfeited). Back in the lobby the player is revived at 10/100 HP. The medic costs a flat 10 money for a full restore, so a player whose wallet is 0 (e.g. any new account that dies on its first sortie) cannot heal and must start the next run at 10 HP — where the Initiate Vault spawn grunts hit for ~10-20 within seconds (see spawn-camping bead), making an immediate second death very likely. There is no free baseline regen, no partial heal option, and no over-time recovery in the hub. Repro: fresh account -> create lobby -> launch -> die -> observe 10/100 HP, Money 0, medic button disabled. Expected: some floor on post-death recovery (e.g. respawn at 50%, free slow hub regen, or first-heal-free) so a broke player isn't trapped in repeat deaths.

## Acceptance Criteria

- A player with 0 money who died on the previous run can realistically survive the next run start: respawn HP raised, free/over-time hub healing exists, or equivalent mitigation; design decision documented and covered by a test.

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
