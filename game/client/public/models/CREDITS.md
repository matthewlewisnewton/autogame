# Model Credits & Placeholder Ledger

Every 3D model under `game/client/public/models/` is tracked here. Most are
**temporary placeholders** to be replaced by a commissioned human 3D artist.

## Policy (read before adding a model)

- **Only redistributable licenses**: original work, **CC0**, or **CC-BY** (with
  attribution recorded below).
- **No ripped/copyrighted game assets** — no PSO/Sega, N64, Dreamcast, or other
  commercial game rips, even as "temporary" placeholders. They're infringing and
  a liability baked into git history.
- Every model file MUST have a row in the table below before it is wired into the
  model registry. Keep `Status` accurate so the artist-replacement pass is a
  simple filter on `placeholder`.
- CC-BY attribution recorded here must also surface in in-game credits before
  launch. (CC0 needs no attribution, but we record the source anyway.)

## Models

| File | Entity (registry key) | Source (creature) | License | URL | Status |
|------|----------------------|-------------------|---------|-----|--------|
| player.glb | player | Quaternius "Universal Base Characters" — Regular_Male (spike base) | CC0 | https://quaternius.com/packs/universalbasecharacters.html | spike — `player.glb` export pending (sub-ticket 03); contract in `game/docs/MODEL_SPIKE.md` |
| grunt.glb | grunt | Quaternius "Ultimate Monsters" — Orc | CC0 | https://quaternius.com/ | placeholder |
| skirmisher.glb | skirmisher | Quaternius "Ultimate Monsters" — Goleling | CC0 | https://quaternius.com/ | placeholder |
| miniboss.glb | miniboss | Quaternius "Ultimate Monsters" — Blue Demon | CC0 | https://quaternius.com/ | placeholder |
| spawner.glb | spawner | Quaternius "Ultimate Monsters" — Hywirl | CC0 | https://quaternius.com/ | placeholder |
| minion-ancient-wyrm.glb | minion:ancient_wyrm | Quaternius "Ultimate Monsters" — Dragon | CC0 | https://quaternius.com/ | placeholder |
| minion-null-crawler.glb | minion:null_crawler | Quaternius "Ultimate Monsters" — Squidle | CC0 | https://quaternius.com/ | placeholder |
| minion-bulkhead-mauler.glb | minion:bulkhead_mauler | Quaternius "Ultimate Monsters" — Goleling Evolved | CC0 | https://quaternius.com/ | placeholder |

Pack: **Quaternius — Ultimate Monsters Bundle** (CC0, 45 models), mirrored at
https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6 . All Quaternius
models are CC0 (public domain); rigged with animations (walk/attack/death) for
later use. These are placeholders pending a human 3D artist.

## Approved sources

- **Quaternius** (https://quaternius.com/) — CC0 low-poly character/monster packs.
- **Sketchfab** (https://sketchfab.com/) — **only** models filtered to CC0 / CC-BY
  that are downloadable. Record author + model URL + exact license. (Requires
  enabling the Sketchfab integration in the BlenderMCP panel + API key.)
- **Kenney** (https://kenney.nl/) / **Poly Pizza** (https://poly.pizza/) /
  **OpenGameArt** (license-filtered) — additional CC0/CC-BY fallbacks.

## Replacing placeholders

When a final asset lands, swap the file, update the row's `Source`/`License`/
`URL`/`Status` (→ `final`), and drop any now-unneeded CC-BY attribution.
