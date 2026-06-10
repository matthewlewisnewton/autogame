/**
 * Lobby quest board helpers — pure functions for rendering quest selection UI.
 */

import { THEME } from './theme.js';
import { CARD_DEFS } from './cards.js';

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
		const questId = quest.questId || quest.id;
		if (questId === 'spire_ascent') {
			if (addCount > 0) {
				return THEME.objectives.defeatSummitWardenWithSupports.replace(
					'{addCount}',
					String(addCount),
				);
			}
			return THEME.objectives.defeatSummitWarden;
		}
		if (questId === 'canyon_descent') {
			if (addCount > 0) {
				return THEME.objectives.defeatCanyonWardenWithSupports.replace(
					'{addCount}',
					String(addCount),
				);
			}
			return THEME.objectives.defeatCanyonWarden;
		}
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

	if (quest.objectiveType === 'escort') {
		const npc = quest.escortNpc?.name || 'VIP';
		const dest = quest.escortDestination?.landmark
			|| quest.escortDestination?.roomRole
			|| 'extraction';
		return `Escort ${npc} to ${String(dest).replace(/_/g, ' ')}`;
	}

	return quest.description || '';
}

export function formatRewardSummary(quest) {
	if (!quest) return 'Reward: —';

	const rewardCardName = typeof quest.rewardCardId === 'string' && CARD_DEFS[quest.rewardCardId]
		? CARD_DEFS[quest.rewardCardId].name
		: null;
	const signatureCardName = !rewardCardName
		? (quest.signatureCardName || null)
		: null;
	const cardName = rewardCardName || signatureCardName;

	if (rewardCardName && quest.rewardCurrency != null) {
		return `Reward: ${rewardCardName} + ${quest.rewardCurrency} ${THEME.currency.short.toLowerCase()}`;
	}
	if (quest.rewardCurrency != null && cardName) {
		return `Reward: ${quest.rewardCurrency} ${THEME.currency.short.toLowerCase()} + ${cardName}`;
	}
	if (quest.rewardCurrency != null) {
		return `Reward: ${quest.rewardCurrency} ${THEME.currency.short.toLowerCase()}`;
	}
	if (cardName) {
		return `Reward: ${cardName}`;
	}
	return 'Reward: —';
}

export function formatBriefingRewardLine(quest) {
	if (!quest) return formatRewardSummary(quest);
	if (typeof quest.briefingRewardText === 'string' && quest.briefingRewardText) {
		return quest.briefingRewardText;
	}
	if (typeof quest.briefingRewardLine === 'string' && quest.briefingRewardLine.trim()) {
		return quest.briefingRewardLine.trim();
	}
	if (typeof quest.rewardSummary === 'string' && quest.rewardSummary) {
		return quest.rewardSummary;
	}
	return formatRewardSummary(quest);
}

export function findQuestBoardEntry(questId, tier, quests, questVariants) {
	const normalizedTier = tier ?? 1;
	if (normalizedTier >= 2) {
		return (questVariants || []).find(
			(variant) => (variant.questId || variant.id) === questId && (variant.tier ?? 2) === normalizedTier,
		) || null;
	}
	return (quests || []).find((quest) => quest.id === questId) || null;
}

export function renderQuestBriefing(container, quest) {
	if (!container) return;

	const hasBriefing = quest && (quest.briefing || quest.clientNpc);
	if (!hasBriefing) {
		container.classList.add('hidden');
		container.replaceChildren();
		return;
	}

	container.classList.remove('hidden');

	const npc = quest.clientNpc || '';
	const body = quest.briefing || quest.description || '';
	const objective = quest.objectiveSummary || formatObjectiveSummary(quest);
	const reward = formatBriefingRewardLine(quest);

	const npcEl = container.querySelector('.quest-briefing-npc');
	const bodyEl = container.querySelector('.quest-briefing-body');
	const objectiveEl = container.querySelector('.quest-briefing-objective');
	const rewardEl = container.querySelector('.quest-briefing-reward');

	if (npcEl && bodyEl && objectiveEl && rewardEl) {
		npcEl.textContent = npc;
		bodyEl.textContent = body;
		objectiveEl.textContent = objective;
		rewardEl.textContent = reward;
		npcEl.style.display = npc ? '' : 'none';
		return;
	}

	container.replaceChildren();
	if (npc) {
		const heading = document.createElement('p');
		heading.className = 'quest-briefing-npc';
		heading.textContent = npc;
		container.appendChild(heading);
	}
	const paragraph = document.createElement('p');
	paragraph.className = 'quest-briefing-body';
	paragraph.textContent = body;
	container.appendChild(paragraph);

	const objectiveLine = document.createElement('p');
	objectiveLine.className = 'quest-briefing-objective';
	objectiveLine.textContent = objective;
	container.appendChild(objectiveLine);

	const rewardLine = document.createElement('p');
	rewardLine.className = 'quest-briefing-reward';
	rewardLine.textContent = reward;
	container.appendChild(rewardLine);
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
			rewardCardId: quest.rewardCardId,
			objectiveSummary: quest.objectiveSummary,
			rewardSummary: quest.rewardSummary,
			clientNpc: quest.clientNpc,
			briefing: quest.briefing,
			briefingRewardLine: quest.briefingRewardLine,
			briefingRewardText: quest.briefingRewardText,
			signatureCardName: quest.signatureCardName,
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
			clientNpc: variant.clientNpc,
			briefing: variant.briefing,
			briefingRewardLine: variant.briefingRewardLine,
			briefingRewardText: variant.briefingRewardText,
		});
	}

	return rows;
}

function updateQuestSelection(container, selectedQuestId, selectedQuestTier, selectionLocked = false) {
	container.querySelectorAll('.quest-card').forEach((card) => {
		const cardTier = Number(card.dataset.questTier) || 1;
		const selected =
			card.dataset.questId === selectedQuestId
			&& cardTier === (selectedQuestTier ?? 1);
		card.classList.toggle('selected', selected);
		card.classList.toggle('quest-card-locked', selectionLocked || card.classList.contains('quest-card-tier-locked'));
		card.disabled = selectionLocked || card.classList.contains('quest-card-tier-locked');
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
		selectionLocked = false,
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
	const nextKey = `${structureKey}|${selectedQuestId}|${selectedQuestTier ?? 1}|${selectionLocked ? 'locked' : 'open'}`;
	const existingCards = container.querySelectorAll('.quest-card');
	if (
		container.dataset.questBoardKey?.startsWith(`${structureKey}|`)
		&& existingCards.length === rows.length
	) {
		updateQuestSelection(container, selectedQuestId, selectedQuestTier, selectionLocked);
		container.querySelectorAll('.quest-card').forEach((card) => {
			const questId = card.dataset.questId;
			const tier = Number(card.dataset.questTier) || 1;
			const tierLocked = tier >= 2 && !isQuestTierUnlocked(unlockedQuestTiers, questId, tier);
			card.classList.toggle('quest-card-tier-locked', tierLocked);
			card.classList.toggle('quest-card-locked', selectionLocked || tierLocked);
			card.disabled = selectionLocked || tierLocked;
		});
		container.dataset.questBoardKey = nextKey;
		return;
	}

	container.replaceChildren();

	for (const row of rows) {
		const tier = row.tier ?? 1;
		const tierLocked = tier >= 2 && !isQuestTierUnlocked(unlockedQuestTiers, row.id, tier);
		const locked = selectionLocked || tierLocked;

		const card = document.createElement('button');
		card.type = 'button';
		card.className = 'quest-card';
		if (locked) card.classList.add('quest-card-locked');
		if (tierLocked) card.classList.add('quest-card-tier-locked');
		card.dataset.questId = row.id;
		card.dataset.questTier = String(tier);
		card.disabled = locked;

		if (row.id === selectedQuestId && tier === (selectedQuestTier ?? 1)) {
			card.classList.add('selected');
		}

		const tierBadge =
			tier >= 2
				? `<span class="quest-tier-badge">${tierLocked ? 'Tier 2 — Locked' : 'Tier 2'}</span>`
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
