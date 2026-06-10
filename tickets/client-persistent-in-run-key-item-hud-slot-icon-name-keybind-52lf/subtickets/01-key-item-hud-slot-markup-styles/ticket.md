# 01 — Key item HUD slot markup and styles

Replace the empty `#key-item-indicator` shell with a structured in-run HUD slot (icon badge, name label, keybind hint, cooldown overlay) and CSS that makes the slot visibly persistent when ready or on cooldown. This sub-ticket is markup and styling only — no render logic yet.

## Acceptance Criteria

- `game/client/index.html` `#key-item-indicator` contains child elements for icon, name, keybind, and cooldown (stable class names or ids documented in the ticket).
- `game/client/style.css` styles the slot as a compact HUD chip (top-right, near existing indicator position) with distinct **ready** (green ring) and **cooldown** (dimmed + countdown area) appearances; default/hidden state keeps `opacity: 0` or equivalent when the slot has no `.ready`/`.cooldown` class.
- Per-key-item icon badges are styled via `data-key-item-id` or `key-item-icon--<id>` classes using colors aligned with `renderer.js` `KEY_ITEM_*_COLOR` values (at minimum dodge_roll, guard_block, field_medic_kit, loot_magnet, summon_recall).
- Existing flash classes (`flash-success`, `flash-cooldown`, `flash-soft-fail`) still target `#key-item-indicator` and remain visually compatible with the new inner structure.
- No JavaScript behavior changes required in this sub-ticket.

## Technical Specs

- **`game/client/index.html`** — Expand `#key-item-indicator` (line ~61) into a small layout, e.g. `.key-item-hud-icon`, `.key-item-hud-name`, `.key-item-hud-keybind`, `.key-item-hud-cooldown` (exact names up to implementer; keep `#key-item-indicator` id).
- **`game/client/style.css`** — Replace/extend the `#key-item-indicator` block (~2009–2063): widen slot if needed for name + keybind text; add icon color rules per key item id; ensure `.ready` and `.cooldown` set `opacity: 1`; preserve flash gradient rules on the outer `#key-item-indicator`.

## Verification: code
