import { describe, it, expect } from 'vitest';
import { formatRunObjectiveHudLines } from '../objectiveHud.js';

const FROST_CROSSING_TIER1 = {
	id: 'frost_crossing',
	questId: 'frost_crossing',
	name: 'Frost Crossing',
	objectiveType: 'stage_boss',
	encounter: { bossType: 'permafrost_warden', addCount: 0 },
	scriptedEncounters: {
		rooms: [
			{ roomIndex: 0, waves: [{ spawns: [{ type: 'grunt', count: 2 }] }] },
			{
				band: 'ice',
				waves: [
					{ spawns: [{ type: 'grunt', count: 1 }] },
					{ spawns: [{ type: 'grunt', count: 1 }] },
				],
			},
		],
	},
};

describe('formatRunObjectiveHudLines()', () => {
	it('returns empty lines for defeat_enemies objectives', () => {
		expect(formatRunObjectiveHudLines({
			run: { objective: { type: 'defeat_enemies' } },
		})).toEqual({ goalLine: '', secondLine: '' });
	});

	it('formats frost_crossing tier 1 with boss goal and scripted wave progress', () => {
		const { goalLine, secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'frost_crossing',
				questTier: 1,
				encounter: { phase: 'dormant', bossType: 'permafrost_warden' },
				objective: { type: 'stage_boss', bossDefeated: false, addCount: 0, totalEnemies: 1 },
				scriptedEncounter: {
					rooms: {
						'room:0': { waveIndex: 0, cleared: false, started: true },
						'band:ice': { waveIndex: -1, cleared: false, started: false },
					},
				},
				_scriptedEncounterConfig: FROST_CROSSING_TIER1.scriptedEncounters,
			},
			questMeta: FROST_CROSSING_TIER1,
		});

		expect(goalLine).toBe('Defeat the Permafrost Warden');
		expect(secondLine).toContain('Defeat the Permafrost Warden');
		expect(secondLine).toContain('Waves cleared 0 / 3');
	});

	it('shows support clearance for stage_boss runs with adds', () => {
		const { secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'training_caverns',
				questTier: 2,
				encounter: { phase: 'active', bossType: 'annex_overseer', addCount: 4 },
				objective: {
					type: 'stage_boss',
					bossDefeated: false,
					addCount: 4,
					totalEnemies: 5,
					defeatedEnemies: 2,
				},
			},
			questMeta: {
				questId: 'training_caverns',
				tier: 2,
				objectiveType: 'stage_boss',
				encounter: { bossType: 'annex_overseer', addCount: 4 },
			},
		});

		expect(secondLine).toContain('Defeat the annex overseer');
		expect(secondLine).toContain('Supports cleared 2 / 4');
	});

	it('shows completion when the boss is defeated', () => {
		const { secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'frost_crossing',
				encounter: { phase: 'cleared', bossType: 'permafrost_warden' },
				objective: { type: 'stage_boss', bossDefeated: true },
			},
			questMeta: FROST_CROSSING_TIER1,
		});

		expect(secondLine).toContain('Defeat the Permafrost Warden');
		expect(secondLine).toContain('Warden defeated');
	});

	it('counts cleared scripted waves across rooms', () => {
		const { secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'frost_crossing',
				objective: { type: 'stage_boss', bossDefeated: false },
				scriptedEncounter: {
					rooms: {
						'room:0': { waveIndex: 0, cleared: true, started: true },
						'band:ice': { waveIndex: 1, cleared: false, started: true },
					},
				},
				_scriptedEncounterConfig: FROST_CROSSING_TIER1.scriptedEncounters,
			},
			questMeta: FROST_CROSSING_TIER1,
		});

		expect(secondLine).toContain('Waves cleared 2 / 3');
	});
});

const ANNEX_ESCORT_TIER1 = {
	id: 'annex_escort',
	questId: 'annex_escort',
	name: 'Annex Evacuation',
	objectiveType: 'escort',
	escortNpc: { name: 'Archivist Vale', maxHp: 70 },
	escortDestination: { roomRole: 'treasure' },
};

describe('formatRunObjectiveHudLines() escort', () => {
	it('formats annex_escort tier 1 with NPC goal and partial ambush progress', () => {
		const { goalLine, secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'annex_escort',
				questName: 'Annex Evacuation',
				questTier: 1,
				escort: { npcName: 'Archivist Vale', atDestination: false, failed: false },
				objective: {
					type: 'escort',
					totalEnemies: 4,
					defeatedEnemies: 1,
					reachedDestination: false,
				},
			},
			questMeta: ANNEX_ESCORT_TIER1,
		});

		expect(goalLine).toBe('Escort Archivist Vale to treasure');
		expect(secondLine).toContain('Archivist Vale');
		expect(secondLine).toContain('ambush 1 / 4 cleared');
	});

	it('appends destination reached when the escort arrives', () => {
		const { secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'annex_escort',
				escort: { npcName: 'Archivist Vale', atDestination: true, failed: false },
				objective: {
					type: 'escort',
					totalEnemies: 4,
					defeatedEnemies: 2,
					reachedDestination: true,
				},
			},
			questMeta: ANNEX_ESCORT_TIER1,
		});

		expect(secondLine).toContain('ambush 2 / 4 cleared');
		expect(secondLine).toContain('destination reached');
	});

	it('shows en route to extract when ambushes are cleared but not at destination', () => {
		const { secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'annex_escort',
				escort: { npcName: 'Archivist Vale', atDestination: false, failed: false },
				objective: {
					type: 'escort',
					totalEnemies: 4,
					defeatedEnemies: 4,
					reachedDestination: false,
				},
			},
			questMeta: ANNEX_ESCORT_TIER1,
		});

		expect(secondLine).toContain('ambush 4 / 4 cleared');
		expect(secondLine).toContain('en route to extract');
	});

	it('surfaces escort failure instead of ambush progress', () => {
		const { secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'annex_escort',
				escort: { npcName: 'Archivist Vale', failed: true },
				objective: {
					type: 'escort',
					escortFailed: true,
					label: 'Archivist Vale was lost — escort failed',
					totalEnemies: 4,
					defeatedEnemies: 1,
				},
			},
			questMeta: ANNEX_ESCORT_TIER1,
		});

		expect(secondLine).toContain('Archivist Vale');
		expect(secondLine).toContain('escort failed');
		expect(secondLine).not.toContain('ambush');
	});

	it('falls back to run escort NPC name when quest metadata is unavailable', () => {
		const { goalLine, secondLine } = formatRunObjectiveHudLines({
			run: {
				escort: { npcName: 'Archivist Vale', atDestination: false, failed: false },
				objective: {
					type: 'escort',
					totalEnemies: 2,
					defeatedEnemies: 0,
				},
			},
		});

		expect(goalLine).toBe('Escort Archivist Vale');
		expect(secondLine).toContain('ambush 0 / 2 cleared');
	});
});

const ENDLESS_SIEGE_TIER1 = {
	id: 'endless_siege',
	questId: 'endless_siege',
	name: 'Endless Siege',
	objectiveType: 'survive',
	totalSpawns: 10,
	minibossCount: 2,
};

describe('formatRunObjectiveHudLines() survive', () => {
	it('formats endless_siege tier 1 with goal and purge progress', () => {
		const { goalLine, secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'endless_siege',
				questName: 'Endless Siege',
				questTier: 1,
				objective: {
					type: 'survive',
					totalSpawns: 10,
					minibossCount: 2,
					spawnedEnemies: 10,
					defeatedEnemies: 3,
					totalEnemies: 10,
				},
			},
			questMeta: ENDLESS_SIEGE_TIER1,
		});

		expect(goalLine).toBe('Survive 10 hostiles (2 minibosses)');
		expect(secondLine).toContain('Survive 10 hostiles (2 minibosses)');
		expect(secondLine).toContain('Purged 3 / 10 hostiles');
		expect(secondLine).not.toContain('spawned');
	});

	it('prefixes spawn wave progress while attackers are still inbound', () => {
		const { secondLine } = formatRunObjectiveHudLines({
			run: {
				questId: 'endless_siege',
				objective: {
					type: 'survive',
					totalSpawns: 10,
					minibossCount: 2,
					spawnedEnemies: 4,
					defeatedEnemies: 2,
					totalEnemies: 10,
				},
			},
			questMeta: ENDLESS_SIEGE_TIER1,
		});

		expect(secondLine).toContain('Wave 4 / 10 spawned');
		expect(secondLine).toContain('Purged 2 / 10 hostiles');
	});

	it('falls back to objective totals when quest metadata is unavailable', () => {
		const { goalLine, secondLine } = formatRunObjectiveHudLines({
			run: {
				objective: {
					type: 'survive',
					totalSpawns: 8,
					minibossCount: 1,
					spawnedEnemies: 3,
					defeatedEnemies: 1,
					totalEnemies: 8,
				},
			},
		});

		expect(goalLine).toBe('Survive 8 hostiles (1 minibosses)');
		expect(secondLine).toContain('Wave 3 / 8 spawned');
		expect(secondLine).toContain('Purged 1 / 8 hostiles');
	});
});
