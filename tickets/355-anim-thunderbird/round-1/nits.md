## Remove dead `renderChainLightning` function
Before this ticket, `renderChainLightning` (game/client/cardRenderers.js:1104) was thunderbird's strike renderer. Thunderbird now uses `renderThunderbirdStrike`, and the `chain_lightning` spell card maps to the separate `renderChainLightningArcs`. The function is no longer referenced or exported anywhere — it is dead code. Its docstring claims it serves "legacy specialEffect paths not tied to a dedicated card renderer," but no such path exists.

### Acceptance Criteria
- Confirm `renderChainLightning` is referenced by no `CARD_RENDERERS` entry and not exported.
- Remove the unused `renderChainLightning` function (or, if a real fallback caller is found, wire it and document that caller).
- `cardRenderers.test.js` and the full client suite still pass.
