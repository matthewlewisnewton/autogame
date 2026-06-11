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
	it('returns empty lines for non-stage_boss objectives', () => {
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
