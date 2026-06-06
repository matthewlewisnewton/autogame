import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_DEFS } from '../index.js';
import cardDefs from '../../shared/cardDefs.json';
import cardStats from '../../shared/cardStats.json';
import cardEconomy from '../../shared/cardEconomy.json';
import {
	CARD_DEF_KEYS,
	OVER_BUDGET_FACTOR,
	buildMetricsSnapshot,
	computeAllCardMetrics,
	findRewardOrderCollisions,
	flagPeerBandOutliers,
	getMsTier,
} from './helpers/cardBalanceMetrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = path.resolve(__dirname, '../../validation/card-balance/metrics-snapshot.json');

const REQUIRED_METRIC_FIELDS = [
	'id',
	'type',
	'charges',
	'magicStoneCost',
	'acquisition',
	'rewardOrder',
	'sellValue',
	'directDamage',
	'estimatedBurstDamage',
	'damagePerMsStone',
];

let snapshot;
let allMetrics;

beforeAll(() => {
	snapshot = buildMetricsSnapshot();
	allMetrics = Object.values(snapshot.cards);
});

/**
 * Peer-band thresholds (ticket 207 / 303):
 * - Group weapons, spells, creatures, and enchantments separately.
 * - Sub-group by MS tier: 0 / 1–35 / 36–50 / 51+.
 * - over-budget: comparison metric > peer-group max × 1.17 (~17% over T2 ceiling).
 * - under-budget: at peer-group min and ≥15% below group max (tier floor).
 * - Heal/support/enchantment utility cards use utilityScore instead of burst damage.
 */
describe('card balance metrics — shared JSON coverage', () => {
	it('cardDefs and cardStats keys match CARD_DEFS', () => {
		const defKeys = Object.keys(cardDefs).sort();
		const statKeys = Object.keys(cardStats).sort();
		const serverKeys = Object.keys(CARD_DEFS).sort();

		expect(defKeys).toEqual(serverKeys);
		expect(statKeys).toEqual(serverKeys);
		expect(CARD_DEF_KEYS).toEqual(serverKeys);
	});

	it('loads cardEconomy.json evolution and sell tables', () => {
		expect(cardEconomy.evolutionTransforms).toBeTypeOf('object');
		expect(cardEconomy.cardSellValues).toBeTypeOf('object');
		expect(Object.keys(cardEconomy.evolutionTransforms).length).toBeGreaterThan(0);
	});

	it('every card resolves a sell value via economy table or defaults', () => {
		for (const id of CARD_DEF_KEYS) {
			expect(snapshot.cards[id].sellValue).toBeGreaterThan(0);
		}
	});
});

describe('card balance metrics — per-card records', () => {
	it('exports a complete metrics record for every card', () => {
		expect(allMetrics).toHaveLength(CARD_DEF_KEYS.length);

		for (const record of allMetrics) {
			for (const field of REQUIRED_METRIC_FIELDS) {
				expect(record, `${record.id}.${field}`).toHaveProperty(field);
			}
			expect(record.damagePerMsStone).toBeTypeOf('number');
			if (record.magicStoneCost === 0) {
				expect(record.damagePerMsStone).toBe(0);
			}
		}
	});

	it('documents utilityScore for heal/support cards instead of zeroing them out', () => {
		const healingFont = snapshot.cards.healing_font;
		expect(healingFont.estimatedBurstDamage).toBe(0);
		expect(healingFont.utilityScore).toBeGreaterThan(0);

		const purifying = snapshot.cards.purifying_pulse;
		expect(purifying.utilityScore).toBeGreaterThan(0);

		const manaPrism = snapshot.cards.mana_prism;
		expect(manaPrism.utilityScore).toBeGreaterThan(0);
	});

	it('covers main burst stat shapes from cardStats.json', () => {
		expect(snapshot.cards.iron_sword.estimatedBurstDamage).toBe(17);
		expect(snapshot.cards.magma_greatsword.estimatedBurstDamage).toBe(42 + 4 * 11);
		expect(snapshot.cards.glacier_collapse.estimatedBurstDamage).toBe(17 + 33);
		expect(snapshot.cards.null_crawler.estimatedBurstDamage).toBeGreaterThan(0);
		expect(snapshot.cards.null_crawler.minionDpsEstimate).toBeCloseTo(11, 0);
		expect(snapshot.cards.spike_trap.estimatedBurstDamage).toBe(39);
		expect(snapshot.cards.cinder_snare.estimatedBurstDamage).toBe(8 * 4);
	});

	it('assigns MS tiers at 0 / 1–35 / 36–50 / 51+', () => {
		expect(getMsTier(0)).toBe('0');
		expect(getMsTier(35)).toBe('1-35');
		expect(getMsTier(36)).toBe('36-50');
		expect(getMsTier(50)).toBe('36-50');
		expect(getMsTier(51)).toBe('51+');
		expect(snapshot.cards.battle_familiar.msTier).toBe('36-50');
	});
});

describe('card balance metrics — reward order & peer bands', () => {
	it('detects rewardOrder collisions among acquisition reward cards', () => {
		const collisions = findRewardOrderCollisions();
		expect(collisions).toEqual(snapshot.rewardOrderCollisions);
		expect(collisions).toEqual([]);
	});

	it('flags cards outside documented peer bands by type and MS tier', () => {
		const flagged = flagPeerBandOutliers(computeAllCardMetrics());
		const outliers = flagged.filter((m) => m.peerBandFlag !== 'ok');
		expect(outliers.length).toBeGreaterThan(0);

		for (const m of outliers) {
			const peers = flagged.filter(
				(p) => p.type === m.type && p.msTier === m.msTier,
			);
			const floor = Math.min(...peers.map((p) => p.comparisonValue));
			const ceiling = Math.max(...peers.map((p) => p.comparisonValue));
			if (m.peerBandFlag === 'over-budget') {
				expect(m.comparisonValue).toBeGreaterThan(ceiling * OVER_BUDGET_FACTOR);
			}
			if (m.peerBandFlag === 'under-budget') {
				expect(m.comparisonValue).toBeLessThanOrEqual(floor);
				expect((ceiling - m.comparisonValue) / ceiling).toBeGreaterThanOrEqual(0.15);
			}
		}
	});
});

describe('card balance metrics — metrics-snapshot.json', () => {
	it('matches committed metrics-snapshot.json (set CARD_BALANCE_UPDATE_SNAPSHOT=1 to refresh)', () => {
		if (process.env.CARD_BALANCE_UPDATE_SNAPSHOT === '1') {
			fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
			fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
		}

		const committed = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
		expect(snapshot.cardCount).toBe(committed.cardCount);
		expect(snapshot.rewardOrderCollisions).toEqual(committed.rewardOrderCollisions);
		expect(snapshot.cards).toEqual(committed.cards);
	});
});
