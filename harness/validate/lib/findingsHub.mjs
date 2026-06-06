/**
 * Render game/validation/hub/findings.md from a hub playthrough run summary.
 */

function formatAssertion(name, passed, detail = '') {
	const status = passed ? 'PASS' : 'FAIL';
	const suffix = detail ? ` — ${detail}` : '';
	return `- **${name}**: ${status}${suffix}`;
}

function boothDetail(summary) {
	const booth = summary.booth;
	if (!booth) return 'booth step missing';
	return `paid ${booth.currencyBefore}→${booth.currencyAfterPaid} (Δ${booth.paidDelta}), hat ${booth.currencyBeforeHat}→${booth.currencyAfterHat} (Δ${booth.hatDelta})`;
}

function telepipeDetail(summary) {
	const reset = summary.telepipeReset;
	if (!reset) return 'telepipe-reset step missing';
	const pre = reset.preSuspend;
	const post = reset.postDeploy;
	return `preSuspend ms=${pre?.magicStones}, postDeploy ms=${post?.magicStones}`;
}

function hubWalkNotes(summary) {
	const walk = summary.hubWalk;
	if (!walk) return ['Hub walk step did not run.'];
	const notes = [];
	if (walk.lobbyName) notes.push(`Lobby: ${walk.lobbyName}`);
	if (walk.playersOnHost != null) notes.push(`Players on host at end: ${walk.playersOnHost}`);
	if (walk.layoutProfile) notes.push(`Layout profile: ${walk.layoutProfile}`);
	if (walk.layoutRoomCount != null) notes.push(`Hub room count: ${walk.layoutRoomCount}`);
	if (walk.zoneScreenshots && typeof walk.zoneScreenshots === 'object') {
		for (const [zone, shot] of Object.entries(walk.zoneScreenshots)) {
			notes.push(`${zone}: \`${shot}\``);
		}
	}
	return notes.length > 0 ? notes : ['Hub walk completed (no extra notes).'];
}

/**
 * @param {{
 *   ok: boolean,
 *   preset: string,
 *   assertions: Record<string, boolean>,
 *   consoleErrors?: string[],
 *   screenshots?: string[],
 *   hubWalk?: object,
 *   booth?: object,
 *   telepipeReset?: object,
 *   error?: string | null,
 * }} run
 * @returns {string}
 */
export function renderHubFindings(run) {
	const assertions = run.assertions || {};
	const lines = [
		'# Hub validation findings',
		'',
		`**Outcome:** ${run.ok ? 'PASS' : 'FAIL'}`,
		`**Preset:** ${run.preset}`,
		'',
		'## Assertions',
		'',
		formatAssertion(
			'boothDeductsGold',
			assertions.boothDeductsGold === true,
			boothDetail(run),
		),
		formatAssertion(
			'hatSwapFree',
			assertions.hatSwapFree === true,
			boothDetail(run),
		),
		formatAssertion(
			'telepipeUpReset',
			assertions.telepipeUpReset === true,
			telepipeDetail(run),
		),
	];

	if (run.error) {
		lines.push('', '## Failure', '', run.error);
	}

	lines.push('', '## Hub walk notes', '');
	for (const note of hubWalkNotes(run)) {
		lines.push(`- ${note}`);
	}

	const consoleErrors = (run.consoleErrors || []).filter(
		(e) => e.includes('[pageerror]') || e.includes('[console:error]'),
	);
	lines.push('', '## Console / page errors', '');
	if (consoleErrors.length === 0) {
		lines.push('None observed.');
	} else {
		for (const entry of consoleErrors) {
			lines.push(`- ${entry}`);
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
		lines.push('Investigate failing assertions above; see `run-summary.json`, `probes.json`, and `console.log`.');
	}

	return `${lines.join('\n')}\n`;
}
