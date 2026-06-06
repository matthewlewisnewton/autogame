/**
 * Hub lobby movement helpers — keyboard nudges toward zone centres.
 */
import { readHarness } from './harnessState.mjs';
import { HUB_ZONE_CENTERS } from './multiPlayer.mjs';

const ARRIVAL_RADIUS = 3;
const MAX_NUDGE_ROUNDS = 12;

function directionKeys(dx, dz) {
	const keys = [];
	if (Math.abs(dx) >= Math.abs(dz)) {
		if (dx > 0.5) keys.push('d');
		else if (dx < -0.5) keys.push('a');
	} else if (dz > 0.5) keys.push('s');
	else if (dz < -0.5) keys.push('w');
	if (keys.length === 0) keys.push('w');
	return keys;
}

async function focusCanvas(page) {
	await page.evaluate(() => document.querySelector('canvas')?.focus());
}

async function nudgeToward(page, targetX, targetZ, { steps = 4, holdMs = 450 } = {}) {
	const harness = await readHarness(page);
	const player = harness?.player;
	if (!player || targetX == null || targetZ == null) return;
	const keys = directionKeys(targetX - player.x, targetZ - player.z);
	for (let i = 0; i < steps; i += 1) {
		for (const key of keys) {
			await page.keyboard.down(key);
			await page.waitForTimeout(holdMs);
			await page.keyboard.up(key);
		}
	}
}

function zoneTarget(zoneName, boothAnchors) {
	if (HUB_ZONE_CENTERS[zoneName]) return HUB_ZONE_CENTERS[zoneName];
	const anchorKey = {
		operations: 'quest',
		commerce: 'shop',
		salon: 'character',
	}[zoneName];
	if (anchorKey && boothAnchors?.[anchorKey]) {
		return boothAnchors[anchorKey];
	}
	throw new Error(`Unknown hub zone "${zoneName}"`);
}

/**
 * Drive WASD nudges until the local player reaches a hub zone centre.
 * @returns {Promise<object>} harness state after arrival
 */
export async function walkToZone(page, zoneName, boothAnchors, { steps = 4, holdMs = 450 } = {}) {
	const target = zoneTarget(zoneName, boothAnchors);
	await focusCanvas(page);

	const startHarness = await readHarness(page);
	const startX = startHarness?.player?.x;
	const startZ = startHarness?.player?.z;

	for (let round = 0; round < MAX_NUDGE_ROUNDS; round += 1) {
		const harness = await readHarness(page);
		if (harness?.layout?.profile !== 'hub') {
			throw new Error(`Left hub layout while walking to ${zoneName}: ${JSON.stringify(harness?.layout)}`);
		}
		const player = harness?.player;
		if (!player || player.x == null || player.z == null) {
			throw new Error(`Missing local player position for zone ${zoneName}`);
		}
		const dist = Math.hypot(player.x - target.x, player.z - target.z);
		if (dist <= ARRIVAL_RADIUS) {
			if (startX != null && startZ != null) {
				const moved = Math.hypot(player.x - startX, player.z - startZ);
				if (moved < 0.05) {
					await nudgeToward(page, target.x + 1.5, target.z, { steps: 2, holdMs });
					continue;
				}
			}
			return harness;
		}
		await nudgeToward(page, target.x, target.z, { steps, holdMs });
	}

	const finalHarness = await readHarness(page);
	throw new Error(
		`Failed to reach hub zone ${zoneName} within ${MAX_NUDGE_ROUNDS} nudge rounds: ${JSON.stringify(finalHarness?.player)}`,
	);
}
