# Client: persistent in-run key item HUD slot (icon, name, keybind, cooldown) — currently invisible when ready

## Difficulty: medium

## Goal

The in-run key item UI is a single #key-item-indicator div (game/client/index.html:61) that is EMPTY when the item is ready (updateKeyItemCooldownHud at game/client/main.js:3463-3475 sets textContent='' off cooldown) and shows only a bare seconds number during cooldown, plus transient flash classes on use (main.js:3439). Players (and QA screenshots) see no indication of which key item is equipped, that one exists at all, or how to trigger it. Build a persistent HUD slot shown whenever the local player has equippedKeyItemId during play: key item name and/or icon, the bound key/button hint (settings expose use-key-item binding, index.html:399), a ready state, and the cooldown countdown (numeric or radial sweep) reusing getKeyItemCooldownRemainingMs (main.js:3455). Keep the existing flash-success/soft-fail/cooldown feedback. Hidden when nothing is equipped or outside gameplay (clearKeyItemCooldownHud path). Found during live-view screenshot review 2026-06-09.

## Acceptance Criteria

- With a key item equipped, the HUD shows its name/icon and keybind while playing, including when ready (not just during cooldown); cooldown remaining renders as countdown; indicator hidden when no key item equipped or not in a run; existing key item flash feedback preserved; client tests cover ready, cooldown, and unequipped states

## Verification

Run the harness checks (vitest server+client) and verify the acceptance criteria above.
