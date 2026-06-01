# Add useKeyItem Input Action and Keyboard Default

Register a new `useKeyItem` action in `input.js` with keyboard default **E** and edge-triggered callback `onUseKeyItem`.

## Acceptance Criteria

- `ACTIONS.useKeyItem` exists in `game/client/input.js`
- `DEFAULT_KEYBOARD` includes `useKeyItem: ['e']`
- `onKeyDown` dispatches `useKeyItem` on `e` key press (fire-once, no repeat while held)
- `initInput` accepts `onUseKeyItem?: () => void` callback; callback fires once per press
- Action is guarded by `canUseGameActions()` (dungeon-only, not lobby menus)
- `getActionLabels()` returns a human-readable label for `useKeyItem` (e.g. "Use key item")

## Technical Specs

- **File**: `game/client/input.js`
  - Add `useKeyItem: 'useKeyItem'` to `ACTIONS` object
  - Add `useKeyItem: ['e']` to `DEFAULT_KEYBOARD`
  - In `onKeyDown`, after `e.repeat` guard and `canUseGameActions()` check, dispatch `callbacks.onUseKeyItem?.()` for the `useKeyItem` action (same pattern as `toggleDeckViewer`)
  - Add `onUseKeyItem?: () => void` to the `callbacks` type annotation and `initInput` opts JSDoc
  - Add `'useKeyItem': 'Use key item'` to `getActionLabels()` return object

## Verification: code
