/**
 * Lobby quest board helpers — pure functions for rendering quest selection UI.
 */

import { CARD_DEFS } from './cards.js';
import { THEME } from './theme.js';

const CLIENT_UNKNOWN = 'Contract issuer unknown';

function resolveBossDisplayName(bossType, encounter) {
	if (typeof encounter?.bossDisplayName === 'string' && encounter.bossDisplayName.trim()) {
		return encounter.bossDisplayName.trim();
	}
	const normalized = typeof bossType === 'string' && bossType.trim() ? bossType.trim() : 'miniboss';
	return normalized
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

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
		if (quest.levelKind === 'boss_level') {
			const bossType = quest.encounter?.bossType || 'miniboss';
			const bossName = resolveBossDisplayName(bossType, quest.encounter);
			if (addCount > 0) {
				return THEME.objectives.defeatBossLevelWithSupports
					.replace('{bossName}', bossName)
					.replace('{addCount}', String(addCount));
			}
			return THEME.objectives.defeatBossLevel.replace('{bossName}', bossName);
		}
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
		if (questId === 'frost_crossing') {
			if (addCount > 0) {
				return THEME.objectives.defeatPermafrostWardenWithSupports.replace(
					'{addCount}',
					String(addCount),
				);
			}
			return THEME.objectives.defeatPermafrostWarden;
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

export function formatRewardDetail(quest) {
	if (!quest || quest.rewardCurrency == null) return '—';
	let text = `${quest.rewardCurrency} ${THEME.currency.short.toLowerCase()}`;
	if (quest.rewardSignatureCard) {
		const cardName = CARD_DEFS[quest.rewardSignatureCard]?.name || quest.rewardSignatureCard;
		text += ` + ${cardName}`;
	}
	return text;
}

export function formatClientBriefing(quest) {
	if (!quest?.client?.name) {
		return { clientName: CLIENT_UNKNOWN, briefing: '' };
	}
	return {
		clientName: quest.client.name,
		briefing: quest.client.briefing || '',
	};
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

function findQuestVariant(questVariants, questId, tier) {
	const normalizedTier = tier ?? 2;
	return (questVariants || []).find(
		(variant) =>
			(variant.questId || variant.id) === questId
			&& (variant.tier ?? 2) === normalizedTier,
	) || null;
}

function levelUnlockGraphNodeState(levelUnlockGraph, questId, tier) {
	const nodes = levelUnlockGraph && Array.isArray(levelUnlockGraph.nodes)
		? levelUnlockGraph.nodes
		: null;
	if (!nodes) return null;
	const node = nodes.find(
		(n) => n && n.questId === questId && (n.tier ?? 1) === tier,
	);
	return node ? node.state : null;
}

/**
 * Tier lock state: prefer server-evaluated tierUnlocked when present, then the
 * level-unlock graph's node state. Both include `unlockRequires` prerequisite
 * checks that the raw unlockedQuestTiers map does not, so the final
 * unlockedQuestTiers fallback only applies when neither server-evaluated
 * source is available.
 */
export function isQuestBoardTierLocked(
	unlockedQuestTiers,
	questVariants,
	questId,
	tier,
	row = null,
	levelUnlockGraph = null,
) {
	const normalizedTier = tier ?? 1;
	if (normalizedTier === 1 && row && typeof row.tierUnlocked === 'boolean') {
		return !row.tierUnlocked;
	}
	if (normalizedTier >= 2) {
		const variant = findQuestVariant(questVariants, questId, tier);
		if (variant && typeof variant.tierUnlocked === 'boolean') {
			return !variant.tierUnlocked;
		}
	}
	const nodeState = levelUnlockGraphNodeState(levelUnlockGraph, questId, normalizedTier);
	if (nodeState) return nodeState === 'locked';
	if (normalizedTier <= 1) return false;
	return !isQuestTierUnlocked(unlockedQuestTiers, questId, tier);
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
			client: quest.client,
			rewardSignatureCard: quest.rewardSignatureCard,
			rewardCardId: quest.rewardCardId,
			objectiveSummary: quest.objectiveSummary,
			rewardSummary: quest.rewardSummary,
			clientNpc: quest.clientNpc,
			briefing: quest.briefing,
			briefingRewardLine: quest.briefingRewardLine,
			briefingRewardText: quest.briefingRewardText,
			signatureCardName: quest.signatureCardName,
			levelKind: quest.levelKind,
			tierUnlocked: quest.tierUnlocked,
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
			rewardCurrency: variant.rewardCurrency,
			client: variant.client,
			rewardSignatureCard: variant.rewardSignatureCard,
			clientNpc: variant.clientNpc,
			briefing: variant.briefing,
			briefingRewardLine: variant.briefingRewardLine,
			briefingRewardText: variant.briefingRewardText,
		});
	}

	return rows;
}

function findSelectedRow(rows, selectedQuestId, selectedQuestTier) {
	const tier = selectedQuestTier ?? 1;
	return rows.find((row) => row.id === selectedQuestId && (row.tier ?? 1) === tier) || null;
}

function ensureBriefingPanelStructure(panel) {
	if (panel.dataset.briefingStructured === '1') return;
	panel.classList.add('quest-briefing-panel');
	panel.innerHTML = `
		<div class="quest-briefing-field">
			<span class="quest-briefing-label">Client</span>
			<span class="quest-briefing-value quest-briefing-client"></span>
		</div>
		<div class="quest-briefing-field">
			<span class="quest-briefing-label">Briefing</span>
			<span class="quest-briefing-value quest-briefing-text"></span>
		</div>
		<div class="quest-briefing-field">
			<span class="quest-briefing-label">Reward</span>
			<span class="quest-briefing-value quest-briefing-reward"></span>
		</div>
	`;
	panel.dataset.briefingStructured = '1';
}

export function renderQuestBriefingPanel(panel, rows, selectedQuestId, selectedQuestTier) {
	if (!panel) return;

	const row = findSelectedRow(rows, selectedQuestId, selectedQuestTier);
	if (!row) {
		panel.classList.add('hidden');
		return;
	}

	ensureBriefingPanelStructure(panel);
	panel.classList.remove('hidden');

	const { clientName, briefing } = formatClientBriefing(row);
	panel.querySelector('.quest-briefing-client').textContent = clientName;
	panel.querySelector('.quest-briefing-text').textContent = briefing || '—';
	panel.querySelector('.quest-briefing-reward').textContent = formatRewardDetail(row);
}

function bindQuestBoardSelection(container, onSelectQuest) {
	if (!container) return;
	if (container._questBoardSelectHandler) {
		container.removeEventListener('click', container._questBoardSelectHandler);
		container._questBoardSelectHandler = null;
	}
	if (typeof onSelectQuest !== 'function') return;
	const handler = (event) => {
		const card = event.target.closest('.quest-card');
		if (!card || !container.contains(card)) return;
		if (card.disabled || card.classList.contains('quest-card-locked')) return;
		const questId = card.dataset.questId;
		const tier = Number(card.dataset.questTier) || 1;
		onSelectQuest(questId, tier);
	};
	container.addEventListener('click', handler);
	container._questBoardSelectHandler = handler;
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

function questBoardRebuildKey(rows, unlockedQuestTiers) {
	const rowKey = rows.map((r) => `${r.id}:${r.tier}`).join('\0');
	let unlockKey = '';
	try {
		unlockKey = JSON.stringify(unlockedQuestTiers || {});
	} catch (_) {
		unlockKey = '';
	}
	return `${rowKey}|${unlockKey}`;
}

function questBoardTierUnlockedKey(questVariants, quests = []) {
	const variantFlags = (questVariants || [])
		.filter((variant) => (variant.tier ?? 2) >= 2)
		.map((variant) => {
			const questId = variant.questId || variant.id;
			const tier = variant.tier ?? 2;
			const flag = typeof variant.tierUnlocked === 'boolean'
				? (variant.tierUnlocked ? '1' : '0')
				: '-';
			return `${questId}:${tier}:${flag}`;
		})
		.join('\0');
	const questFlags = (quests || [])
		.map((quest) => {
			const flag = typeof quest.tierUnlocked === 'boolean'
				? (quest.tierUnlocked ? '1' : '0')
				: '-';
			return `${quest.id}:1:${flag}`;
		})
		.join('\0');
	return `${variantFlags}|${questFlags}`;
}

function questBoardStructureKey(rows, unlockedQuestTiers, questVariants, quests) {
	const rebuildKey = questBoardRebuildKey(rows, unlockedQuestTiers);
	const tierUnlockedKey = questBoardTierUnlockedKey(questVariants, quests);
	return `${rebuildKey}|${tierUnlockedKey}`;
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
		briefingPanelEl = null,
		levelUnlockGraph = null,
	} = {},
) {
	if (!container) return;

	bindQuestBoardSelection(container, onSelectQuest);

	const rows = buildQuestBoardRows(quests, questVariants);

	if (rows.length === 0) {
		container.replaceChildren();
		const empty = document.createElement('p');
		empty.className = 'quest-board-empty';
		empty.textContent = THEME.run.noContracts;
		container.appendChild(empty);
		container.dataset.questBoardKey = '';
		if (briefingPanelEl) {
			briefingPanelEl.classList.add('hidden');
			briefingPanelEl.replaceChildren();
			delete briefingPanelEl.dataset.briefingStructured;
		}
		return;
	}

	const rebuildKey = questBoardRebuildKey(rows, unlockedQuestTiers);
	const structureKey = questBoardStructureKey(rows, unlockedQuestTiers, questVariants, quests);
	const nextKey = `${structureKey}|${selectedQuestId}|${selectedQuestTier ?? 1}|${selectionLocked ? 'locked' : 'open'}`;
	const existingCards = container.querySelectorAll('.quest-card');
	if (
		container.dataset.questBoardKey?.startsWith(`${rebuildKey}|`)
		&& existingCards.length === rows.length
	) {
		updateQuestSelection(container, selectedQuestId, selectedQuestTier, selectionLocked);
		container.querySelectorAll('.quest-card').forEach((card) => {
			const questId = card.dataset.questId;
			const tier = Number(card.dataset.questTier) || 1;
			const row = rows.find((entry) => entry.id === questId && (entry.tier ?? 1) === tier);
			const tierLocked = isQuestBoardTierLocked(unlockedQuestTiers, questVariants, questId, tier, row, levelUnlockGraph);
			const locked = selectionLocked || tierLocked;
			card.classList.toggle('quest-card-tier-locked', tierLocked);
			card.classList.toggle('quest-card-locked', locked);
			card.disabled = locked;
			const tierBadge = card.querySelector('.quest-tier-badge');
			if (tierBadge) {
				if (tier >= 2) {
					tierBadge.textContent = tierLocked ? 'Tier 2 — Locked' : 'Tier 2';
				} else {
					// Tier-1 badge must clear when a prereq unlock flips the card
					// to unlocked on this fast path (e.g. clearing crucible_duel
					// unlocks vault_onslaught without changing the rebuild key).
					tierBadge.textContent = tierLocked ? 'Locked' : '';
				}
			}
		});
		container.dataset.questBoardKey = nextKey;
		renderQuestBriefingPanel(briefingPanelEl, rows, selectedQuestId, selectedQuestTier);
		return;
	}

	container.replaceChildren();

	for (const row of rows) {
		const tier = row.tier ?? 1;
		const tierLocked = isQuestBoardTierLocked(unlockedQuestTiers, questVariants, row.id, tier, row, levelUnlockGraph);
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
				: tierLocked
					? '<span class="quest-tier-badge">Locked</span>'
					: '';

		card.innerHTML = `
			<span class="quest-name">${row.name}</span>
			${tierBadge}
			<span class="quest-description">${row.description}</span>
			<span class="quest-objective">${rowObjectiveText(row)}</span>
			<span class="quest-reward">${rowRewardText(row)}</span>
		`;

		container.appendChild(card);
	}

	container.dataset.questBoardKey = nextKey;
	renderQuestBriefingPanel(briefingPanelEl, rows, selectedQuestId, selectedQuestTier);
}
