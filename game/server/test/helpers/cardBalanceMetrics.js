/**
 * Pure card-balance metric helpers for roster analysis (ticket 303 / sub-ticket 01).
 * Loads shared JSON only — no server runtime imports.
 */

import cardDefs from '../../../shared/cardDefs.json';
import cardStats from '../../../shared/cardStats.json';
import cardEconomy from '../../../shared/cardEconomy.json';

const { cardSellValues: CARD_SELL_VALUES } = cardEconomy;

/** Matches simulation.js burn tick constants (4 + 1 per 500ms). */
const BURN_TICK_DAMAGE = 5;
const BURN_TICK_INTERVAL_MS = 500;
const CHAIN_LIGHTNING_CHAIN_FRACTION = 0.5;
const DEFAULT_MINION_ATTACK_INTERVAL_MS = 2000;
const OVER_BUDGET_FACTOR = 1.17;

export { OVER_BUDGET_FACTOR };

export function getMsTier(magicStoneCost) {
	const ms = magicStoneCost ?? 0;
	if (ms === 0) return '0';
	if (ms <= 35) return '1-35';
	if (ms <= 50) return '36-50';
	return '51+';
}

export function resolveSellValue(cardId, def, stats) {
	if (Object.prototype.hasOwnProperty.call(CARD_SELL_VALUES, cardId)) {
		return CARD_SELL_VALUES[cardId];
	}
	if (stats?.isEvolved) return 15;
	if (def.type === 'spell') return 12;
	if (def.type === 'creature') return 10;
	return 5;
}

function dotTickDamage(stats) {
	if (stats.trailDamagePerTick != null) return stats.trailDamagePerTick;
	if (stats.damagePerTick != null) return stats.damagePerTick;
	return stats.damage ?? 0;
}

function estimateBurningBonus(stats) {
	if (!stats.burningDurationMs) return 0;
	const ticks = Math.floor(stats.burningDurationMs / BURN_TICK_INTERVAL_MS);
	return ticks * BURN_TICK_DAMAGE;
}

function estimateChainLightningBurst(stats) {
	const base = stats.damage ?? 0;
	const chains = stats.maxChainTargets ?? 0;
	return base + chains * Math.round(base * CHAIN_LIGHTNING_CHAIN_FRACTION);
}

function estimateBreathDamage(stats) {
	const tickDamage = stats.breathDamage ?? 0;
	if (!tickDamage || !stats.breathDurationMs || !stats.breathTickMs) return 0;
	const ticksPerBreath = Math.floor(stats.breathDurationMs / stats.breathTickMs);
	const damagePerBreath = tickDamage * ticksPerBreath;
	const intervalSec = (stats.breathIntervalMs ?? 2500) / 1000;
	const ttl = stats.minionTtl ?? 30;
	const breaths = Math.floor(ttl / intervalSec);
	return breaths * damagePerBreath;
}

function estimateMinionAttackBurst(stats) {
	const attackDamage = stats.attackDamage ?? 0;
	if (attackDamage <= 0) return 0;

	const intervalMs = stats.attackIntervalMs ?? DEFAULT_MINION_ATTACK_INTERVAL_MS;
	const ttl = stats.minionTtl ?? 30;
	const attacks = Math.floor((ttl * 1000) / intervalMs);
	return attacks * attackDamage;
}

function estimateShockwaveBonus(stats) {
	if (!stats.shockwaveDamage || !stats.shockwaveEvery) return 0;
	return stats.shockwaveDamage / stats.shockwaveEvery;
}

function estimateEnchantmentBurst(stats) {
	if (stats.damage != null && stats.damage > 0) return stats.damage;
	if (stats.damagePerTick != null && stats.dotTicks != null) {
		return stats.damagePerTick * stats.dotTicks;
	}
	if (stats.minReflectDamage != null) return stats.minReflectDamage;
	return 0;
}

function estimateDotBonus(stats) {
	if (!stats.dotTicks) return 0;
	return stats.dotTicks * dotTickDamage(stats);
}

export function isUtilityCard(stats, def) {
	if (def.type === 'enchantment') return false;
	if ((stats.damage ?? 0) > 0) return false;
	if ((stats.attackDamage ?? 0) > 0) return false;
	if ((stats.breathDamage ?? 0) > 0) return false;
	if ((stats.centerDamage ?? 0) > 0) return false;
	if ((stats.damagePerTick ?? 0) > 0 && !stats.target) return false;
	if (stats.healAmount != null) return true;
	if (stats.shieldHp != null) return true;
	if (stats.magicStoneGain != null) return true;
	if (stats.magicStonePulse != null) return true;
	if (stats.drawsOnUse != null) return true;
	if (stats.adjacentChargeRestore != null) return true;
	if (stats.pullStrength != null && stats.centerDamage == null) return true;
	if (stats.effect === 'telepipe') return true;
	if (stats.taunt && (stats.minionHp ?? 0) > 0) return true;
	return false;
}

export function estimateUtilityScore(stats) {
	let score = 0;
	if (stats.healAmount != null) score += stats.healAmount;
	if (stats.shieldHp != null) score += stats.shieldHp;
	if (stats.magicStoneRestore != null) score += stats.magicStoneRestore;
	if (stats.magicStoneGain != null) score += stats.magicStoneGain;
	if (stats.drawsOnUse != null) score += stats.drawsOnUse * 10;
	if (stats.adjacentChargeRestore != null) score += stats.adjacentChargeRestore * 8;
	if (stats.pullStrength != null) score += stats.pullStrength * 5;
	if (stats.magicStonePulse != null && stats.pulseIntervalMs && stats.durationSeconds) {
		const pulses = Math.floor((stats.durationSeconds * 1000) / stats.pulseIntervalMs);
		score += pulses * stats.magicStonePulse;
	}
	if (stats.taunt && stats.minionHp != null) score += stats.minionHp * 0.5;
	if (stats.effect === 'telepipe') score += 15;
	return score;
}

export function estimateDirectDamage(stats, def) {
	if (isUtilityCard(stats, def)) return 0;
	if (def.type === 'enchantment') return estimateEnchantmentBurst(stats);
	return stats.damage ?? stats.centerDamage ?? stats.attackDamage ?? stats.breathDamage ?? 0;
}

export function estimateBurstDamage(stats, def) {
	if (isUtilityCard(stats, def)) return 0;

	if (def.type === 'enchantment') {
		return estimateEnchantmentBurst(stats);
	}

	let burst = stats.damage ?? 0;

	if (stats.swingsPerUse != null) {
		burst = (stats.damage ?? 0) * stats.swingsPerUse;
	}

	if (stats.effect === 'chain_lightning') {
		return estimateChainLightningBurst(stats);
	}

	if (stats.centerDamage != null) {
		burst = Math.max(burst, stats.centerDamage);
	}

	burst += estimateDotBonus(stats);
	burst += stats.frozenBonusDamage ?? 0;
	burst += estimateBurningBonus(stats);
	burst += estimateShockwaveBonus(stats);

	const minionBurst = estimateMinionAttackBurst(stats);
	const breathBurst = estimateBreathDamage(stats);
	if (minionBurst > 0 || breathBurst > 0) {
		return minionBurst + breathBurst;
	}

	if (burst > 0) return burst;

	return estimateEnchantmentBurst(stats);
}

export function estimateMinionDps(stats) {
	const intervalMs = stats.attackIntervalMs ?? DEFAULT_MINION_ATTACK_INTERVAL_MS;
	if ((stats.attackDamage ?? 0) > 0) {
		return stats.attackDamage / (intervalMs / 1000);
	}
	if ((stats.breathDamage ?? 0) > 0 && stats.breathTickMs) {
		const ticksPerBreath = Math.floor((stats.breathDurationMs ?? 2000) / stats.breathTickMs);
		const intervalSec = (stats.breathIntervalMs ?? 2500) / 1000;
		return (stats.breathDamage * ticksPerBreath) / intervalSec;
	}
	return 0;
}

export function computeDamagePerMsStone(estimatedBurstDamage, magicStoneCost) {
	if (!magicStoneCost) return 0;
	return estimatedBurstDamage / magicStoneCost;
}

export function computeCardMetrics(cardId, defs = cardDefs, statsMap = cardStats) {
	const def = defs[cardId];
	const stats = statsMap[cardId] ?? {};
	const magicStoneCost = stats.magicStoneCost ?? 0;
	const utility = isUtilityCard(stats, def);
	const directDamage = estimateDirectDamage(stats, def);
	const estimatedBurstDamage = utility ? 0 : estimateBurstDamage(stats, def);
	const utilityScore = utility ? estimateUtilityScore(stats) : 0;
	const charges = def.charges ?? 1;
	const sellValue = resolveSellValue(cardId, def, stats);
	const comparisonValue = utility ? utilityScore : estimatedBurstDamage;

	return {
		id: cardId,
		type: def.type,
		charges,
		magicStoneCost,
		msTier: getMsTier(magicStoneCost),
		acquisition: def.acquisition ?? null,
		rewardOrder: def.rewardOrder ?? null,
		sellValue,
		directDamage,
		estimatedBurstDamage,
		utilityScore,
		isUtility: utility,
		comparisonValue,
		damagePerCharge: charges > 0 ? comparisonValue / charges : 0,
		damagePerMsStone: computeDamagePerMsStone(estimatedBurstDamage, magicStoneCost),
		minionDpsEstimate: def.type === 'creature' ? estimateMinionDps(stats) : 0,
		sellValueRatio: sellValue > 0 ? comparisonValue / sellValue : 0,
		peerBandFlag: 'ok',
	};
}

export function computeAllCardMetrics(defs = cardDefs, statsMap = cardStats) {
	return Object.keys(defs)
		.sort()
		.map((id) => computeCardMetrics(id, defs, statsMap));
}

export function findRewardOrderCollisions(defs = cardDefs) {
	const byOrder = new Map();
	for (const [id, def] of Object.entries(defs)) {
		if (def.acquisition !== 'reward' || def.rewardOrder == null) continue;
		const list = byOrder.get(def.rewardOrder) ?? [];
		list.push(id);
		byOrder.set(def.rewardOrder, list);
	}
	return [...byOrder.entries()]
		.filter(([, ids]) => ids.length > 1)
		.map(([rewardOrder, cardIds]) => ({ rewardOrder, cardIds: cardIds.sort() }));
}

export function flagPeerBandOutliers(metrics) {
	const groups = new Map();
	for (const m of metrics) {
		const key = `${m.type}|${m.msTier}`;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(m);
	}

	for (const members of groups.values()) {
		if (members.length < 2) continue;
		const values = members.map((m) => m.comparisonValue);
		const floor = Math.min(...values);
		const ceiling = Math.max(...values);
		const overThreshold = ceiling * OVER_BUDGET_FACTOR;

		for (const m of members) {
			const belowFloor =
				m.comparisonValue <= floor &&
				ceiling > floor &&
				(ceiling - m.comparisonValue) / ceiling >= 0.15;

			if (m.comparisonValue > overThreshold) {
				m.peerBandFlag = 'over-budget';
			} else if (belowFloor) {
				m.peerBandFlag = 'under-budget';
			} else {
				m.peerBandFlag = 'ok';
			}
		}
	}

	return metrics;
}

export function buildMetricsSnapshot(defs = cardDefs, statsMap = cardStats) {
	const cards = computeAllCardMetrics(defs, statsMap);
	flagPeerBandOutliers(cards);
	const rewardOrderCollisions = findRewardOrderCollisions(defs);
	const byId = Object.fromEntries(cards.map((m) => [m.id, m]));

	return {
		generatedAt: new Date().toISOString().slice(0, 10),
		cardCount: cards.length,
		rewardOrderCollisions,
		peerBandNotes:
			'Peer groups: card type × MS tier (0 / 1–35 / 36–50 / 51+). over-budget = comparisonValue > group max × 1.17 (ticket 207). under-budget = at group min and ≥15% below group max. Utility cards use utilityScore; others use estimatedBurstDamage.',
		cards: byId,
	};
}

export const CARD_DEF_KEYS = Object.keys(cardDefs).sort();
