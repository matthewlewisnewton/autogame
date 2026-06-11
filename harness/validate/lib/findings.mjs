/**
 * Render validation findings.md from a playthrough run summary.
 */

const FLOOR_ALIGNMENT_STEPS = [
	['levelEntry', 'Level entry'],
	['midCombat', 'Mid combat'],
	['bossDormant', 'Boss dormant'],
	['bossActive', 'Boss active'],
];

const FIRE_CAVERN_BANDS = new Set(['rim', 'ramp', 'basin']);
const ICE_CAVERN_BANDS = new Set(['entry', 'stone', 'ice', 'ramp']);

const FLOOR_ALIGNMENT_THRESHOLD = 0.5;

function formatAssertion(name, passed, detail = '') {
	const status = passed ? 'PASS' : 'FAIL';
	const suffix = detail ? ` — ${detail}` : '';
	return `- **${name}**: ${status}${suffix}`;
}

function formatPresetTitle(preset) {
	if (!preset) return 'Playthrough';
	return preset
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function resolvePresetCopy(run) {
	return {
		title: run.findingsTitle || `${formatPresetTitle(run.preset)} validation findings`,
		bossSpawnLabel: run.bossSpawnLabel || run.bossType || 'boss',
	};
}

/** Parse `type (Display Name)` boss labels from preset metadata. */
function parseBossSpawnLabel(label) {
	if (typeof label !== 'string' || !label.trim()) {
		return { type: null, displayName: null };
	}
	const match = label.trim().match(/^([^(]+?)(?:\s*\(([^)]+)\))?$/);
	if (!match) return { type: label.trim(), displayName: null };
	return {
		type: match[1].trim() || null,
		displayName: match[2]?.trim() || null,
	};
}

function renderAssertionSection(run) {
	const lines = ['', '## Assertions', ''];
	const objectiveType = run.objectiveType ?? 'stage_boss';

	if (objectiveType === 'defeat_enemies') {
		lines.push(formatAssertion('layoutDeployed', run.assertions?.layoutDeployed === true));
		lines.push(formatAssertion('enemiesCleared', run.assertions?.enemiesCleared === true));
		lines.push(formatAssertion('victoryFired', run.assertions?.victoryFired === true));
		if (Object.prototype.hasOwnProperty.call(run.assertions ?? {}, 'slipperyFloorOk')) {
			lines.push(formatAssertion('slipperyFloorOk', run.assertions?.slipperyFloorOk === true));
		}
		if (Object.prototype.hasOwnProperty.call(run.assertions ?? {}, 'glacialSlowApplied')) {
			lines.push(formatAssertion('glacialSlowApplied', run.assertions?.glacialSlowApplied === true));
		}
		if (Object.prototype.hasOwnProperty.call(run.assertions ?? {}, 'emberBurnApplied')) {
			lines.push(formatAssertion('emberBurnApplied', run.assertions?.emberBurnApplied === true));
		}
		if (Object.prototype.hasOwnProperty.call(run.assertions ?? {}, 'cardMechanicsOk')) {
			lines.push(formatAssertion('cardMechanicsOk', run.assertions?.cardMechanicsOk === true));
		}
		if (Object.prototype.hasOwnProperty.call(run.assertions ?? {}, 'telepipeVitalsPreserved')) {
			lines.push(formatAssertion('telepipeVitalsPreserved', run.assertions?.telepipeVitalsPreserved === true));
		}
		if (Object.prototype.hasOwnProperty.call(run.assertions ?? {}, 'cardChargesResetOnFreshSortie')) {
			lines.push(formatAssertion(
				'cardChargesResetOnFreshSortie',
				run.assertions?.cardChargesResetOnFreshSortie === true,
			));
		}
		return lines;
	}

	const { bossSpawnLabel } = resolvePresetCopy(run);
	lines.push(formatAssertion(`bossSpawned (${bossSpawnLabel})`, run.assertions?.bossSpawned === true));
	lines.push(formatAssertion('encounterActivated', run.assertions?.encounterActivated === true));
	lines.push(formatAssertion('bossDefeated', run.assertions?.bossDefeated === true));
	lines.push(formatAssertion('victoryFired', run.assertions?.victoryFired === true));
	return lines;
}

function renderEmberBurnSection(emberBurn) {
	const lines = ['', '## Ember burn', ''];
	if (!emberBurn || typeof emberBurn !== 'object') {
		lines.push('No ember-burn probes recorded (sub-ticket 02/03 wiring).');
		return lines;
	}

	const tickDamage = emberBurn.burnTickDamageApplied === true;
	lines.push(`- **burnTickDamageApplied**: ${tickDamage ? 'PASS' : 'FAIL'}`);
	const applied = emberBurn.emberBurnApplied === true;
	lines.push(`- **emberBurnApplied**: ${applied ? 'PASS' : 'FAIL'}`);
	if (emberBurn.debugGodmodeOff != null) {
		lines.push(`- **debugGodmodeOff**: ${emberBurn.debugGodmodeOff ? 'PASS' : 'FAIL'}`);
	}
	if (emberBurn.playerBurningUntil != null) {
		lines.push(`- player.burningUntil: ${emberBurn.playerBurningUntil}`);
	}
	if (emberBurn.enemyBurningUntil != null) {
		lines.push(`- enemy.burningUntil: ${emberBurn.enemyBurningUntil}`);
	}
	if (emberBurn.hpDelta != null) {
		lines.push(`- HP delta across burn ticks: ${emberBurn.hpDelta}`);
	}
	if (emberBurn.screenshot) {
		lines.push(`- Screenshot: \`${emberBurn.screenshot}\``);
	}
	return lines;
}

function renderCardMechanicsSection(cardMechanics) {
	const lines = ['', '## Card mechanics', ''];
	if (!cardMechanics || typeof cardMechanics !== 'object') {
		lines.push('No card-mechanics probes recorded (sub-ticket 03 wiring).');
		return lines;
	}

	lines.push(`- **cardMechanicsOk**: ${cardMechanics.ok === true ? 'PASS' : 'FAIL'}`);
	const probes = cardMechanics.probes;
	if (probes && typeof probes === 'object') {
		for (const [key, value] of Object.entries(probes)) {
			if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'ok')) {
				lines.push(`- **${key}**: ${value.ok === true ? 'PASS' : 'FAIL'}`);
			}
		}
	}
	return lines;
}

function renderSlipperyFloorSection(slipperyFloor) {
	const lines = ['', '## Slippery floor', ''];
	if (!slipperyFloor || typeof slipperyFloor !== 'object') {
		lines.push('No slippery-floor probes recorded.');
		return lines;
	}
	lines.push(`- **ok**: ${slipperyFloor.ok === true ? 'PASS' : 'FAIL'}`);
	if (slipperyFloor.speedWhileHolding != null) {
		lines.push(`- speedWhileHolding: ${slipperyFloor.speedWhileHolding}`);
	}
	if (slipperyFloor.driftAfterRelease != null) {
		lines.push(`- driftAfterRelease: ${slipperyFloor.driftAfterRelease}`);
	}
	if (slipperyFloor.directionChangeWhileSliding != null) {
		lines.push(`- **directionChangeWhileSliding**: ${slipperyFloor.directionChangeWhileSliding ? 'PASS' : 'FAIL'}`);
	}
	if (slipperyFloor.enteredSlipperyBand != null) {
		lines.push(`- **enteredSlipperyBand**: ${slipperyFloor.enteredSlipperyBand ? 'PASS' : 'FAIL'}`);
	}
	if (slipperyFloor.screenshot) {
		lines.push(`- Screenshot: \`${slipperyFloor.screenshot}\``);
	}
	return lines;
}

function renderGlacialSlowSection(glacialSlow) {
	const lines = ['', '## Glacial slow', ''];
	if (!glacialSlow || typeof glacialSlow !== 'object') {
		lines.push('No glacial-slow probes recorded.');
		return lines;
	}
	lines.push(`- **glacialSlowApplied**: ${glacialSlow.glacialSlowApplied === true ? 'PASS' : 'FAIL'}`);
	if (glacialSlow.debugGodmodeOff != null) {
		lines.push(`- **debugGodmodeOff**: ${glacialSlow.debugGodmodeOff ? 'PASS' : 'FAIL'}`);
	}
	if (glacialSlow.playerSlowedUntil != null) {
		lines.push(`- player.slowedUntil: ${glacialSlow.playerSlowedUntil}`);
	}
	if (glacialSlow.hpBefore != null && glacialSlow.hpAfterHit != null) {
		lines.push(`- HP before/after hit: ${glacialSlow.hpBefore} → ${glacialSlow.hpAfterHit}`);
	}
	if (glacialSlow.screenshot) {
		lines.push(`- Screenshot: \`${glacialSlow.screenshot}\``);
	}
	return lines;
}

function renderStageBossGapSection(run) {
	const lines = ['', '## Stage boss gap', ''];
	const objectiveType = run.objectiveType ?? 'stage_boss';
	const hasBossEncounterProbes = run.bossEncounterUi != null || run.bossVisualIdentity != null;
	if ((run.preset === 'ice' || run.questId === 'frost_crossing') && objectiveType === 'stage_boss') {
		lines.push('Stage-boss encounter flow applies to Frost Crossing tier 1 (Permafrost Warden).');
	} else if (run.preset === 'ice' || run.questId === 'frost_crossing') {
		if (hasBossEncounterProbes) {
			lines.push('Stage-boss encounter flow applies to Frost Crossing tier 1 (Permafrost Warden).');
		} else {
			lines.push(
				'`frost_crossing` tier 1 has **no stage boss** — encounter UI and distinct boss visuals are N/A '
				+ '(tickets 283/284). The signature encounter is the named rare **Rimecast the Slow** on the ice band; '
				+ 'victory is driven by the `defeat_enemies` objective only.',
			);
		}
	} else if (objectiveType === 'defeat_enemies' || run.preset === 'fire') {
		lines.push(
			'`ember_descent` tier 1 has **no stage boss** — encounter UI and distinct boss visuals are N/A '
			+ '(tickets 283/284). Victory is driven by the `defeat_enemies` objective only.',
		);
	} else {
		lines.push('Stage-boss encounter flow applies to this preset.');
	}
	return lines;
}

function renderTelepipeSection(telepipeReset) {
	const lines = ['', '## Telepipe reset', ''];
	if (!telepipeReset || typeof telepipeReset !== 'object') {
		lines.push('No telepipe-reset probes recorded.');
		return lines;
	}

	const pre = telepipeReset.preSuspend;
	const post = telepipeReset.postDeploy;
	if (pre) {
		lines.push(`- preSuspend: HP=${pre.hp}, MS=${pre.magicStones}, runId=${pre.runId ?? '(none)'}`);
	}
	if (post) {
		lines.push(`- postDeploy: HP=${post.hp}, MS=${post.magicStones}, runId=${post.runId ?? '(none)'}`);
	}
	if (telepipeReset.telepipeVitalsPreserved != null) {
		lines.push(`- **telepipeVitalsPreserved**: ${telepipeReset.telepipeVitalsPreserved ? 'PASS' : 'FAIL'}`);
	}
	if (telepipeReset.cardChargesResetOnFreshSortie != null) {
		lines.push(`- **cardChargesResetOnFreshSortie**: ${telepipeReset.cardChargesResetOnFreshSortie ? 'PASS' : 'FAIL'}`);
	}
	return lines;
}

function renderBossEncounterUiSection(probe, run = {}) {
	const lines = ['', '## Boss encounter UI', ''];
	if (!probe || typeof probe !== 'object') {
		lines.push('No boss encounter UI probe recorded.');
		return lines;
	}
	const { displayName: expectedBossName } = parseBossSpawnLabel(
		run.bossSpawnLabel || run.bossType,
	);
	const encounterActive = probe.encounterLocked === true && probe.encounterPhase === 'active';
	lines.push(`- **hudVisible**: ${probe.hudVisible === true ? 'yes' : 'no'}`);
	lines.push(`- **bossName**: ${probe.bossName || '(empty)'}`);
	lines.push(`- **hpFillWidthPct**: ${probe.hpFillWidthPct ?? '(missing)'}`);
	lines.push(`- **encounterLocked / phase**: ${probe.encounterLocked === true ? 'locked' : 'unlocked'} / ${probe.encounterPhase ?? '(unknown)'}`);
	if (probe.hudVisible !== true) {
		lines.push('  - Note: boss encounter HUD missing or hidden during boss-active capture.');
	}
	if (!probe.bossName) {
		lines.push(`  - Note: boss display name is empty${expectedBossName ? ` (expected ${expectedBossName})` : ''}.`);
	} else if (expectedBossName && probe.bossName !== expectedBossName) {
		lines.push(`  - Note: expected "${expectedBossName}" display name for ${run.bossSpawnLabel || run.bossType || 'boss'}.`);
	}
	if (!encounterActive) {
		lines.push('  - Note: encounter was not active/locked when probed.');
	}
	return lines;
}

function renderSlowBurnSection(exercise) {
	const lines = ['', '## Slow / burn mutual exclusivity', ''];
	if (!exercise || typeof exercise !== 'object') {
		lines.push('No slow/burn card exercise recorded.');
		return lines;
	}
	lines.push(`- **targetEnemyId**: ${exercise.targetEnemyId ?? '(missing)'}`);
	lines.push(`- **afterSlow**: slowActive=${exercise.afterSlow?.slowActive === true ? 'yes' : 'no'}, burnActive=${exercise.afterSlow?.burnActive === true ? 'yes' : 'no'}`);
	lines.push(`- **afterBurn**: slowActive=${exercise.afterBurn?.slowActive === true ? 'yes' : 'no'}, burnActive=${exercise.afterBurn?.burnActive === true ? 'yes' : 'no'}`);
	lines.push(`- **slowBurnMutuallyExclusive**: ${exercise.slowBurnMutuallyExclusive === true ? 'yes' : 'no'}`);
	if (exercise.slowBurnMutuallyExclusive !== true) {
		lines.push('  - Note: enemy had both slow and burn active, or status did not match ticket 301 exclusivity.');
	}
	return lines;
}

function renderPurifyingPulseSection(exercise) {
	const lines = ['', '## Heal / cleanse (Purifying Pulse)', ''];
	if (!exercise || typeof exercise !== 'object') {
		lines.push('No Purifying Pulse exercise recorded.');
		return lines;
	}
	lines.push(`- **preCast hp**: ${exercise.preCast?.hp ?? '(missing)'}`);
	lines.push(`- **postCast hp**: ${exercise.postCast?.hp ?? '(missing)'}`);
	lines.push(`- **preCast debuffs**: slow=${exercise.preCast?.slowActive === true ? 'yes' : 'no'}, burn=${exercise.preCast?.burnActive === true ? 'yes' : 'no'}`);
	lines.push(`- **postCast debuffs**: slow=${exercise.postCast?.slowActive === true ? 'yes' : 'no'}, burn=${exercise.postCast?.burnActive === true ? 'yes' : 'no'}`);
	lines.push(`- **healCleanseApplied**: ${exercise.healCleanseApplied === true ? 'yes' : 'no'}`);
	if (exercise.healCleanseApplied !== true) {
		lines.push('  - Note: HP did not rise or slow/burn debuffs were not cleared.');
	}
	return lines;
}

function renderWindupSection(exercise) {
	const lines = ['', '## Wind-up telegraph', ''];
	if (!exercise || typeof exercise !== 'object') {
		lines.push('No wind-up card exercise recorded.');
		return lines;
	}
	lines.push(`- **cardId**: ${exercise.cardId ?? '(missing)'}`);
	lines.push(`- **cardUseState**: ${exercise.duringWindup?.cardUseState ?? '(missing)'}`);
	lines.push(`- **cardWindupCardId**: ${exercise.duringWindup?.cardWindupCardId ?? '(missing)'}`);
	lines.push(`- **inputLocked**: ${exercise.domProbe?.inputLocked === true ? 'yes' : 'no'}`);
	lines.push(`- **telegraphVisible**: ${exercise.domProbe?.telegraphVisible === true ? 'yes' : 'no'}`);
	lines.push(`- **windupTelegraphActive**: ${exercise.windupTelegraphActive === true ? 'yes' : 'no'}`);
	if (exercise.windupTelegraphActive !== true) {
		lines.push('  - Note: harness wind-up state and DOM telegraph did not agree.');
	}
	return lines;
}

function renderQuestTelepipeSection(telepipe, { emptyLabel = 'quest telepipe' } = {}) {
	const lines = ['', '## Telepipe vitals and new-sortie charges', ''];
	if (!telepipe || typeof telepipe !== 'object') {
		lines.push(`No ${emptyLabel} exercise recorded.`);
		return lines;
	}
	const pre = telepipe.preSuspend;
	const post = telepipe.postDeploy;
	if (pre) {
		lines.push(`- **preSuspend**: hp=${pre.hp}, magicStones=${pre.magicStones}, runId=${pre.runId ?? '(missing)'}`);
	}
	if (post) {
		lines.push(`- **postDeploy**: hp=${post.hp}, magicStones=${post.magicStones}, runId=${post.runId ?? '(missing)'}`);
	}
	lines.push(`- **telepipeVitalsPreserved**: ${telepipe.telepipeVitalsPreserved === true ? 'yes' : 'no'}`);
	lines.push(`- **cardChargesResetOnNewSortie**: ${telepipe.cardChargesResetOnNewSortie === true ? 'yes' : 'no'}`);
	if (telepipe.telepipeVitalsPreserved !== true) {
		lines.push('  - Note: HP or magic stones changed across suspend → abandon → redeploy.');
	}
	if (telepipe.cardChargesResetOnNewSortie !== true) {
		lines.push('  - Note: hand charges did not reset on fresh sortie after telepipe abandon.');
	}
	return lines;
}

function renderNewContentExerciseSection(screenshots) {
	const lines = ['', '## New content exercise', ''];
	const exerciseShots = (screenshots || []).filter((shot) => /0[89]-|10-|11-|12-/.test(shot));
	if (exerciseShots.length === 0) {
		lines.push('No new-content exercise screenshots recorded.');
		return lines;
	}
	for (const shot of exerciseShots) {
		const filename = shot.split('/').pop() || shot;
		lines.push(`- \`${filename}\` — see Screenshots list (\`${shot}\`)`);
	}
	return lines;
}

function renderBossVisualIdentitySection(probe, run = {}) {
	const lines = ['', '## Boss visual identity', ''];
	if (!probe || typeof probe !== 'object') {
		lines.push('No boss visual identity probe recorded.');
		return lines;
	}
	const { type: labelBossType } = parseBossSpawnLabel(run.bossSpawnLabel);
	const expectedBossType = run.bossType || labelBossType;
	lines.push(`- **bossType**: ${probe.bossType ?? '(missing)'}`);
	lines.push(`- **bossEnemyId**: ${probe.bossEnemyId ?? '(missing)'}`);
	lines.push(`- **nearestAddType**: ${probe.nearestAddType ?? '(none)'}`);
	lines.push(`- **bossDistinctFromAdds**: ${probe.bossDistinctFromAdds === true ? 'yes' : 'no'}`);
	if (probe.bossRenderScale != null || probe.addRenderScale != null) {
		lines.push(`- **bossRenderScale / addRenderScale**: ${probe.bossRenderScale ?? '?'} / ${probe.addRenderScale ?? '?'}`);
	}
	if (expectedBossType && probe.bossType && probe.bossType !== expectedBossType) {
		lines.push(`  - Note: expected boss type "${expectedBossType}" (${run.bossSpawnLabel || expectedBossType}), not ${probe.bossType}.`);
	}
	if (probe.bossDistinctFromAdds !== true) {
		const bossLabel = run.bossSpawnLabel || expectedBossType || 'boss';
		lines.push(`  - Note: ${bossLabel} type or maxHp is not clearly distinct from the nearest live add.`);
	}
	if (probe.bossRenderScale != null && probe.addRenderScale != null
		&& !(probe.bossRenderScale > probe.addRenderScale)) {
		lines.push('  - Note: boss render scale is not larger than the nearest add.');
	}
	return lines;
}

function renderFloorAlignmentSection(floorAlignment, { preset, objectiveType } = {}) {
	const lines = ['', '## Floor alignment', ''];
	const probes = floorAlignment && typeof floorAlignment === 'object' ? floorAlignment : {};
	let hasProbe = false;
	const profile = Object.values(probes).find((p) => p?.layoutProfile)?.layoutProfile ?? null;

	if (preset === 'ice' || profile === 'ice-cavern') {
		lines.push(
			'Ice-cavern layout uses **entry**, **stone**, **ice**, and **ramp** elevation bands; probes record the band at each step.',
		);
		lines.push('');
	} else if (preset === 'fire' || objectiveType === 'defeat_enemies') {
		lines.push(
			'Fire-cavern layout uses **rim**, **ramp**, and **basin** elevation bands; probes record the band at each step.',
		);
		lines.push('');
	}

	for (const [key, label] of FLOOR_ALIGNMENT_STEPS) {
		const probe = probes[key];
		if (!probe || typeof probe !== 'object') continue;
		hasProbe = true;
		const delta = Number(probe.delta);
		const deltaText = Number.isFinite(delta) ? delta.toFixed(3) : String(probe.delta);
		const band = probe.band ?? '(none)';
		const profile = probe.layoutProfile ?? '(unknown)';
		lines.push(
			`- **${label}**: playerY=${probe.playerY}, floorY=${probe.floorY}, delta=${deltaText}, profile=${profile}, band=${band}`,
		);
		if (Number.isFinite(delta) && Math.abs(delta) > FLOOR_ALIGNMENT_THRESHOLD) {
			lines.push(`  - Note: |delta| > ${FLOOR_ALIGNMENT_THRESHOLD} — player may be floating or sunken.`);
		}
		if (band !== '(none)' && !ICE_CAVERN_BANDS.has(band) && (preset === 'ice' || profile === 'ice-cavern')) {
			lines.push(`  - Note: unexpected band "${band}" for ice-cavern (expected entry, stone, ice, or ramp).`);
		}
		if (band !== '(none)' && !FIRE_CAVERN_BANDS.has(band) && (preset === 'fire' || profile === 'fire-cavern')) {
			lines.push(`  - Note: unexpected band "${band}" for fire-cavern (expected rim, ramp, or basin).`);
		}
	}

	if (!hasProbe) {
		lines.push('No floor-alignment probes recorded.');
	}

	return lines;
}

/**
 * @param {{
 *   ok: boolean,
 *   preset: string,
 *   objectiveType?: string,
 *   findingsTitle?: string,
 *   bossSpawnLabel?: string,
 *   bossType?: string,
 *   assertions: Record<string, boolean>,
 *   floorAlignment?: Record<string, object>,
 *   emberBurn?: object | null,
 *   slipperyFloor?: object | null,
 *   glacialSlow?: object | null,
 *   questId?: string,
 *   cardMechanics?: object | null,
 *   telepipeReset?: object | null,
 *   bossEncounterUi?: object | null,
 *   bossVisualIdentity?: object | null,
 *   cardExercises?: { slowBurn?: object, purifyingPulse?: object, windup?: object } | null,
 *   canyonTelepipe?: object | null,
 *   roomsTelepipe?: object | null,
 *   spireTelepipe?: object | null,
 *   consoleErrors?: string[],
 *   screenshots?: string[],
 *   visualNotes?: string[],
 *   error?: string | null,
 * }} run
 * @returns {string}
 */
export function renderFindings(run) {
	const { title } = resolvePresetCopy(run);
	const objectiveType = run.objectiveType ?? 'stage_boss';
	const lines = [
		`# ${title}`,
		'',
		`**Outcome:** ${run.ok ? 'PASS' : 'FAIL'}`,
		`**Preset:** ${run.preset}`,
		'',
	];

	lines.push(...renderAssertionSection(run));

	if (run.preset === 'rooms') {
		lines.push(
			formatAssertion('bossEncounterUiVisible', run.assertions?.bossEncounterUiVisible === true),
			formatAssertion('bossDistinctFromAdds', run.assertions?.bossDistinctFromAdds === true),
			formatAssertion('slowBurnMutuallyExclusive', run.assertions?.slowBurnMutuallyExclusive === true),
			formatAssertion('healCleanseApplied', run.assertions?.healCleanseApplied === true),
			formatAssertion('windupTelegraphActive', run.assertions?.windupTelegraphActive === true),
			formatAssertion('telepipeVitalsPreserved', run.assertions?.telepipeVitalsPreserved === true),
			formatAssertion('cardChargesResetOnNewSortie', run.assertions?.cardChargesResetOnNewSortie === true),
		);
	}

	if (run.preset === 'sunken-canyon' || run.preset === 'spire-ascent') {
		lines.push(
			formatAssertion('bossEncounterUiVisible', run.assertions?.bossEncounterUiVisible === true),
			formatAssertion('bossDistinctFromAdds', run.assertions?.bossDistinctFromAdds === true),
			formatAssertion('slowBurnMutuallyExclusive', run.assertions?.slowBurnMutuallyExclusive === true),
			formatAssertion('healCleanseApplied', run.assertions?.healCleanseApplied === true),
			formatAssertion('windupTelegraphActive', run.assertions?.windupTelegraphActive === true),
			formatAssertion('telepipeVitalsPreserved', run.assertions?.telepipeVitalsPreserved === true),
			formatAssertion('cardChargesResetOnNewSortie', run.assertions?.cardChargesResetOnNewSortie === true),
		);
	}

	if (run.preset === 'ice' && objectiveType === 'stage_boss') {
		lines.push(
			formatAssertion('bossEncounterUiVisible', run.assertions?.bossEncounterUiVisible === true),
			formatAssertion('slipperyFloorOk', run.assertions?.slipperyFloorOk === true),
			formatAssertion('glacialSlowApplied', run.assertions?.glacialSlowApplied === true),
			formatAssertion('cardMechanicsOk', run.assertions?.cardMechanicsOk === true),
			formatAssertion('telepipeVitalsPreserved', run.assertions?.telepipeVitalsPreserved === true),
			formatAssertion('cardChargesResetOnFreshSortie', run.assertions?.cardChargesResetOnFreshSortie === true),
		);
	}

	if (run.error) {
		lines.push('', '## Failure', '', run.error);
	}

	if (run.preset === 'ice' || run.questId === 'frost_crossing') {
		lines.push(...renderSlipperyFloorSection(run.slipperyFloor));
		lines.push(...renderGlacialSlowSection(run.glacialSlow));
		lines.push(...renderCardMechanicsSection(run.cardMechanics));
		if (objectiveType !== 'stage_boss') {
			lines.push(...renderStageBossGapSection(run));
		}
		lines.push(...renderTelepipeSection(run.telepipeReset));
	} else if (objectiveType === 'defeat_enemies' || run.preset === 'fire') {
		lines.push(...renderEmberBurnSection(run.emberBurn));
		lines.push(...renderCardMechanicsSection(run.cardMechanics));
		lines.push(...renderStageBossGapSection(run));
		lines.push(...renderTelepipeSection(run.telepipeReset));
	}

	const consoleErrors = (run.consoleErrors || []).filter((e) => e.includes('[pageerror]') || e.includes('[console:error]'));
	lines.push('', '## Console / page errors', '');
	if (consoleErrors.length === 0) {
		lines.push('None observed.');
	} else {
		for (const entry of consoleErrors) {
			lines.push(`- ${entry}`);
		}
	}

	lines.push('', '## Visual notes', '');
	const notes = run.visualNotes || [];
	if (notes.length === 0) {
		lines.push('No visual glitches recorded by the driver.');
	} else {
		for (const note of notes) {
			lines.push(`- ${note}`);
		}
	}

	lines.push(...renderFloorAlignmentSection(run.floorAlignment, {
		preset: run.preset,
		objectiveType,
	}));
	lines.push(...renderBossEncounterUiSection(run.bossEncounterUi, run));
	lines.push(...renderBossVisualIdentitySection(run.bossVisualIdentity, run));
	lines.push(...renderSlowBurnSection(run.cardExercises?.slowBurn));
	lines.push(...renderPurifyingPulseSection(run.cardExercises?.purifyingPulse));
	lines.push(...renderWindupSection(run.cardExercises?.windup));
	if (run.preset === 'spire-ascent') {
		lines.push(...renderQuestTelepipeSection(run.spireTelepipe, { emptyLabel: 'spire-ascent telepipe' }));
	} else if (run.preset === 'rooms') {
		lines.push(...renderQuestTelepipeSection(run.roomsTelepipe, { emptyLabel: 'rooms telepipe' }));
	} else {
		lines.push(...renderQuestTelepipeSection(run.canyonTelepipe, { emptyLabel: 'canyon telepipe' }));
	}
	if (run.preset === 'spire-ascent' || run.preset === 'sunken-canyon' || run.preset === 'rooms') {
		lines.push(...renderNewContentExerciseSection(run.screenshots));
	}

	lines.push('', '## Screenshots', '');
	for (const shot of run.screenshots || []) {
		lines.push(`- \`${shot}\``);
	}

	lines.push('', '## Follow-ups', '');
	if (run.ok) {
		lines.push('None — green run.');
	} else {
		lines.push('Investigate failing assertions above; see `run-summary.json` and `console.log` for probes.');
	}

	return `${lines.join('\n')}\n`;
}
