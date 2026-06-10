# Level-map edges (prerequisite graph, converging boss edges)

Extend `game/client/levelMap.js` so `renderLevelMap` also draws EDGES of the
unlock graph: one edge from each prerequisite node to every node that requires
it. Gated boss levels with multiple prerequisites show their multiple
requirement edges converging on the boss node.

## Acceptance Criteria

- `renderLevelMap` (from sub-ticket 01) now renders, in addition to the node
  boxes, one edge element per `(prerequisite → dependent)` relationship found in
  the graph's `unlockRequires` arrays.
- A node whose `unlockRequires` lists N prerequisites produces N edges ending at
  that node (so a 2-prereq boss node shows 2 converging edges; a 3-prereq node
  shows 3).
- The total number of rendered edges equals the sum of `unlockRequires.length`
  over all nodes (nodes with `null`/empty `unlockRequires` contribute 0).
- Each edge element identifies its endpoints in a checkable way (e.g. SVG
  `<line>`/`<path>` with `data-from="<questId>:<tier>"` and
  `data-to="<questId>:<tier>"`), so an edge connects the prerequisite node to
  the requiring node and points left-to-right (from a lower column to a higher
  column).
- Edges are rendered behind the node boxes (do not intercept node clicks) and do
  not throw when a prerequisite reference has no matching node (that dangling
  edge is simply skipped).
- A helper `computeLevelMapEdges(graph)` is exported and returns the array of
  `{ from: {questId, tier}, to: {questId, tier} }` edge descriptors used by the
  renderer.

## Technical Specs

- Edit `game/client/levelMap.js`:
  - Add `computeLevelMapEdges(graph)`: for each node, for each entry in its
    `unlockRequires`, emit `{ from: prereq, to: { questId, tier } }`; skip
    entries whose `from` has no matching node.
  - In `renderLevelMap`, create an SVG layer (e.g. `<svg class="level-map-edges">`)
    appended first (below the node layer), and append one `<line>`/`<path>` per
    edge with `data-from`/`data-to` attributes. Endpoint coordinates may be
    derived from each node's `column`/`row` layout (a schematic straight line
    between the two columns is sufficient — pixel precision is not required).
  - Ensure the SVG layer has `pointer-events: none` (in CSS) so node buttons
    stay clickable.
- `game/client/style.css`: add `.level-map-edges` (absolute/overlay,
  `pointer-events: none`) and an edge stroke style.
- Extend `game/client/test/levelMap.test.js`: assert
  `computeLevelMapEdges(graph)` length equals the sum of `unlockRequires.length`;
  assert a 2-prereq boss node yields exactly 2 edges both ending at the boss
  (`data-to`); assert a dangling prereq reference yields no edge; assert the SVG
  edge layer does not capture clicks (still able to select a node).

## Verification: code
