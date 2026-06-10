## Target Frost Wave-Cleared Dialogue More Explicitly

`frost_crossing` has an `onWaveCleared` beacon for the first ice-band thrower wave that uses `band: 'ice'` and `waveIndex: 0`, but `matchesWaveCleared()` currently ignores `band`. This can make the Rimecast setup line eligible when any room's wave 0 clears; the authored arc would be clearer if wave-cleared beacons either honored `band` or the frost beacon targeted the resolved ice room directly.

### Acceptance Criteria
- The "First thrower line is down" frost dialogue only fires after the first ice-band thrower wave is cleared, not after the stone dock wave.
