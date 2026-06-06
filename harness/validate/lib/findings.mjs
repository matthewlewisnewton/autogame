/**
 * Render validation findings markdown from a playthrough run summary.
 */

const PRESET_TITLES = {
	rooms: 'Rooms validation findings',
	'spire-ascent': 'Spire Ascent validation findings',
};

function findingsTitle(preset) {
	return PRESET_TITLES[preset] ?? `${preset} validation findings`;
}

function formatAssertion(name, passed, detail = '') {
	const status = passed ? 'PASS' : 'FAIL';
	const suffix = detail ? ` — ${detail}` : '';
	return `- **${name}**: ${status}${suffix}`;
}

/**
 * @param {{
 *   ok: boolean,
 *   preset: string,
 *   bossType: string,
 *   assertions: Record<string, boolean>,
 *   consoleErrors?: string[],
 *   screenshots?: string[],
 *   visualNotes?: string[],
 *   error?: string | null,
 * }} run
 * @returns {string}
 */
export function renderFindings(run) {
	if (!run.bossType) {
		throw new Error('renderFindings requires bossType');
	}

	const lines = [
		`# ${findingsTitle(run.preset)}`,
		'',
		`**Outcome:** ${run.ok ? 'PASS' : 'FAIL'}`,
		`**Preset:** ${run.preset}`,
		'',
		'## Assertions',
		'',
		formatAssertion(`bossSpawned (${run.bossType})`, run.assertions?.bossSpawned === true),
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
