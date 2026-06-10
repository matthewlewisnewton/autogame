import { describe, it, expect, beforeEach } from 'vitest';
import { computeLevelMapLayout, computeLevelMapEdges, renderLevelMap } from '../levelMap.js';

// Sample graph mirroring the ticket-388 levelUnlockGraph payload shape:
// a tier-1 node with no prereqs, a tier-2 node requiring it, and a boss node
// requiring two prerequisites.
const SAMPLE_GRAPH = {
	nodes: [
		{
			questId: 'training_caverns',
			tier: 1,
			name: 'Initiate Vault',
			objectiveType: 'defeat_enemies',
			isBoss: false,
			unlockRequires: null,
			state: 'unlocked',
		},
		{
			questId: 'training_caverns',
			tier: 2,
			name: 'Initiate Vault — Tier II',
			objectiveType: 'defeat_enemies',
			isBoss: false,
			unlockRequires: [{ questId: 'training_caverns', tier: 1 }],
			state: 'locked',
		},
		{
			questId: 'arena_trials',
			tier: 2,
			name: 'Arena Apex',
			objectiveType: 'stage_boss',
			isBoss: true,
			unlockRequires: [
				{ questId: 'training_caverns', tier: 2 },
				{ questId: 'training_caverns', tier: 1 },
			],
			state: 'cleared',
		},
	],
};

describe('computeLevelMapLayout()', () => {
	it('assigns columns by prerequisite depth (0, 1, 2)', () => {
		const layout = computeLevelMapLayout(SAMPLE_GRAPH);
		const at = (questId, tier) =>
			layout.find((e) => e.questId === questId && e.tier === tier);

		expect(at('training_caverns', 1).column).toBe(0);
		expect(at('training_caverns', 2).column).toBe(1);
		expect(at('arena_trials', 2).column).toBe(2);
	});

	it('gives nodes in the same column distinct rows', () => {
		const graph = {
			nodes: [
				{ questId: 'a', tier: 1, name: 'A', isBoss: false, unlockRequires: null, state: 'unlocked' },
				{ questId: 'b', tier: 1, name: 'B', isBoss: false, unlockRequires: null, state: 'unlocked' },
			],
		};
		const layout = computeLevelMapLayout(graph);
		expect(layout.map((e) => e.column)).toEqual([0, 0]);
		expect(layout.map((e) => e.row)).toEqual([0, 1]);
	});

	it('treats unresolved or cyclic prerequisites as depth 0 without crashing', () => {
		const graph = {
			nodes: [
				// Missing prereq reference.
				{ questId: 'orphan', tier: 1, name: 'Orphan', isBoss: false, unlockRequires: [{ questId: 'ghost', tier: 9 }], state: 'locked' },
				// Mutual cycle.
				{ questId: 'x', tier: 1, name: 'X', isBoss: false, unlockRequires: [{ questId: 'y', tier: 1 }], state: 'locked' },
				{ questId: 'y', tier: 1, name: 'Y', isBoss: false, unlockRequires: [{ questId: 'x', tier: 1 }], state: 'locked' },
			],
		};
		const layout = computeLevelMapLayout(graph);
		expect(layout.find((e) => e.questId === 'orphan').column).toBe(1);
		// Cycle members resolve to finite columns, not Infinity/NaN.
		for (const e of layout) {
			expect(Number.isFinite(e.column)).toBe(true);
		}
	});

	it('returns an empty layout for an empty or missing graph', () => {
		expect(computeLevelMapLayout({ nodes: [] })).toEqual([]);
		expect(computeLevelMapLayout({})).toEqual([]);
		expect(computeLevelMapLayout(null)).toEqual([]);
	});
});

describe('computeLevelMapEdges()', () => {
	it('emits one edge per unlockRequires entry across all nodes', () => {
		const edges = computeLevelMapEdges(SAMPLE_GRAPH);
		const expected = SAMPLE_GRAPH.nodes.reduce(
			(sum, n) => sum + (Array.isArray(n.unlockRequires) ? n.unlockRequires.length : 0),
			0,
		);
		expect(edges.length).toBe(expected);
		expect(edges.length).toBe(3);
	});

	it('points each edge from its prerequisite to the requiring node', () => {
		const edges = computeLevelMapEdges(SAMPLE_GRAPH);
		// The tier-2 node requires the tier-1 node.
		expect(edges).toContainEqual({
			from: { questId: 'training_caverns', tier: 1 },
			to: { questId: 'training_caverns', tier: 2 },
		});
	});

	it('yields one edge per prerequisite of a multi-prereq boss node', () => {
		const edges = computeLevelMapEdges(SAMPLE_GRAPH);
		const bossEdges = edges.filter(
			(e) => e.to.questId === 'arena_trials' && e.to.tier === 2,
		);
		expect(bossEdges.length).toBe(2);
	});

	it('skips dangling prerequisite references', () => {
		const graph = {
			nodes: [
				{ questId: 'orphan', tier: 1, name: 'Orphan', isBoss: false, unlockRequires: [{ questId: 'ghost', tier: 9 }], state: 'locked' },
			],
		};
		expect(computeLevelMapEdges(graph)).toEqual([]);
	});

	it('returns an empty array for an empty or missing graph', () => {
		expect(computeLevelMapEdges({ nodes: [] })).toEqual([]);
		expect(computeLevelMapEdges(null)).toEqual([]);
	});
});

describe('renderLevelMap()', () => {
	let container;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
	});

	it('renders exactly one node element per graph node with its name', () => {
		renderLevelMap(container, SAMPLE_GRAPH);
		const nodes = container.querySelectorAll('.level-map-node');
		expect(nodes.length).toBe(3);
		expect([...nodes].map((n) => n.textContent)).toEqual([
			'Initiate Vault',
			'Initiate Vault — Tier II',
			'Arena Apex',
		]);
	});

	it('positions nodes by column/row from the layout', () => {
		renderLevelMap(container, SAMPLE_GRAPH);
		const boss = container.querySelector('[data-quest-id="arena_trials"]');
		// arena_trials is column 2 (grid line 3), row 0 (grid line 1).
		expect(boss.style.gridColumn).toBe('3');
		expect(boss.style.gridRow).toBe('1');
	});

	it('applies exactly one state class, boss, and selected classes', () => {
		renderLevelMap(container, SAMPLE_GRAPH, {
			selectedQuestId: 'arena_trials',
			selectedQuestTier: 2,
		});

		const t1 = container.querySelector('[data-quest-id="training_caverns"][data-quest-tier="1"]');
		const t2 = container.querySelector('[data-quest-id="training_caverns"][data-quest-tier="2"]');
		const boss = container.querySelector('[data-quest-id="arena_trials"]');

		expect(t1.classList.contains('level-map-node-unlocked')).toBe(true);
		expect(t1.classList.contains('level-map-node-locked')).toBe(false);
		expect(t1.classList.contains('level-map-node-cleared')).toBe(false);

		expect(t2.classList.contains('level-map-node-locked')).toBe(true);
		expect(t2.disabled).toBe(true);

		expect(boss.classList.contains('level-map-node-cleared')).toBe(true);
		expect(boss.classList.contains('level-map-node-boss')).toBe(true);
		expect(boss.classList.contains('selected')).toBe(true);

		// Only the boss is boss/selected.
		expect(t1.classList.contains('level-map-node-boss')).toBe(false);
		expect(t1.classList.contains('selected')).toBe(false);
	});

	it('invokes onSelectNode for unlocked and cleared nodes', () => {
		const calls = [];
		renderLevelMap(container, SAMPLE_GRAPH, {
			onSelectNode: (questId, tier) => calls.push([questId, tier]),
		});

		container.querySelector('[data-quest-id="training_caverns"][data-quest-tier="1"]').click();
		container.querySelector('[data-quest-id="arena_trials"]').click();

		expect(calls).toEqual([
			['training_caverns', 1],
			['arena_trials', 2],
		]);
	});

	it('does not invoke onSelectNode for a locked node', () => {
		const calls = [];
		renderLevelMap(container, SAMPLE_GRAPH, {
			onSelectNode: (questId, tier) => calls.push([questId, tier]),
		});

		container.querySelector('[data-quest-id="training_caverns"][data-quest-tier="2"]').click();
		expect(calls).toEqual([]);
	});

	it('updates the selected class on re-render without throwing', () => {
		renderLevelMap(container, SAMPLE_GRAPH, {
			selectedQuestId: 'training_caverns',
			selectedQuestTier: 1,
		});
		expect(
			container.querySelector('[data-quest-id="training_caverns"][data-quest-tier="1"]').classList.contains('selected'),
		).toBe(true);

		renderLevelMap(container, SAMPLE_GRAPH, {
			selectedQuestId: 'arena_trials',
			selectedQuestTier: 2,
		});

		expect(
			container.querySelector('[data-quest-id="training_caverns"][data-quest-tier="1"]').classList.contains('selected'),
		).toBe(false);
		expect(
			container.querySelector('[data-quest-id="arena_trials"]').classList.contains('selected'),
		).toBe(true);
	});

	it('clears the container for an empty graph', () => {
		renderLevelMap(container, SAMPLE_GRAPH);
		renderLevelMap(container, { nodes: [] });
		expect(container.querySelectorAll('.level-map-node').length).toBe(0);
	});

	it('renders one edge line per unlockRequires entry, behind the nodes', () => {
		renderLevelMap(container, SAMPLE_GRAPH);
		const lines = container.querySelectorAll('.level-map-edges line');
		expect(lines.length).toBe(3);
		// The edge layer is the first child so it paints behind the node boxes.
		expect(container.firstChild.classList.contains('level-map-edges')).toBe(true);
	});

	it('draws both converging edges ending at a 2-prereq boss node', () => {
		renderLevelMap(container, SAMPLE_GRAPH);
		const bossLines = container.querySelectorAll(
			'.level-map-edges line[data-to="arena_trials:2"]',
		);
		expect(bossLines.length).toBe(2);
		// Each edge points left-to-right (prereq column < boss column).
		const boss = container.querySelector('[data-quest-id="arena_trials"]');
		expect(boss.style.gridColumn).toBe('3');
		bossLines.forEach((line) => {
			expect(Number(line.getAttribute('x1'))).toBeLessThan(Number(line.getAttribute('x2')));
		});
	});

	it('skips dangling prerequisite edges without throwing', () => {
		const graph = {
			nodes: [
				{ questId: 'orphan', tier: 1, name: 'Orphan', isBoss: false, unlockRequires: [{ questId: 'ghost', tier: 9 }], state: 'unlocked' },
			],
		};
		expect(() => renderLevelMap(container, graph)).not.toThrow();
		expect(container.querySelectorAll('.level-map-edges line').length).toBe(0);
		expect(container.querySelectorAll('.level-map-node').length).toBe(1);
	});

	it('edge layer does not capture clicks (nodes stay selectable)', () => {
		const calls = [];
		renderLevelMap(container, SAMPLE_GRAPH, {
			onSelectNode: (questId, tier) => calls.push([questId, tier]),
		});

		const svg = container.querySelector('.level-map-edges');
		expect(svg.style.pointerEvents).toBe('none');

		// A node behind/around the edges is still clickable.
		container.querySelector('[data-quest-id="arena_trials"]').click();
		expect(calls).toEqual([['arena_trials', 2]]);
	});
});
