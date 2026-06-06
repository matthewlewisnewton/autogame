/**
 * Render validation findings.md from a playthrough run summary.
 */

const FLOOR_ALIGNMENT_STEPS = [
	['levelEntry', 'Level entry'],
	['midCombat', 'Mid combat'],
	['bossDormant', 'Boss dormant'],
	['bossActive', 'Boss active'],
];

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

function renderFloorAlignmentSection(floorAlignment) {
	const lines = ['', '## Floor alignment', ''];
	const probes = floorAlignment && typeof floorAlignment === 'object' ? floorAlignment : {};
	let hasProbe = false;

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
 *   findingsTitle?: string,
 *   bossSpawnLabel?: string,
 *   bossType?: string,
 *   assertions: Record<string, boolean>,
 *   floorAlignment?: Record<string, object>,
 *   consoleErrors?: string[],
 *   screenshots?: string[],
 *   visualNotes?: string[],
 *   error?: string | null,
 * }} run
 * @returns {string}
 */
export function renderFindings(run) {
	const { title, bossSpawnLabel } = resolvePresetCopy(run);
	const lines = [
		`# ${title}`,
		'',
		`**Outcome:** ${run.ok ? 'PASS' : 'FAIL'}`,
		`**Preset:** ${run.preset}`,
		'',
		'## Assertions',
		'',
		formatAssertion(`bossSpawned (${bossSpawnLabel})`, run.assertions?.bossSpawned === true),
		formatAssertion('encounterActivated', run.assertions?.encounterActivated === true),
		formatAssertion('bossDefeated', run.assertions?.bossDefeated === true),
		formatAssertion('victoryFired', run.assertions?.victoryFired === true),
	];

	if (run.error) {
		lines.push('', '## Failure', '', run.error);
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

	lines.push(...renderFloorAlignmentSection(run.floorAlignment));

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
