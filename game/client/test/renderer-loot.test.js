import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('renderer loot helpers', () => {
	let rafCallbacks;

	beforeEach(() => {
		vi.resetModules();
		rafCallbacks = [];
		vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		}));
		window.__soundLogEnabled = true;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	it('getPickedUpLootIds reflects lootPickupAttempts after walk-over pickup', async () => {
		const emit = vi.fn();
		const {
			initScene,
			setGameStateRef,
			setMyId,
			setSocketRef,
			setPlayerPosition,
			getPickedUpLootIds,
			animate,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setSocketRef({ emit });
		setMyId('p1');
		setPlayerPosition(0, 0);
		setGameStateRef({
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			loot: [{ id: 'ms_nearby', x: 0, z: 0, value: 3, kind: 'magic_stone' }],
			enemies: [],
			minions: [],
		});

		animate(0);

		expect(emit).toHaveBeenCalledWith('lootPickup', { lootId: 'ms_nearby' });
		expect(getPickedUpLootIds()).toEqual(new Set(['ms_nearby']));
	});

	it('markLootCollected shows "+N MS" for magic stone pickups', async () => {
		const {
			initScene,
			setGameStateRef,
			syncLootMeshes,
			markLootCollected,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setGameStateRef({
			loot: [{ id: 'ms_drop', x: 1, z: 1, value: 5, kind: 'magic_stone' }],
		});
		syncLootMeshes();

		markLootCollected('ms_drop', 5, 'magic_stone');

		const floating = Array.from(document.body.querySelectorAll('div')).find(
			(el) => el.style.position === 'fixed' && el.textContent.includes('MS'),
		);
		expect(floating?.textContent).toBe('+5 MS');
		expect(floating?.style.color).toBe('rgb(167, 139, 250)');
	});

	it('markLootCollected plays loot SFX only for magic stone pickups', async () => {
		const audio = await import('../audio.js');
		const playSpy = vi.spyOn(audio, 'playSound');
		const {
			initScene,
			setGameStateRef,
			syncLootMeshes,
			markLootCollected,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setGameStateRef({
			loot: [
				{ id: 'ms_drop', x: 1, z: 1, value: 5, kind: 'magic_stone' },
				{ id: 'gold_drop', x: 2, z: 2, value: 10, kind: 'currency' },
			],
		});
		syncLootMeshes();

		markLootCollected('ms_drop', 5, 'magic_stone');
		markLootCollected('gold_drop', 10, 'currency');

		expect(playSpy).toHaveBeenCalledTimes(1);
		expect(playSpy).toHaveBeenCalledWith('loot');
	});

	it('updateCollectingLoot disposes cloned loot materials when animation finishes', async () => {
		const { LOOT_COLLECT_DURATION } = await import('../config.js');
		let now = 1000;
		vi.spyOn(performance, 'now').mockImplementation(() => now);

		const {
			initScene,
			setGameStateRef,
			syncLootMeshes,
			markLootCollected,
			updateCollectingLoot,
			getScene,
		} = await import('../renderer.js');

		initScene(null, { x: 0, z: 0 });
		setGameStateRef({
			loot: [{ id: 'ms_dispose', x: 0, z: 0, value: 4, kind: 'magic_stone' }],
		});
		syncLootMeshes();

		const mesh = getScene().children.find((child) => child.userData?.isMagicStone);
		const gem = mesh.userData.gemMesh;
		const disposeSpy = vi.spyOn(gem.material, 'dispose');

		markLootCollected('ms_dispose', 4, 'magic_stone');
		now += LOOT_COLLECT_DURATION + 1;
		updateCollectingLoot();

		expect(disposeSpy).toHaveBeenCalled();
	});
});
