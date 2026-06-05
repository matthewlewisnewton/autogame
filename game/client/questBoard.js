/**
 * Lobby quest board helpers — pure functions for rendering quest selection UI.
 */

import { THEME } from './theme.js';

export function formatObjectiveSummary(quest) {
	if (!quest) return '';

	if (quest.objectiveType === 'collect_items') {
		const itemCount = quest.itemCount ?? 0;
		return THEME.objectives.recoverPrisms.replace('{count}', String(itemCount));
	}

	if (quest.objectiveType === 'defeat_enemies') {
		const enemyCount = quest.enemyCount ?? 0;
		return THEME.objectives.neutralizeHostiles.replace('{count}', String(enemyCount));
	}

	if (quest.objectiveType === 'survive') {
		const totalSpawns = quest.totalSpawns ?? 0;
		const minibossCount = quest.minibossCount ?? 0;
		return THEME.objectives.surviveHostiles
			.replace('{count}', String(totalSpawns))
			.replace('{minibosses}', String(minibossCount));
	}

	if (quest.objectiveType === 'stage_boss') {
		const addCount = quest.encounter?.addCount ?? 0;
		const annexOverseer = quest.encounter?.bossType === 'annex_overseer';
		if (addCount > 0) {
			const template = annexOverseer
				? THEME.objectives.defeatAnnexOverseerWithSupports
				: THEME.objectives.defeatTrialWardenWithSupports;
			return template.replace('{addCount}', String(addCount));
		}
		return annexOverseer
			? THEME.objectives.defeatAnnexOverseer
			: THEME.objectives.defeatTrialWarden;
	}

	return quest.description || '';
}

export function formatRewardSummary(quest) {
	if (!quest || quest.rewardCurrency == null) return 'Reward: —';
	return `Reward: ${quest.rewardCurrency} ${THEME.currency.short.toLowerCase()}`;
}

/** Display label for run summaries / HUD when a tier-2 contract is active. */
export function formatQuestTierLabel(questName, questTier) {
	if (!questName) return '';
	if (questTier === 2) {
		const baseName = questName.replace(/\s*[—–-]\s*Tier\s*(II|2).*$/i, '').trim() || questName;
		return `${baseName} (Tier 2)`;
	}
	return questName;
}

export function isQuestTierUnlocked(unlockedQuestTiers, questId, tier) {
	if (!tier || tier <= 1) return true;
	const tiers = unlockedQuestTiers && unlockedQuestTiers[questId];
	return Array.isArray(tiers) && tiers.includes(tier);
}

function rowObjectiveText(row) {
	if (row.objectiveSummary) return row.objectiveSummary;
	return formatObjectiveSummary(row);
}

function rowRewardText(row) {
	if (row.rewardSummary) return row.rewardSummary;
	return formatRewardSummary(row);
}

function buildQuestBoardRows(quests, questVariants) {
	const rows = [];
	for (const quest of quests || []) {
		rows.push({
			id: quest.id,
			tier: quest.tier ?? 1,
			name: quest.name,
			description: quest.description,
			objectiveType: quest.objectiveType,
			itemCount: quest.itemCount,
			enemyCount: quest.enemyCount,
			totalSpawns: quest.totalSpawns,
			minibossCount: quest.minibossCount,
			encounter: quest.encounter,
			rewardCurrency: quest.rewardCurrency,
		});
	}

	for (const variant of questVariants || []) {
		const tier = variant.tier ?? (variant.isTier2 ? 2 : 1);
		if (tier < 2) continue;
		rows.push({
			id: variant.questId || variant.id,
			tier,
			name: variant.name,
			description: variant.description,
			objectiveSummary: variant.objectiveSummary,
			rewardSummary: variant.rewardSummary,
		});
	}

	return rows;
}

function updateQuestSelection(container, selectedQuestId, selectedQuestTier) {
	container.querySelectorAll('.quest-card').forEach((card) => {
		const cardTier = Number(card.dataset.questTier) || 1;
		const selected =
			card.dataset.questId === selectedQuestId
			&& cardTier === (selectedQuestTier ?? 1);
		card.classList.toggle('selected', selected);
	});
}

function questBoardStructureKey(rows, unlockedQuestTiers) {
	const rowKey = rows.map((r) => `${r.id}:${r.tier}`).join('\0');
	let unlockKey = '';
	try {
		unlockKey = JSON.stringify(unlockedQuestTiers || {});
	} catch (_) {
		unlockKey = '';
	}
	return `${rowKey}|${unlockKey}`;
}

export function renderQuestBoard(
	container,
	quests,
	selectedQuestId,
	onSelectQuest,
	{
		selectedQuestTier = 1,
		unlockedQuestTiers = {},
		questVariants = [],
	} = {},
) {
	if (!container) return;

	const rows = buildQuestBoardRows(quests, questVariants);

	if (rows.length === 0) {
		container.replaceChildren();
		const empty = document.createElement('p');
		empty.className = 'quest-board-empty';
		empty.textContent = THEME.run.noContracts;
		container.appendChild(empty);
		container.dataset.questBoardKey = '';
		return;
	}

	const structureKey = questBoardStructureKey(rows, unlockedQuestTiers);
	const nextKey = `${structureKey}|${selectedQuestId}|${selectedQuestTier ?? 1}`;
	const existingCards = container.querySelectorAll('.quest-card');
	if (
		container.dataset.questBoardKey?.startsWith(`${structureKey}|`)
		&& existingCards.length === rows.length
	) {
		updateQuestSelection(container, selectedQuestId, selectedQuestTier);
		container.querySelectorAll('.quest-card').forEach((card) => {
			const questId = card.dataset.questId;
			const tier = Number(card.dataset.questTier) || 1;
			const locked = tier >= 2 && !isQuestTierUnlocked(unlockedQuestTiers, questId, tier);
			card.classList.toggle('quest-card-locked', locked);
			card.disabled = locked;
		});
		container.dataset.questBoardKey = nextKey;
		return;
	}

	container.replaceChildren();

	for (const row of rows) {
		const tier = row.tier ?? 1;
		const locked = tier >= 2 && !isQuestTierUnlocked(unlockedQuestTiers, row.id, tier);

		const card = document.createElement('button');
		card.type = 'button';
		card.className = 'quest-card';
		if (locked) card.classList.add('quest-card-locked');
		card.dataset.questId = row.id;
		card.dataset.questTier = String(tier);
		card.disabled = locked;

		if (row.id === selectedQuestId && tier === (selectedQuestTier ?? 1)) {
			card.classList.add('selected');
		}

		const tierBadge =
			tier >= 2
				? `<span class="quest-tier-badge">${locked ? 'Tier 2 — Locked' : 'Tier 2'}</span>`
				: '';

		card.innerHTML = `
			<span class="quest-name">${row.name}</span>
			${tierBadge}
			<span class="quest-description">${row.description}</span>
			<span class="quest-objective">${rowObjectiveText(row)}</span>
			<span class="quest-reward">${rowRewardText(row)}</span>
		`;

		if (typeof onSelectQuest === 'function' && !locked) {
			card.addEventListener('click', () => onSelectQuest(row.id, tier));
		}

		container.appendChild(card);
	}

	container.dataset.questBoardKey = nextKey;
}
