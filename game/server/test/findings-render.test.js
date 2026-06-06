import { describe, it, expect } from 'vitest';
import { renderFindings } from '../../../harness/validate/lib/findings.mjs';

const baseRun = {
	ok: true,
	preset: 'open-plaza',
	assertions: {
		bossSpawned: true,
		encounterActivated: true,
		bossDefeated: true,
		victoryFired: true,
	},
};

describe('renderFindings preset copy', () => {
	it('uses open-plaza findingsTitle and bossSpawnLabel from the preset', () => {
		const md = renderFindings({
			...baseRun,
			findingsTitle: 'Open Plaza validation findings',
			bossSpawnLabel: 'arena_champion (Arena Champion)',
		});
		expect(md).toMatch(/^# Open Plaza validation findings/m);
		expect(md).toContain('**bossSpawned (arena_champion (Arena Champion))**: PASS');
		expect(md).not.toContain('Rooms validation findings');
		expect(md).not.toContain('annex_overseer');
	});

	it('keeps rooms title and boss label when passed from preset', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'rooms',
			findingsTitle: 'Rooms validation findings',
			bossSpawnLabel: 'annex_overseer (Annex Overseer)',
		});
		expect(md).toMatch(/^# Rooms validation findings/m);
		expect(md).toContain('**bossSpawned (annex_overseer (Annex Overseer))**: PASS');
	});

	it('keeps sunken-canyon title and boss label when passed from preset', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'sunken-canyon',
			findingsTitle: 'Sunken Canyon validation findings',
			bossSpawnLabel: 'miniboss (Canyon Warden)',
		});
		expect(md).toMatch(/^# Sunken Canyon validation findings/m);
		expect(md).toContain('**bossSpawned (miniboss (Canyon Warden))**: PASS');
	});

	it('falls back to formatted preset name and bossType when labels are absent', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'open-plaza',
			bossType: 'arena_champion',
		});
		expect(md).toMatch(/^# Open Plaza validation findings/m);
		expect(md).toContain('**bossSpawned (arena_champion)**: PASS');
	});
});
