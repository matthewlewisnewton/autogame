## Clarify the dangling comment in renderHealingFont
In `game/client/cardRenderers.js`, the inline comment above the `spawnParticleBurst`
call ("Optional emerald accent burst when the beacon effect is wired but the caller
still supplies the shared particle spawner.") reads awkwardly and no longer matches
the simplified branch. Tighten it to one clear sentence describing the optional accent burst.
### Acceptance Criteria
- The comment in `renderHealingFont` accurately and concisely describes why the extra `spawnParticleBurst` is fired.

## Heal motes get downward gravity that slightly fights the "ascending" intent
`spawnRestorationBeaconMotes` gives motes a strong upward velocity, but the shared
`isParticleBurst` update applies `- t*t*0.8` gravity, so late in life they decelerate/dip.
Visually fine, but if the "rising beacon" read is meant to be pure ascent, consider a
dedicated rise-without-gravity path or a gentler gravity term for these motes.
### Acceptance Criteria
- Heal motes visibly ascend for the full effect duration without a noticeable downward dip, OR a comment documents the intended arc.