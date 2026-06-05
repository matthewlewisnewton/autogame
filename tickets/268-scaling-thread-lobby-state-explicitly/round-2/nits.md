## Add Explicit-State Regression Tests For Migrated Helpers

The migrated progression helpers now accept explicit state arguments, but most existing unit coverage still calls the default global/context path. Adding a small set of tests with two distinct state objects would better protect the future concurrent-lobby goal from accidental fallback to `_gameState`.

### Acceptance Criteria

- Add focused server tests proving at least one migrated helper from each flow (shop/medic, card reward, run teardown) mutates or reads the explicitly supplied state rather than the module-level default.
