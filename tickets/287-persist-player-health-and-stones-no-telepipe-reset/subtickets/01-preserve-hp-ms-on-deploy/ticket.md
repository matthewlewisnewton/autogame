# 01 — Preserve HP and magic stones on deploy

Stop redeploy and drop-in join from overwriting a player's existing `hp` and `magicStones`. New players may still receive defaults on their first sortie, but any player who already has finite vitals must keep them when `checkAllReady` starts a dungeon or `initializePlayerForActiveRun` sets up a mid-run drop-in.

## Acceptance Criteria

- `checkAllReady` fresh-deploy path does **not** assign `STARTING_MAGIC_STONES` when the player already has a finite `magicStones` value.
- `checkAllReady` fresh-deploy path does **not** reset `hp` when the player already has a finite positive `hp`.
- `initializePlayerForActiveRun` preserves existing `hp` and `magicStones` the same way (only default when null/undefined).
- Brand-new players with no prior vitals still get `STARTING_MAGIC_STONES` and `MAX_HP` on first deploy.
- New unit test in `game/server/test/server.test.js`: deploy with `hp: 42` and `magicStones: 15` → after `checkAllReady`, values are unchanged.

## Technical Specs

- **`game/server/progression.js`** — In `checkAllReadyInner` fresh-deploy branch (~line 3188), remove unconditional `player.magicStones = STARTING_MAGIC_STONES`; gate defaults behind `!Number.isFinite(player.magicStones)` (and similarly for `hp` if any reset exists). Do **not** change card/hand/deck initialization in this ticket.
- **`game/server/index.js`** — In `initializePlayerForActiveRun` (~line 1039), stop overwriting `magicStones`/`hp` when values are already finite; keep first-time defaults for null players.
- **`game/server/test/server.test.js`** — Add focused test(s) for deploy/drop-in vitals preservation; adjust any test that assumed every deploy resets MS to `STARTING_MAGIC_STONES` only if that assumption is now wrong for returning players.

## Verification: code
