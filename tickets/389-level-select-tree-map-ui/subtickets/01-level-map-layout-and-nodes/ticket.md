# Level-map layout + node boxes (locked/unlocked/cleared)

Create a new pure client module `game/client/levelMap.js` that takes the
`levelUnlockGraph` payload from ticket 388 and (a) computes a left-to-right
layout where each node's column equals its prerequisite depth, and (b) renders
one styled BOX per node (one node per quest tier: level-1, level-2, and boss
tiers), with click-to-select wired for unlocked nodes only. Edges are NOT in
scope here (added in sub-ticket 02).

## Acceptance Criteria

- `game/client/levelMap.js` exists and exports `computeLevelMapLayout(graph)`
  and `renderLevelMap(container, graph, options)`.
- `computeLevelMapLayout(graph)` returns, for each node in `graph.nodes`, a
  layout entry carrying at least `{ questId, tier, column, row }`:
  - `column` is the node's **prerequisite depth**: a node with no
    `unlockRequires` (null or empty array) is `column: 0`; otherwise
    `column = 1 + max(column of each prerequisite node)`, where a prerequisite
    `{ questId, tier }` is matched to the node with the same `questId` AND `tier`.
  - Nodes sharing a column get distinct `row` values (0,1,2,…) so they don't
    overlap. The function does not crash on an empty/missing graph (returns an
    empty layout).
- `renderLevelMap(container, graph, options)` renders exactly one element per
  node into `container` (e.g. a `.level-map-node` button), positioned by its
  `column`/`row` from the layout (CSS grid/absolute via inline style or grid
  column/row), with the node's display name as text.
- Each node element carries a state class reflecting `node.state`: exactly one
  of `level-map-node-locked`, `level-map-node-unlocked`, or
  `level-map-node-cleared`; boss nodes (`node.isBoss === true`) additionally get
  a `level-map-node-boss` class; the node matching `options.selectedQuestId` +
  `options.selectedQuestTier` gets a `selected` class.
- Clicking a node whose state is `'unlocked'` or `'cleared'` invokes
  `options.onSelectNode(questId, tier)`; clicking a `'locked'` node does NOT
  invoke it (the element is disabled / guarded).
- Re-rendering with the same graph but a different `selectedQuestId` updates the
  `selected` class without throwing.

## Technical Specs

- New file `game/client/levelMap.js` (vanilla ES module, no Three.js):
  - `computeLevelMapLayout(graph)`: index nodes by `${questId}:${tier}`;
    compute `column` via memoized depth recursion over `unlockRequires`
    (guard against missing prereq references and cycles by treating an
    unresolved/visited prereq as depth 0). Assign `row` per column by insertion
    order.
  - `renderLevelMap(container, graph, { selectedQuestId, selectedQuestTier,
    onSelectNode } = {})`: clear/rebuild children (mirror the rebuild-key
    pattern in `questBoard.js` if convenient, but a simple `replaceChildren`
    rebuild is acceptable). Create a `<button class="level-map-node">` per node
    with `dataset.questId`/`dataset.questTier`, the state/boss/selected classes,
    and `disabled` when locked. Bind a single delegated `click` handler on
    `container` that reads `dataset` and calls `onSelectNode` for
    non-locked nodes.
- `game/client/style.css`: add `.level-map`, `.level-map-node`, and the
  `-locked` / `-unlocked` / `-cleared` / `-boss` / `.selected` style rules
  (locked dimmed, unlocked normal, cleared accented, boss emphasized). Keep it
  consistent with existing `.quest-card` styling tokens.
- Add `game/client/test/levelMap.test.js` (vitest + jsdom, mirror
  `test/questBoard.test.js` setup): build a small sample graph with a tier-1
  node (no prereqs), a tier-2 node requiring it, and a boss node requiring two
  prereqs; assert columns (0, 1, 2), one rendered element per node, correct
  state/boss/selected classes, that clicking an unlocked node fires
  `onSelectNode` with the right `(questId, tier)`, and that clicking a locked
  node does not.

## Verification: code
