1. Per-avatar cloned glTF materials inherit the model-cache shared flag and leak on `disposeAvatar()`.
   Files: `game/client/renderer.js`, `game/client/models.js`, `game/client/test/model-dispose.test.js`
   Fix: After `retargetPlayerBodyMesh()` clones player body materials, clear `__modelCacheShared` from the cloned material userData; update the test fake or use real Three materials so cloned-material `userData` copying is covered.
