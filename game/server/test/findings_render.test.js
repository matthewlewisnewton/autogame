import { describe, expect, it } from 'vitest';
import { renderFindings } from '../../../harness/validate/lib/findings.mjs';

const baseRun = {
	ok: true,
	assertions: {
		bossSpawned: true,
		encounterActivated: true,
		bossDefeated: true,
		victoryFired: true,
	},
};

describe('renderFindings', () => {
	it('uses annex_overseer and Rooms title for rooms preset', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'rooms',
			bossType: 'annex_overseer',
		});
		expect(md).toContain('# Rooms validation findings');
		expect(md).toContain('**bossSpawned (annex_overseer)**: PASS');
		expect(md).not.toContain('spire_warden');
	});

	it('uses spire preset findingsTitle and bossSpawnLabel', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'spire-ascent',
			findingsTitle: 'Spire Ascent validation findings',
			bossSpawnLabel: 'spire_warden (Summit Warden)',
			bossType: 'spire_warden',
		});
		expect(md).toContain('# Spire Ascent validation findings');
		expect(md).toContain('**bossSpawned (spire_warden (Summit Warden))**: PASS');
		expect(md).not.toContain('annex_overseer');
		expect(md).not.toContain('Canyon Warden');
	});

	it('flags wrong boss display name in boss encounter UI section using preset metadata', () => {
		const md = renderFindings({
			...baseRun,
			preset: 'spire-ascent',
			bossSpawnLabel: 'spire_warden (Summit Warden)',
			bossType: 'spire_warden',
			bossEncounterUi: {
				hudVisible: true,
				bossName: 'Canyon Warden',
				hpFillWidthPct: 100,
				encounterLocked: true,
				encounterPhase: 'active',
			},
		});
		expect(md).toContain('expected "Summit Warden" display name');
		expect(md).not.toContain('annex_overseer');
	});
});
