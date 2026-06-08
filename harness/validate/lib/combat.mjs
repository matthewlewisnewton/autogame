/**
 * Playwright combat helpers for validation playthroughs.
 */
import { readHarness } from './harnessState.mjs';

const DEFAULT_ADD_TYPES = ['grunt', 'skirmisher'];

function addTypeSet(addTypes) {
	return new Set(addTypes ?? DEFAULT_ADD_TYPES);
}

function questAdds(harness, bossType, addTypes) {
	const types = addTypeSet(addTypes);
	return (harness?.enemyHp || []).filter(
		(e) => e.type !== bossType && e.hp > 0 && types.has(e.type),
	);
}

async function readLockOnState(page) {
	return page.evaluate(async () => {
		const mod = await import('/lockOn.js');
		return { active: mod.isLockOnActive(), targetId: mod.getLockedEnemyId() };
	});
}

function usable(card) {
	return card && (card.remainingCharges == null || card.remainingCharges > 0);
}

function chooseAttack(harness) {
	if (!harness || !Array.isArray(harness.hand)) return null;
	const weaponSlot = harness.hand.findIndex((c) => usable(c) && c.type === 'weapon');
	if (weaponSlot >= 0) return { mode: 'weapon', slot: weaponSlot };
	const summonSlot = harness.hand.findIndex((c) => usable(c) && (c.type === 'creature' || c.type === 'spell'));
	if (summonSlot >= 0) return { mode: 'summon', slot: summonSlot };
	return null;
}

function nonBossEnemies(harness, bossType, addTypes) {
	return questAdds(harness, bossType, addTypes);
}

function bossEnemy(harness, bossType) {
	return (harness?.enemyHp || []).find((e) => e.type === bossType && e.hp > 0) || null;
}

function nearestEnemy(harness, bossType, { addsOnly = false, addTypes } = {}) {
	const player = harness?.player;
	if (!player) return null;
	const pool = addsOnly
		? nonBossEnemies(harness, bossType, addTypes)
		: (harness?.enemyHp || []).filter((e) => e.hp > 0);
	if (pool.length === 0) return null;
	let nearest = null;
	let bestDist = Infinity;
	for (const enemy of pool) {
		if (enemy.x == null || enemy.z == null) continue;
		const dist = Math.hypot(enemy.x - player.x, enemy.z - player.z);
		if (dist < bestDist) {
			bestDist = dist;
			nearest = enemy;
		}
	}
	return nearest ? { enemy: nearest, dist: bestDist } : null;
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

async function lockOntoNearestAdd(page, bossType, addTypes) {
	const harness = await readHarness(page);
	const target = nearestEnemy(harness, bossType, { addsOnly: true, addTypes });
	if (target && target.dist > 5) {
		await nudgeToward(page, target.enemy.x, target.enemy.z, { steps: 2, holdMs: 400 });
	}
	await page.keyboard.press('z');
	await page.waitForTimeout(300);
	const lock = await readLockOnState(page);
	if (!lock.active) return false;
	const after = await readHarness(page);
	const locked = (after?.enemyHp || []).find((e) => e.id === lock.targetId);
	return !!(locked && locked.type !== bossType);
}

async function lockOntoBoss(page, bossType) {
	const harness = await readHarness(page);
	const boss = bossEnemy(harness, bossType);
	if (!boss) return true;
	const player = harness?.player;
	if (player && boss.x != null && boss.z != null) {
		const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
		if (dist > 5) {
			await nudgeToward(page, boss.x, boss.z, { steps: 3, holdMs: 500 });
		}
	}
	await page.keyboard.press('z');
	await page.waitForTimeout(300);
	const lock = await readLockOnState(page);
	if (!lock.active) return false;
	const after = await readHarness(page);
	const locked = (after?.enemyHp || []).find((e) => e.id === lock.targetId);
	return !!(locked && locked.type === bossType);
}

async function swingAtTarget(page, attackKey, bossType, { minAddsLeft = 0, addTypes } = {}) {
	const before = await readHarness(page);
	const addsBefore = nonBossEnemies(before, bossType, addTypes).length;
	if (addsBefore <= minAddsLeft) return before;

	for (let swing = 0; swing < 8; swing += 1) {
		await page.keyboard.press(attackKey);
		await page.waitForTimeout(900);

		const after = await readHarness(page);
		const addsAfter = nonBossEnemies(after, bossType, addTypes).length;
		if (addsAfter <= minAddsLeft) return after;
		if (addsAfter < addsBefore) return after;
	}
	return readHarness(page);
}

/**
 * @param {import('playwright').Page} page
 */
export async function enableGodmode(page) {
	const alreadyOn = await readHarness(page);
	if (alreadyOn?.player?.debugGodmode === true) {
		return alreadyOn;
	}

	await page.evaluate(() => {
		if (typeof window.__toggleDebugGodmodeForTest !== 'function') {
			throw new Error('__toggleDebugGodmodeForTest missing');
		}
		window.__toggleDebugGodmodeForTest();
	});

	await page.waitForFunction(() => {
		const h = window.__AUTOGAME_HARNESS_STATE__?.();
		return h?.debugGodmodeResult?.ok === true && h?.player?.debugGodmode === true;
	}, { timeout: 5000 });

	const harness = await readHarness(page);
	if (harness?.debugGodmodeResult?.ok !== true || harness?.player?.debugGodmode !== true) {
		throw new Error(`Godmode failed: ${JSON.stringify({
			debugGodmodeResult: harness?.debugGodmodeResult,
			debugGodmode: harness?.player?.debugGodmode,
		})}`);
	}
	return harness;
}

/**
 * @param {import('playwright').Page} page
 * @param {{ bossType: string, timeoutMs?: number, minAddsLeft?: number, addTypes?: string[], onMidCombat?: () => Promise<void> }} opts
 */
async function focusCanvas(page) {
	await page.evaluate(() => {
		document.querySelector('canvas:not(.cosmetic-preview-canvas)')?.focus();
	});
}

export async function defeatAdds(page, {
	bossType,
	timeoutMs = 90000,
	minAddsLeft = 0,
	addTypes,
	onMidCombat = null,
}) {
	const deadline = Date.now() + timeoutMs;
	let midCombatCaptured = false;
	await focusCanvas(page);

	while (Date.now() < deadline) {
		const harness = await readHarness(page);
		const adds = nonBossEnemies(harness, bossType, addTypes);
		if (adds.length <= minAddsLeft) return harness;

		const target = nearestEnemy(harness, bossType, { addsOnly: true, addTypes });
		if (target && target.dist > 5) {
			await nudgeToward(page, target.enemy.x, target.enemy.z, { steps: 3, holdMs: 500 });
		}

		if (!midCombatCaptured && adds.length > 0 && typeof onMidCombat === 'function') {
			await onMidCombat();
			midCombatCaptured = true;
		}

		const attack = chooseAttack(harness);
		if (!attack) {
			throw new Error(`No usable attack card to defeat adds: ${JSON.stringify(harness?.hand)}`);
		}
		const attackKey = String(attack.slot + 1);
		if (attack.mode === 'weapon') {
			const locked = await lockOntoNearestAdd(page, bossType, addTypes);
			if (!locked) {
				if (target) {
					await nudgeToward(page, target.enemy.x, target.enemy.z, { steps: 2, holdMs: 400 });
				} else {
					await page.keyboard.down('w');
					await page.waitForTimeout(400);
					await page.keyboard.up('w');
				}
				continue;
			}
			await swingAtTarget(page, attackKey, bossType, { minAddsLeft, addTypes });
		} else {
			await page.keyboard.press(attackKey);
			await page.waitForTimeout(4000);
		}
	}

	const finalHarness = await readHarness(page);
	const remaining = nonBossEnemies(finalHarness, bossType, addTypes).length;
	if (remaining > minAddsLeft) {
		throw new Error(`Adds not cleared within timeout (remaining ${remaining}, wanted <= ${minAddsLeft})`);
	}
	return finalHarness;
}

async function swingAtBoss(page, attackKey, bossType) {
	const before = await readHarness(page);
	const bossBefore = bossEnemy(before, bossType);
	if (!bossBefore) return before;

	for (let swing = 0; swing < 8; swing += 1) {
		await page.keyboard.press(attackKey);
		await page.waitForTimeout(900);

		const after = await readHarness(page);
		const bossAfter = bossEnemy(after, bossType);
		if (!bossAfter) return after;
		if (bossAfter.hp < bossBefore.hp) return after;
	}
	return readHarness(page);
}

/**
 * @param {import('playwright').Page} page
 * @param {{ bossType: string, timeoutMs?: number }} opts
 */
export async function defeatBoss(page, { bossType, timeoutMs = 180000 }) {
	const deadline = Date.now() + timeoutMs;
	await focusCanvas(page);

	while (Date.now() < deadline) {
		const harness = await readHarness(page);
		const boss = bossEnemy(harness, bossType);
		if (!boss) return harness;

		const player = harness?.player;
		if (player && boss.x != null && boss.z != null) {
			const dist = Math.hypot(boss.x - player.x, boss.z - player.z);
			if (dist > 5) {
				await nudgeToward(page, boss.x, boss.z, { steps: 3, holdMs: 500 });
			}
		}

		const attack = chooseAttack(harness);
		if (!attack) {
			throw new Error(`No usable attack card to defeat boss: ${JSON.stringify(harness?.hand)}`);
		}
		const attackKey = String(attack.slot + 1);
		if (attack.mode === 'weapon') {
			const locked = await lockOntoBoss(page, bossType);
			if (!locked) {
				await page.keyboard.down('w');
				await page.waitForTimeout(400);
				await page.keyboard.up('w');
				continue;
			}
			await swingAtBoss(page, attackKey, bossType);
		} else {
			await page.keyboard.press(attackKey);
			await page.waitForTimeout(4000);
		}
	}

	const finalHarness = await readHarness(page);
	if (bossEnemy(finalHarness, bossType)) {
		throw new Error(`Boss ${bossType} not defeated within timeout`);
	}
	return finalHarness;
}

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

/**
 * @param {import('playwright').Page} page
 * @param {{ bossType: string, triggerRadius: number, timeoutMs?: number }} opts
 */
export async function activateEncounter(page, { bossType, triggerRadius, timeoutMs = 60000 }) {
	const deadline = Date.now() + timeoutMs;
	await focusCanvas(page);

	while (Date.now() < deadline) {
		const harness = await readHarness(page);
		if (harness?.encounter?.phase === 'active' && harness?.encounter?.locked === true) {
			return harness;
		}

		const boss = bossEnemy(harness, bossType);
		const player = harness?.player;
		if (!boss || !player) {
			await page.waitForTimeout(200);
			continue;
		}

		const dx = boss.x - player.x;
		const dz = boss.z - player.z;
		const dist = Math.hypot(dx, dz);

		if (dist <= triggerRadius) {
			await page.waitForFunction(() => {
				const h = window.__AUTOGAME_HARNESS_STATE__?.();
				return h?.encounter?.phase === 'active' && h?.encounter?.locked === true;
			}, { timeout: 8000 }).catch(() => {});
			const after = await readHarness(page);
			if (after?.encounter?.phase === 'active') return after;
		}

		const keys = directionKeys(dx, dz);
		const holdMs = dist <= triggerRadius + 2 ? 4000 : 2000;
		for (const key of keys) {
			await page.keyboard.down(key);
		}
		await page.waitForTimeout(holdMs);
		for (const key of keys) {
			await page.keyboard.up(key);
		}

	}

	const finalHarness = await readHarness(page);
	throw new Error(`Encounter did not activate within timeout: ${JSON.stringify({
		phase: finalHarness?.encounter?.phase,
		locked: finalHarness?.encounter?.locked,
		player: finalHarness?.player,
		boss: bossEnemy(finalHarness, bossType),
		dist: finalHarness?.player && bossEnemy(finalHarness, bossType)
			? Math.hypot(
				bossEnemy(finalHarness, bossType).x - finalHarness.player.x,
				bossEnemy(finalHarness, bossType).z - finalHarness.player.z,
			)
			: null,
	})}`);
}

export function assertDormantBoss(harness, bossType) {
	const overseers = (harness?.enemyHp || []).filter((e) => e.type === bossType && e.hp > 0);
	if (overseers.length !== 1) {
		throw new Error(`Expected exactly one ${bossType}, found ${overseers.length}`);
	}
	const boss = overseers[0];
	if (harness?.encounter?.phase !== 'dormant') {
		throw new Error(`Expected dormant encounter, got ${harness?.encounter?.phase}`);
	}
	if (harness?.encounter?.bossEnemyId !== boss.id) {
		throw new Error(`bossEnemyId mismatch: ${harness?.encounter?.bossEnemyId} !== ${boss.id}`);
	}
	return boss;
}
