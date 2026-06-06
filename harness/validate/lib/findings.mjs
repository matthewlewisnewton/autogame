/**
 * Render validation/rooms/findings.md from a playthrough run summary.
 */

function formatAssertion(name, passed, detail = '') {
	const status = passed ? 'PASS' : 'FAIL';
	const suffix = detail ? ` — ${detail}` : '';
	return `- **${name}**: ${status}${suffix}`;
}

/**
 * @param {{
 *   ok: boolean,
 *   preset: string,
 *   assertions: Record<string, boolean>,
 *   consoleErrors?: string[],
 *   screenshots?: string[],
 *   visualNotes?: string[],
 *   error?: string | null,
 * }} run
 * @returns {string}
 */
export function renderFindings(run) {
	const lines = [
		'# Rooms validation findings',
		'',
		`**Outcome:** ${run.ok ? 'PASS' : 'FAIL'}`,
		`**Preset:** ${run.preset}`,
		'',
		'## Assertions',
		'',
		formatAssertion('bossSpawned (annex_overseer)', run.assertions?.bossSpawned === true),
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
