# Add Key Items Tab Button and Panel to Lobby HTML

Add a "Key Items" tab button in `#lobby-tabs` and a corresponding `#key-item-loadout` panel inside `#lobby` (sibling of `#deck-editor`, `#photon-forge`, etc.). The panel contains a scrollable list container, an error message div, and a short cooldown-rule hint. Panel is hidden by default; revealed when the tab is selected.

## Acceptance Criteria

- `#lobby-tabs` contains a new `<button id="lobby-tab-keyitems">` with label "Key Items"
- `#lobby` contains a `<div id="key-item-loadout" class="hidden">` panel with:
  - `<h3>` heading "Key Items"
  - `<p class="key-item-hint">` explaining cooldown / equip-one rule
  - `<div id="key-item-list">` container (empty, populated by JS in next sub-ticket)
  - `<div id="key-item-error" style="display:none;">` for error states
- New CSS in `style.css` for `#key-item-loadout`, `.key-item-entry`, `.key-item-entry.equipped`, and `.key-item-hint` — following the visual style of `.owned-card-entry` and `#guild-medic`
- The panel uses the same `.hidden` class toggle pattern as `#photon-forge` and `#card-shop`

## Technical Specs

- **File**: `game/client/index.html`
  - Add `<button id="lobby-tab-keyitems" class="lobby-tab" type="button">Key Items</button>` after the Medic tab button inside `#lobby-tabs`
  - Add `#key-item-loadout` panel div after `#guild-medic` and before `#suspended-run-banner` (or last panel)
- **File**: `game/client/style.css`
  - Add `#key-item-loadout` container rules (padding, max-height, overflow-y: auto)
  - Add `.key-item-entry` rules (flex row, dark bg, border, padding — mirror `.owned-card-entry`)
  - Add `.key-item-entry.equipped` rules (highlighted border/bg to indicate selection)
  - Add `.key-item-entry .key-item-name`, `.key-item-entry .key-item-desc`, `.key-item-entry .key-item-cooldown` sub-element styles
  - Add `.key-item-hint` style (small muted text, same as `.settings-hint`)
  - Add `.key-item-error` style (same as `.settings-error` / `#deck-error`)

## Verification: code
