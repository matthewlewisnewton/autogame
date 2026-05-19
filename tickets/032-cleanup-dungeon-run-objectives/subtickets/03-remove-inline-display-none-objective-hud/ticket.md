# Remove inline `display:none` on objective HUD

`game/client/index.html` sets `style="display:none;"` on `#objective-hud` while the element's visibility is otherwise driven entirely by `updateObjectiveHud()` and CSS. The inline style is redundant once JS runs and duplicates CSS intent.

## Acceptance Criteria
- The `style="display:none;"` attribute is removed from `#objective-hud` in `index.html`
- The hidden-initial-state is expressed via CSS (e.g., `#objective-hud { display: none; }` in `style.css`) or JS (`updateObjectiveHud()` already handles visibility)
- The HUD still starts hidden on page load and shows correctly when objectives are active
- All existing tests pass

## Technical Specs
- **File:** `game/client/index.html` — remove `style="display:none;"` from the `#objective-hud` div (~line 29)
- **File:** `game/client/style.css` — add `#objective-hud { display: none; }` if not already present (verify `updateObjectiveHud()` doesn't depend on inline style)
- Verify that `updateObjectiveHud()` in the client JS properly toggles `display` based on objective state

## Verification: code
