import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cardDefs from '../../shared/cardDefs.json';
import cardStats from '../../shared/cardStats.json';
import cardEconomy from '../../shared/cardEconomy.json';
import {
	analyzeCards,
	assertCompleteMetrics,
	SERVER_STAT_OVERLAY,
} from '../../validation/card-balance/analyzeCards.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANALYZER_PATH = path.resolve(__dirname, '../../validation/card-balance/analyzeCards.mjs');

describe('card balance metrics harness', () => {
	const report = analyzeCards({ cardDefs, cardStats, cardEconomy });
	const cardIds = Object.keys(cardDefs).sort();

	it('covers every cardDefs id with a metrics row', () => {
		expect(Object.keys(report.cards).sort()).toEqual(cardIds);
		expect(report.cardCount).toBe(47);
	});

	it('has cardStats entries for every card id', () => {
		for (const cardId of cardIds) {
			expect(cardStats[cardId], `cardStats missing ${cardId}`).toBeDefined();
		}
	});

	it('emits complete metrics rows with no gaps', () => {
		const { incompleteRows } = assertCompleteMetrics(report);
		expect(incompleteRows).toEqual([]);
	});

	it('documents server stat overlay cards', () => {
		expect(Object.keys(SERVER_STAT_OVERLAY).sort()).toEqual([
			'ancient_wyrm',
			'astral_guardian',
			'bulkhead_mauler',
			'dragons_breath',
			'dungeon_drake',
			'harvesting_scythe',
		]);
		for (const [cardId, keys] of Object.entries(SERVER_STAT_OVERLAY)) {
			expect(report.cards[cardId].serverStatOverlayKeys).toEqual(keys);
		}
	});

	it('smoke-checks known cards expose expected raw fields', () => {
		expect(report.cards.iron_sword).toMatchObject({
			id: 'iron_sword',
			name: 'Rust-Forged Saber',
			type: 'weapon',
			charges: 5,
			magicStoneCost: 0,
			damage: 17,
			sellValue: cardEconomy.cardSellValues.iron_sword,
			acquisition: 'starter',
		});
		expect(report.cards.iron_sword.damagePerCharge).toBeCloseTo(17 / 5);

		expect(report.cards.fireball).toMatchObject({
			id: 'fireball',
			type: 'weapon',
			charges: 4,
			damage: 18,
			acquisition: 'reward',
			rewardOrder: 27,
			sellValue: cardEconomy.cardSellValues.fireball,
		});

		expect(report.cards.ice_ball).toMatchObject({
			id: 'ice_ball',
			type: 'spell',
			magicStoneCost: 32,
			damage: 12,
			rewardOrder: 28,
			sellValue: cardEconomy.cardSellValues.ice_ball,
		});

		expect(report.cards.chain_lightning).toMatchObject({
			id: 'chain_lightning',
			type: 'spell',
			magicStoneCost: 42,
			damage: 22,
			rewardOrder: 26,
		});

		expect(report.cards.purifying_pulse).toMatchObject({
			id: 'purifying_pulse',
			type: 'spell',
			magicStoneCost: 0,
			damage: 0,
			utilityScore: 15,
			rewardOrder: 27,
		});

		expect(report.cards.dungeon_drake).toMatchObject({
			id: 'dungeon_drake',
			type: 'creature',
			damage: 2,
			acquisition: 'reward',
			rewardOrder: 2,
			sellValue: cardEconomy.cardSellValues.dungeon_drake,
			serverStatOverlayKeys: ['breathConeAngle'],
		});
	});

	it('computes wind-up-aware damagePerMs for cards with windUpMs', () => {
		const magma = report.cards.magma_greatsword;
		const perUseDamage = magma.effectiveBurst * (cardStats.magma_greatsword.swingsPerUse ?? 1);
		const cooldownMs = magma.cooldownMs;
		const windUpMs = cardStats.magma_greatsword.windUpMs;
		const cooldownOnlyDpm = perUseDamage / cooldownMs;
		const effectiveCycleMs = cooldownMs + windUpMs;

		expect(magma.windUpMs).toBe(windUpMs);
		expect(magma.effectiveCycleMs).toBe(effectiveCycleMs);
		expect(magma.damagePerMs).toBeCloseTo(perUseDamage / effectiveCycleMs);
		expect(magma.damagePerMs).toBeLessThan(cooldownOnlyDpm);
	});

	it('leaves damagePerMs unchanged for cards without windUpMs', () => {
		const iron = report.cards.iron_sword;
		const perUseDamage = iron.effectiveBurst;
		const cooldownOnlyDpm = perUseDamage / iron.cooldownMs;

		expect(iron.windUpMs).toBeNull();
		expect(iron.effectiveCycleMs).toBe(iron.cooldownMs);
		expect(iron.damagePerMs).toBeCloseTo(cooldownOnlyDpm);
	});

	it('tunes excalibur_photon damagePerMs toward weapon Q3 via windUpMs', () => {
		const photon = report.cards.excalibur_photon;
		const perUseDamage = photon.effectiveBurst * cardStats.excalibur_photon.swingsPerUse;
		const windUpMs = cardStats.excalibur_photon.windUpMs;
		const effectiveCycleMs = photon.cooldownMs + windUpMs;
		const cooldownOnlyDpm = perUseDamage / photon.cooldownMs;

		expect(windUpMs).toBe(600);
		expect(photon.windUpMs).toBe(windUpMs);
		expect(photon.effectiveCycleMs).toBe(effectiveCycleMs);
		expect(photon.damagePerMs).toBeCloseTo(perUseDamage / effectiveCycleMs);
		expect(photon.damagePerMs).toBeLessThan(cooldownOnlyDpm);
		expect(photon.damagePerMs).toBeLessThan(0.14);
		expect(photon.damagePerMs).toBeLessThanOrEqual(0.045);
	});

	it('runs as a standalone node script', () => {
		const result = spawnSync(process.execPath, [ANALYZER_PATH], {
			encoding: 'utf8',
			cwd: path.resolve(__dirname, '../..'),
		});
		expect(result.status, result.stderr).toBe(0);
		const parsed = JSON.parse(result.stdout);
		expect(Object.keys(parsed.cards).sort()).toEqual(cardIds);
	});
});
