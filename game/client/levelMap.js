/**
 * Level-map helpers — pure functions for the left-to-right level-select tree.
 *
 * Consumes the `levelUnlockGraph` payload from the server (ticket 388):
 *   { nodes: [{ questId, tier, name, objectiveType, isBoss,
 *               unlockRequires: [{ questId, tier }] | null,
 *               state: 'locked' | 'unlocked' | 'cleared' }] }
 *
 * Layout places each node in a column equal to its prerequisite depth and a
 * distinct row within that column. Edges between nodes are out of scope here
 * (added in sub-ticket 02).
 */

const NODE_STATE_CLASS = {
	locked: 'level-map-node-locked',
	unlocked: 'level-map-node-unlocked',
	cleared: 'level-map-node-cleared',
};

function nodeKey(questId, tier) {
	return `${questId}:${tier ?? 1}`;
}

/**
 * Compute a left-to-right layout for the level-unlock graph.
 *
 * `column` is the node's prerequisite depth: a node with no prerequisites is
 * column 0; otherwise `column = 1 + max(column of each prerequisite)`. A
 * prerequisite `{ questId, tier }` is matched to the node with the same
 * `questId` AND `tier`; unresolved or cyclic prerequisites are treated as
 * depth 0. Nodes sharing a column receive distinct `row` values (0,1,2,…) in
 * insertion order.
 *
 * @param {{ nodes?: Array<object> }} graph
 * @returns {Array<{ questId: string, tier: number, column: number, row: number,
 *   name: string, state: string, isBoss: boolean }>}
 */
export function computeLevelMapLayout(graph) {
	const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
	if (nodes.length === 0) return [];

	const byKey = new Map();
	for (const node of nodes) {
		byKey.set(nodeKey(node.questId, node.tier), node);
	}

	const columnCache = new Map();

	function columnFor(node, visiting) {
		const key = nodeKey(node.questId, node.tier);
		if (columnCache.has(key)) return columnCache.get(key);
		// Cycle guard: a prerequisite we are already resolving contributes 0.
		if (visiting.has(key)) return 0;

		const prereqs = Array.isArray(node.unlockRequires) ? node.unlockRequires : [];
		if (prereqs.length === 0) {
			columnCache.set(key, 0);
			return 0;
		}

		visiting.add(key);
		let maxPrereqColumn = -1;
		for (const prereq of prereqs) {
			const prereqNode = byKey.get(nodeKey(prereq.questId, prereq.tier));
			// Unresolved prerequisite reference → treat as depth 0.
			const prereqColumn = prereqNode ? columnFor(prereqNode, visiting) : 0;
			if (prereqColumn > maxPrereqColumn) maxPrereqColumn = prereqColumn;
		}
		visiting.delete(key);

		const column = maxPrereqColumn + 1;
		columnCache.set(key, column);
		return column;
	}

	const rowCounters = new Map();
	const layout = [];
	for (const node of nodes) {
		const column = columnFor(node, new Set());
		const row = rowCounters.get(column) ?? 0;
		rowCounters.set(column, row + 1);
		layout.push({
			questId: node.questId,
			tier: node.tier ?? 1,
			column,
			row,
			name: node.name,
			state: node.state,
			isBoss: node.isBoss === true,
		});
	}

	return layout;
}

function classListForNode(entry, node, selectedQuestId, selectedQuestTier) {
	const classes = ['level-map-node'];
	classes.push(NODE_STATE_CLASS[node.state] || NODE_STATE_CLASS.locked);
	if (node.isBoss === true) classes.push('level-map-node-boss');
	if (
		entry.questId === selectedQuestId
		&& entry.tier === (selectedQuestTier ?? 1)
	) {
		classes.push('selected');
	}
	return classes;
}

function levelMapStructureKey(layout) {
	return layout
		.map((e) => `${e.questId}:${e.tier}:${e.column}:${e.row}:${e.state}:${e.isBoss ? 1 : 0}`)
		.join('\0');
}

function bindLevelMapSelection(container, onSelectNode) {
	if (container._levelMapSelectHandler) {
		container.removeEventListener('click', container._levelMapSelectHandler);
		container._levelMapSelectHandler = null;
	}
	if (typeof onSelectNode !== 'function') return;
	const handler = (event) => {
		const el = event.target.closest('.level-map-node');
		if (!el || !container.contains(el)) return;
		if (el.disabled || el.classList.contains('level-map-node-locked')) return;
		const questId = el.dataset.questId;
		const tier = Number(el.dataset.questTier) || 1;
		onSelectNode(questId, tier);
	};
	container.addEventListener('click', handler);
	container._levelMapSelectHandler = handler;
}

function updateLevelMapSelection(container, selectedQuestId, selectedQuestTier) {
	container.querySelectorAll('.level-map-node').forEach((el) => {
		const tier = Number(el.dataset.questTier) || 1;
		const selected =
			el.dataset.questId === selectedQuestId
			&& tier === (selectedQuestTier ?? 1);
		el.classList.toggle('selected', selected);
	});
}

/**
 * Render one styled box per node into `container`, positioned by its
 * `column`/`row` from the layout. Only unlocked/cleared nodes are clickable;
 * locked nodes are disabled.
 *
 * @param {HTMLElement} container
 * @param {{ nodes?: Array<object> }} graph
 * @param {{ selectedQuestId?: string, selectedQuestTier?: number,
 *   onSelectNode?: (questId: string, tier: number) => void }} [options]
 */
export function renderLevelMap(
	container,
	graph,
	{ selectedQuestId, selectedQuestTier = 1, onSelectNode } = {},
) {
	if (!container) return;

	container.classList.add('level-map');
	bindLevelMapSelection(container, onSelectNode);

	const layout = computeLevelMapLayout(graph);
	const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
	const nodeByKey = new Map(nodes.map((n) => [nodeKey(n.questId, n.tier), n]));

	if (layout.length === 0) {
		container.replaceChildren();
		container.dataset.levelMapKey = '';
		return;
	}

	const structureKey = levelMapStructureKey(layout);
	const existing = container.querySelectorAll('.level-map-node');
	if (
		container.dataset.levelMapKey === structureKey
		&& existing.length === layout.length
	) {
		// Same structure: only the selection may have changed.
		updateLevelMapSelection(container, selectedQuestId, selectedQuestTier);
		return;
	}

	container.replaceChildren();

	for (const entry of layout) {
		const node = nodeByKey.get(nodeKey(entry.questId, entry.tier)) || entry;
		const locked = node.state === 'locked';

		const el = document.createElement('button');
		el.type = 'button';
		el.className = classListForNode(entry, node, selectedQuestId, selectedQuestTier).join(' ');
		el.dataset.questId = entry.questId;
		el.dataset.questTier = String(entry.tier);
		el.disabled = locked;
		// 1-based CSS grid lines from 0-based layout indices.
		el.style.gridColumn = String(entry.column + 1);
		el.style.gridRow = String(entry.row + 1);
		el.textContent = entry.name || entry.questId;

		container.appendChild(el);
	}

	container.dataset.levelMapKey = structureKey;
}
