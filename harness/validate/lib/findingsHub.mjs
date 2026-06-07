/**
 * Render game/validation/hub/findings.md from a hub playthrough run summary.
 */

const WALKABLE_ZONES = ['operations', 'commerce', 'salon'];

const WALKABLE_PROBE_KEYS = ['lobbyHidden', 'lobbyMenuDismissed', 'hubCanvasActive'];

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
	const runIdChanged = pre?.runId && post?.runId && pre.runId !== post.runId;
	const checkpointRestored = reset.checkpointRestoredInLog === true;
	return [
		`preSuspend hp=${pre?.hp}, ms=${pre?.magicStones}; postDeploy hp=${post?.hp}, ms=${post?.magicStones}`,
		`runId ${pre?.runId ?? '?'}→${post?.runId ?? '?'} (${runIdChanged ? 'changed' : 'unchanged'})`,
		`checkpoint restored in log: ${checkpointRestored ? 'yes (FAIL)' : 'no'}`,
	].join('; ');
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

function formatWalkableProbeRow(label, probe) {
	if (!probe || typeof probe !== 'object') {
		return `- **${label}**: probe missing`;
	}
	return [
		`- **${label}**:`,
		`lobbyHidden=${probe.lobbyHidden},`,
		`lobbyMenuDismissed=${probe.lobbyMenuDismissed},`,
		`hubCanvasActive=${probe.hubCanvasActive},`,
		`playersOnHost=${probe.playersOnHost ?? '?'}`,
		`remoteSquadmateCount=${probe.remoteSquadmateCount ?? '?'}`,
	].join(' ');
}

/**
 * @param {object | null | undefined} hubWalk
 * @returns {{ ok: boolean, issues: string[] }}
 */
export function evaluateWalkablePresentation(hubWalk) {
	const issues = [];
	if (!hubWalk || typeof hubWalk !== 'object') {
		issues.push('hubWalk step missing');
		return { ok: false, issues };
	}

	const wp = hubWalk.walkablePresentation;
	if (!wp || typeof wp !== 'object') {
		issues.push('hubWalk.walkablePresentation missing');
		return { ok: false, issues };
	}

	if (!wp.overview || typeof wp.overview !== 'object') {
		issues.push('walkablePresentation.overview missing');
	}

	const zones = wp.zones;
	if (!zones || typeof zones !== 'object') {
		issues.push('walkablePresentation.zones missing');
	} else {
		for (const zone of WALKABLE_ZONES) {
			if (!zones[zone] || typeof zones[zone] !== 'object') {
				issues.push(`walkablePresentation.zones.${zone} missing`);
			}
		}
	}

	const probes = [
		['overview', wp.overview],
		...WALKABLE_ZONES.map((zone) => [zone, zones?.[zone]]),
	];
	for (const [name, probe] of probes) {
		if (!probe || typeof probe !== 'object') continue;
		for (const key of WALKABLE_PROBE_KEYS) {
			if (probe[key] !== true) {
				issues.push(`${name} probe ${key} !== true (got ${JSON.stringify(probe[key])})`);
			}
		}
	}

	if (!Number.isFinite(hubWalk.playersOnHost) || hubWalk.playersOnHost < 2) {
		issues.push(`hubWalk.playersOnHost < 2 (got ${hubWalk.playersOnHost ?? 'missing'})`);
	}

	const overviewRemote = wp.overview?.remoteSquadmateCount;
	if (!Number.isFinite(overviewRemote) || overviewRemote < 1) {
		issues.push(`overview remoteSquadmateCount < 1 (got ${overviewRemote ?? 'missing'})`);
	}

	return { ok: issues.length === 0, issues };
}

function walkablePresentationNotes(hubWalk) {
	const notes = [];
	const wp = hubWalk?.walkablePresentation;
	if (!wp) {
		notes.push('Walkable presentation probes were not recorded (hub-walk step may predate post-304 probes).');
		return notes;
	}

	notes.push(formatWalkableProbeRow('overview', wp.overview));
	for (const zone of WALKABLE_ZONES) {
		notes.push(formatWalkableProbeRow(zone, wp.zones?.[zone]));
	}

	const overviewOk = wp.overview?.lobbyHidden === true
		&& wp.overview?.lobbyMenuDismissed === true
		&& wp.overview?.hubCanvasActive === true;
	const allZonesOk = WALKABLE_ZONES.every((zone) => {
		const probe = wp.zones?.[zone];
		return probe?.lobbyHidden === true
			&& probe?.lobbyMenuDismissed === true
			&& probe?.hubCanvasActive === true;
	});

	if (overviewOk && allZonesOk) {
		notes.push('- **3D hub visible with menu closed**: Yes — lobby hidden, menu dismissed, and canvas active on overview and all zone walk captures.');
	} else {
		notes.push('- **3D hub visible with menu closed**: No — one or more walk captures show lobby/menu dominance or an inactive canvas.');
	}

	const menuDominanceZones = WALKABLE_ZONES.filter((zone) => {
		const probe = wp.zones?.[zone];
		return probe && (probe.lobbyHidden !== true || probe.lobbyMenuDismissed !== true);
	});
	if (menuDominanceZones.length === 0 && overviewOk) {
		notes.push('- **Menu dominance on walk captures**: None observed.');
	} else {
		const targets = menuDominanceZones.length > 0 ? menuDominanceZones.join(', ') : 'overview';
		notes.push(`- **Menu dominance on walk captures**: Remaining issues on ${targets}.`);
	}

	const playersOk = Number.isFinite(hubWalk?.playersOnHost) && hubWalk.playersOnHost >= 2;
	const remoteOk = Number.isFinite(wp.overview?.remoteSquadmateCount) && wp.overview.remoteSquadmateCount >= 1;
	if (playersOk && remoteOk) {
		notes.push(`- **Party-mates in-world**: Yes — ${hubWalk.playersOnHost} players on host and ${wp.overview.remoteSquadmateCount} remote squadmate(s) in harness.`);
	} else {
		notes.push('- **Party-mates in-world**: No — need ≥2 players on host and ≥1 remote squadmate in harness.');
	}

	return notes;
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
	const walkable = evaluateWalkablePresentation(run.hubWalk);
	const outcomeOk = run.ok === true && walkable.ok;
	const lines = [
		'# Hub validation findings',
		'',
		`**Outcome:** ${outcomeOk ? 'PASS' : 'FAIL'}`,
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
			'telepipeVitalsPreserved',
			assertions.telepipeVitalsPreserved === true,
			telepipeDetail(run),
		),
	];

	if (run.error) {
		lines.push('', '## Failure', '', run.error);
	}

	lines.push('', '## Walkable presentation', '');
	for (const note of walkablePresentationNotes(run.hubWalk)) {
		lines.push(note);
	}
	if (!walkable.ok) {
		for (const issue of walkable.issues) {
			lines.push(`- Probe issue: ${issue}`);
		}
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
	if (outcomeOk) {
		lines.push('None — green run.');
	} else {
		lines.push('Investigate failing assertions above; see `run-summary.json`, `probes.json`, and `console.log`.');
	}

	return `${lines.join('\n')}\n`;
}
