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

function renderAssertionSection(run) {
	const lines = ['', '## Assertions', ''];
	const objectiveType = run.objectiveType ?? 'stage_boss';

	if (objectiveType === 'defeat_enemies') {
		lines.push(formatAssertion('layoutDeployed', run.assertions?.layoutDeployed === true));
		lines.push(formatAssertion('enemiesCleared', run.assertions?.enemiesCleared === true));
		lines.push(formatAssertion('victoryFired', run.assertions?.victoryFired === true));
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

function renderStageBossGapSection(run) {
	const lines = ['', '## Stage boss gap', ''];
	const objectiveType = run.objectiveType ?? 'stage_boss';
	if (objectiveType === 'defeat_enemies' || run.preset === 'fire') {
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

function renderFloorAlignmentSection(floorAlignment, { preset, objectiveType } = {}) {
	const lines = ['', '## Floor alignment', ''];
	const probes = floorAlignment && typeof floorAlignment === 'object' ? floorAlignment : {};
	let hasProbe = false;

	if (preset === 'fire' || objectiveType === 'defeat_enemies') {
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
 *   cardMechanics?: object | null,
 *   telepipeReset?: object | null,
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

	if (run.error) {
		lines.push('', '## Failure', '', run.error);
	}

	if (objectiveType === 'defeat_enemies' || run.preset === 'fire') {
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
