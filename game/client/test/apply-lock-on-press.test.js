import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_FLOOR_Y } from '../../shared/floorSampling.esm.js';

describe('applyLockOnPress', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	async function loadHarness() {
		const lockOn = await import('../lockOn.js');
		lockOn.clearAllLockOnState();
		const renderer = await import('../renderer.js');
		renderer.setGamePhase('playing');
		renderer.setMyId('p1');
		renderer.setPlayerPosition(0, 0);
		return { lockOn, renderer };
	}

	it('snaps camera and player rotation toward a nearby enemy when camera faces away', async () => {
		const { lockOn, renderer } = await loadHarness();
		const {
			applyLockOnPress,
			setGameStateRef,
			setCameraYaw,
			getCameraYaw,
			setPlayerRotation,
			getPlayerRotation,
		} = renderer;

		const enemy = { id: 'a', x: 3, z: 4, hp: 50 };
		setGameStateRef({
			gamePhase: 'playing',
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [enemy],
			run: { status: 'playing' },
		});

		setPlayerRotation(0);
		setCameraYaw(Math.PI);

		applyLockOnPress();

		const toTarget = lockOn.getDirectionToTarget(0, 0, enemy);
		expect(getCameraYaw()).toBeCloseTo(lockOn.cameraYawFromToTarget(toTarget), 5);
		expect(getPlayerRotation()).toBeCloseTo(Math.atan2(toTarget.z, toTarget.x), 5);
		expect(lockOn.isLockOnActive()).toBe(true);
	});

	it('snaps camera behind player facing when no enemy is in range', async () => {
		const { lockOn, renderer } = await loadHarness();
		const {
			applyLockOnPress,
			setGameStateRef,
			setCameraYaw,
			getCameraYaw,
			setPlayerRotation,
			getPlayerRotation,
		} = renderer;

		const facing = Math.PI / 2;
		setGameStateRef({
			gamePhase: 'playing',
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [{ id: 'far', x: 20, z: 0, hp: 50 }],
			run: { status: 'playing' },
		});

		setPlayerRotation(facing);
		setCameraYaw(0);

		applyLockOnPress();

		expect(getCameraYaw()).toBeCloseTo(lockOn.cameraYawBehindFacing(facing), 5);
		expect(getPlayerRotation()).toBeCloseTo(facing, 5);
		expect(lockOn.isLockOnActive()).toBe(false);
	});

	it('resets lock-on tracking so the first update frame starts from the snapped yaw', async () => {
		const { lockOn, renderer } = await loadHarness();
		const {
			applyLockOnPress,
			setGameStateRef,
			setCameraYaw,
			getCameraYaw,
		} = renderer;

		const enemy = { id: 'a', x: 4, z: 0, hp: 50 };
		setGameStateRef({
			gamePhase: 'playing',
			players: { p1: { x: 0, z: 0, dead: false, hp: 100 } },
			enemies: [enemy],
			run: { status: 'playing' },
		});

		setCameraYaw(-Math.PI / 2);
		applyLockOnPress();

		const snappedYaw = getCameraYaw();
		const toTarget = lockOn.getDirectionToTarget(0, 0, enemy);
		expect(snappedYaw).toBeCloseTo(lockOn.cameraYawFromToTarget(toTarget), 5);

		const firstFrame = lockOn.updateLockOn(
			[enemy],
			0,
			DEFAULT_FLOOR_Y,
			0,
			1 / 60,
			snappedYaw,
			Math.atan2(toTarget.z, toTarget.x),
			null,
		);
		expect(firstFrame.locked).toBe(true);
		expect(firstFrame.cameraYaw).toBeCloseTo(snappedYaw, 5);
	});
});
