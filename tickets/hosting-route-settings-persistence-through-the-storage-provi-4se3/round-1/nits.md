## Cover settings.js provider-routing branches with a test

`game/server/settings.js` gained `if (_settingsProvider) { ... }` branches in
`getSettings` and `updateSettings` that delegate to `provider.loadSettings` /
`provider.saveSettings`. These branches are currently verified only by code
inspection and the startup wiring — no test calls `initSettingsWithProvider`
and then asserts that `getSettings`/`updateSettings` actually route to the
provider (and apply the accountId guard, oversize-on-read fallback, and
defaults-on-miss in that path). The provider methods themselves are well
tested, but the settings.js delegation is not.

### Acceptance Criteria
- A test sets a stub/InMemory provider via `initSettingsWithProvider`, then
  asserts `updateSettings` calls `provider.saveSettings` with the merged
  settings and `getSettings` returns what `provider.loadSettings` provides.
- A test asserts that when the provider returns `null`, `getSettings` returns
  default settings (parity with file-mode ENOENT).
- A test asserts the accountId sanitization still throws on an invalid id in
  the provider-routed path, and that `resetSettingsProvider` / `initSettingsPath`
  restore file-based behavior.
