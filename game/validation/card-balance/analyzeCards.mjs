/**
 * Card balance metrics harness.
 * Merges shared cardDefs + cardStats like progression.js CARD_DEFS (without
 * server-only CARD_STAT_OVERLAY runtime fields). See SERVER_STAT_OVERLAY below.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHARED_DIR = path.resolve(__dirname, '../../shared');

/** Matches game/server/config.js COOLDOWN_MS — default slot reuse delay. */
export const DEFAULT_COOLDOWN_MS = 800;

/**
 * Server-only fields injected in progression.js CARD_STAT_OVERLAY (not in shared JSON).
 * Metrics omit computed values; this documents which cards receive overlay keys.
 */
export const SERVER_STAT_OVERLAY = {
	dungeon_drake: ['breathConeAngle'],
	bulkhead_mauler: ['attackConeAngle'],
	ancient_wyrm: ['breathConeAngle'],
	harvesting_scythe: ['attackConeAngle'],
	dragons_breath: ['breathConeAngle'],
	astral_guardian: ['attackIntervalMs'],
};

const REQUIRED_METRIC_FIELDS = [
	'id',
	'name',
	'type',
	'charges',
	'magicStoneCost',
	'damage',
	'cooldownMs',
	'sellValue',
	'acquisition',
	'rewardOrder',
];

const DERIVED_FIELDS = ['damagePerCharge', 'damagePerMs', 'effectiveBurst', 'utilityScore'];

function readJson(relativePath) {
	const fullPath = path.join(SHARED_DIR, relativePath);
	return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function resolveSellValue(cardId, merged, cardSellValues) {
	if (Object.prototype.hasOwnProperty.call(cardSellValues, cardId)) {
		return cardSellValues[cardId];
	}
	if (merged.isEvolved) return 15;
	if (merged.type === 'spell') return 12;
	if (merged.type === 'creature') return 10;
	return 5;
}

function estimateDotContribution(stats) {
	const tickDamage = stats.damagePerTick ?? stats.trailDamagePerTick ?? 0;
	const ticks = stats.dotTicks ?? 0;
	if (tickDamage <= 0 || ticks <= 0) return 0;
	return tickDamage * ticks;
}

function resolvePrimaryDamage(stats, type) {
	if (typeof stats.damage === 'number') {
		return stats.damage;
	}
	if (type === 'creature') {
		if (typeof stats.attackDamage === 'number') return stats.attackDamage;
		if (typeof stats.breathDamage === 'number') return stats.breathDamage;
	}
	if (type === 'enchantment') {
		if (typeof stats.damage === 'number') return stats.damage;
		if (typeof stats.damagePerTick === 'number') return stats.damagePerTick;
		if (typeof stats.minReflectDamage === 'number') return stats.minReflectDamage;
	}
	return 0;
}

function resolveUtilityScore(stats, type) {
	if (typeof stats.healAmount === 'number') return stats.healAmount;
	if (typeof stats.magicStoneRestore === 'number') return stats.magicStoneRestore;
	if (typeof stats.shieldHp === 'number') return stats.shieldHp;
	if (typeof stats.magicStoneGain === 'number') return stats.magicStoneGain;
	if (type === 'creature' && typeof stats.minionHp === 'number') return stats.minionHp;
	return null;
}

function computeDerivedMetrics(merged) {
	const swingsPerUse = merged.swingsPerUse ?? 1;
	const primaryDamage = resolvePrimaryDamage(merged, merged.type);
	const dotContribution = estimateDotContribution(merged);
	const effectiveBurst = primaryDamage + dotContribution;
	const perUseDamage = effectiveBurst * swingsPerUse;
	const damagePerCharge = merged.charges > 0 ? perUseDamage / merged.charges : perUseDamage;
	const cooldownMs = merged.cooldownMs ?? DEFAULT_COOLDOWN_MS;
	const windUpMs = merged.windUpMs ?? 0;
	const effectiveCycleMs =
		windUpMs > 0 ? cooldownMs + windUpMs : cooldownMs;
	const damagePerMs =
		effectiveCycleMs > 0 ? perUseDamage / effectiveCycleMs : null;
	const utilityScore = resolveUtilityScore(merged, merged.type);

	return {
		damage: primaryDamage,
		effectiveBurst,
		damagePerCharge,
		damagePerMs,
		effectiveCycleMs,
		windUpMs: windUpMs > 0 ? windUpMs : null,
		utilityScore,
	};
}

export function mergeCardSources(cardId, identity, stats) {
	return {
		...identity,
		...stats,
		id: cardId,
	};
}

export function buildCardMetrics(cardId, identity, stats, cardSellValues) {
	const merged = mergeCardSources(cardId, identity, stats);
	const derived = computeDerivedMetrics(merged);
	const overlayKeys = SERVER_STAT_OVERLAY[cardId] ?? null;

	return {
		id: cardId,
		name: merged.name,
		type: merged.type,
		charges: merged.charges,
		magicStoneCost: merged.magicStoneCost ?? 0,
		damage: derived.damage,
		cooldownMs: merged.cooldownMs ?? DEFAULT_COOLDOWN_MS,
		sellValue: resolveSellValue(cardId, merged, cardSellValues),
		acquisition: merged.acquisition ?? null,
		rewardOrder: merged.rewardOrder ?? null,
		effectiveBurst: derived.effectiveBurst,
		damagePerCharge: derived.damagePerCharge,
		damagePerMs: derived.damagePerMs,
		effectiveCycleMs: derived.effectiveCycleMs,
		windUpMs: derived.windUpMs,
		utilityScore: derived.utilityScore,
		serverStatOverlayKeys: overlayKeys,
	};
}

export function analyzeCards(options = {}) {
	const cardDefs = options.cardDefs ?? readJson('cardDefs.json');
	const cardStats = options.cardStats ?? readJson('cardStats.json');
	const cardEconomy = options.cardEconomy ?? readJson('cardEconomy.json');
	const cardSellValues = cardEconomy.cardSellValues ?? {};

	const cardIds = Object.keys(cardDefs).sort();
	const cards = {};

	for (const cardId of cardIds) {
		const identity = cardDefs[cardId];
		const stats = cardStats[cardId];
		if (!stats) {
			throw new Error(`cardStats missing entry for ${cardId}`);
		}
		cards[cardId] = buildCardMetrics(cardId, identity, stats, cardSellValues);
	}

	return {
		cardCount: cardIds.length,
		cards,
		serverStatOverlay: SERVER_STAT_OVERLAY,
	};
}

export function assertCompleteMetrics(report) {
	const missingCards = [];
	const incompleteRows = [];

	for (const [cardId, row] of Object.entries(report.cards)) {
		for (const field of REQUIRED_METRIC_FIELDS) {
			if (!(field in row)) {
				incompleteRows.push({ cardId, field });
			}
		}
		const hasDerived = DERIVED_FIELDS.some((field) => row[field] != null);
		if (!hasDerived) {
			incompleteRows.push({ cardId, field: '(derived metric)' });
		}
	}

	return { missingCards, incompleteRows };
}

function formatOutput(report) {
	return JSON.stringify(report, null, 2);
}

function isMainModule() {
	const entry = process.argv[1];
	if (!entry) return false;
	return path.resolve(entry) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
	const report = analyzeCards();
	process.stdout.write(`${formatOutput(report)}\n`);
}
