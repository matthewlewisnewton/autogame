/**
 * Boss-encounter HUD + distinct-visual probe (tickets 283 / 284).
 *
 * Reads the live boss-encounter HUD model, encounter flags, and boss enemy from
 * window.__AUTOGAME_HARNESS_STATE__(), asserts the HUD is visible with a sane HP
 * fraction during an active locked encounter, resolves the boss's distinct
 * visual descriptor from the server display catalog, and captures a dedicated
 * health-bar screenshot. Pure read-only validation instrumentation — it never
 * mutates game state.
 */
import path from 'path';
import { readHarness } from './harnessState.mjs';
import { writeScreenshot } from './screenshot.mjs';

/** Generic catalog fallback name; a boss resolving to this is a content bug. */
const GENERIC_BOSS_NAME = 'Boss';

/**
 * Read whether the #boss-encounter-hud container is rendered + visible and
 * resolve the boss's display name from the live enemy display catalog. Done in a
 * single page evaluate so the DOM and catalog reads share one round-trip.
 */
async function readHudAndCatalog(page, { bossType, variant }) {
	return page.evaluate(({ type, variantId }) => {
		const el = document.getElementById('boss-encounter-hud');
		const hud = el
			? (() => {
				const style = getComputedStyle(el);
				return {
					present: true,
					visible: !el.classList.contains('hidden')
						&& el.getAttribute('aria-hidden') !== 'true'
						&& style.display !== 'none'
						&& style.visibility !== 'hidden',
				};
			})()
			: { present: false, visible: false };

		const catalog = typeof window.__getEnemyDisplayCatalog === 'function'
			? window.__getEnemyDisplayCatalog()
			: null;
		const typeName = catalog?.types?.[type]?.name ?? null;
		const variantName = variantId ? (catalog?.variants?.[variantId]?.name ?? null) : null;
		return { hud, catalog: { typeName, variantName } };
	}, { type: bossType, variantId: variant ?? null });
}

/**
 * Run the boss-UI / boss-visuals probe during the active boss phase.
 *
 * @param {import('playwright').Page} page
 * @param {{ outDir: string, repoRoot: string, bossType: string, screenshotName?: string }} opts
 * @returns {Promise<{ bossUi: object, bossVisuals: object, screenshot: string }>}
 */
export async function probeBossUi(page, { outDir, repoRoot, bossType, screenshotName = '05a-boss-healthbar' } = {}) {
	const harness = await readHarness(page);
	const encounter = harness?.encounter ?? null;
	const model = harness?.bossEncounter ?? null;
	const enemies = Array.isArray(harness?.enemyHp) ? harness.enemyHp : [];

	// Locate the live boss enemy by the encounter's bossEnemyId, falling back to
	// a live type match, to read its distinct visual descriptor (type/variant).
	const bossEnemy = (encounter?.bossEnemyId
		&& enemies.find((e) => e && e.id === encounter.bossEnemyId))
		|| enemies.find((e) => e && e.type === bossType && e.hp > 0)
		|| null;

	const { hud, catalog } = await readHudAndCatalog(page, {
		bossType,
		variant: bossEnemy?.variant ?? null,
	});

	const isActiveLocked = encounter?.phase === 'active' && encounter?.locked === true;

	// Hard failures: during an active locked encounter the HUD must be modelled
	// and visible, with a sane HP fraction, and resolve to the real stage boss.
	if (isActiveLocked) {
		if (!model) {
			throw new Error(`bossUi probe: boss-encounter HUD model is null during active locked encounter: ${JSON.stringify({ encounter, hud })}`);
		}
		if (!hud.visible) {
			throw new Error(`bossUi probe: #boss-encounter-hud is not visible during active locked encounter: ${JSON.stringify({ encounter, hud, model })}`);
		}
		if (!(Number.isFinite(model.hpPct) && model.hpPct >= 1 && model.hpPct <= 100)) {
			throw new Error(`bossUi probe: hpPct ${model.hpPct} out of expected 1..100 range during active encounter: ${JSON.stringify(model)}`);
		}
		if (!bossEnemy) {
			throw new Error(`bossUi probe: could not resolve live boss enemy (bossEnemyId=${encounter?.bossEnemyId}, bossType=${bossType}): ${JSON.stringify(enemies)}`);
		}
		if (bossEnemy.type !== bossType) {
			throw new Error(`bossUi probe: boss enemy type "${bossEnemy.type}" does not match expected "${bossType}" — wrong/another-level boss: ${JSON.stringify(bossEnemy)}`);
		}
		if (!model.name || model.name === GENERIC_BOSS_NAME || model.name !== catalog.typeName) {
			throw new Error(`bossUi probe: boss display name "${model.name}" is a generic/unexpected fallback (catalog name for ${bossType} is "${catalog.typeName}"): ${JSON.stringify({ model, catalog })}`);
		}
	}

	const shotAbs = await writeScreenshot(page, outDir, screenshotName);

	const bossUi = {
		hudPresent: hud.present,
		hudVisible: hud.visible,
		name: model?.name ?? null,
		hp: model?.hp ?? null,
		maxHp: model?.maxHp ?? null,
		hpPct: model?.hpPct ?? null,
		tier: model?.tier ?? null,
		phase: encounter?.phase ?? null,
		locked: encounter?.locked ?? null,
		bossEnemyId: encounter?.bossEnemyId ?? null,
	};

	const bossVisuals = {
		type: bossEnemy?.type ?? null,
		variant: bossEnemy?.variant ?? null,
		catalogName: catalog.variantName ?? catalog.typeName ?? null,
		catalogTypeName: catalog.typeName,
		catalogVariantName: catalog.variantName,
		modelName: model?.name ?? null,
		isDistinctBoss: bossEnemy?.type === bossType
			&& !!catalog.typeName
			&& catalog.typeName !== GENERIC_BOSS_NAME,
	};

	return {
		bossUi,
		bossVisuals,
		screenshot: path.relative(repoRoot, shotAbs),
	};
}
