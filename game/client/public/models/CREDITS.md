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
- CC-BY attribution recorded here must also surface in-game credits before launch.

## Models

| File | Entity (registry key) | Source | License | Author / URL | Status |
|------|----------------------|--------|---------|--------------|--------|
| player.glb | player | Blender (original) | Original (project-owned) | autogame / Blender | parked — hero deferred to character-customization epic (181–188) |
| grunt.glb | grunt | Blender (original) | Original (project-owned) | autogame / Blender | placeholder (v1) |

<!-- Add new rows on import. Examples of the two approved external sources:
| skirmisher.glb | skirmisher | Quaternius — "Ultimate Monsters" | CC0 | https://quaternius.com/ | placeholder |
| miniboss.glb  | miniboss  | Sketchfab — <model name> by <author> | CC-BY 4.0 | <model url> | placeholder (ATTRIBUTION REQUIRED) |
-->

## Approved sources

- **Quaternius** (https://quaternius.com/) — CC0 low-poly character/monster packs. No attribution required, but record the pack name + URL anyway.
- **Sketchfab** (https://sketchfab.com/) — **only** models filtered to CC0 / CC-BY that are downloadable. Record author + model URL + exact license. (Requires enabling the Sketchfab integration in the BlenderMCP panel + an API key.)
- **Kenney** (https://kenney.nl/) / **Poly Pizza** (https://poly.pizza/) / **OpenGameArt** (license-filtered) — additional CC0/CC-BY fallbacks.

## Replacing placeholders

When a final asset lands, swap the file, update the row's `Source`/`License`/
`Author`/`Status` (→ `final`), and drop any now-unneeded CC-BY attribution.
