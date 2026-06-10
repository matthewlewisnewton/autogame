import { describe, it, expect, afterEach } from 'vitest';
import { damagePlayer, isPlayerConcealed, setGameState } from '../simulation.js';

// ── Spherical (3D) zone semantics for barrier_dome and smoke_bomb ──
//
// Both zones record the caster's world Y at cast time (barrierDomeY /
// smokeBombY) and judge inside/outside against a 3D sphere. With no layout in
// these stateless tests, a missing zone Y falls back to the resolved default
// floor height (0.5) — the same value used by getEntityWorldY for entities
// without a finite y — never to 2D behavior.

const FLOOR_Y = 0.5;
const FUTURE = () => Date.now() + 5000;

function makePlayer(id, overrides = {}) {
	return {
		id,
		x: 0,
		y: FLOOR_Y,
		z: 0,
		hp: 100,
		dead: false,
		extracted: false,
		...overrides,
	};
}

function setupState({ players = {}, enemies = [], minions = [] } = {}) {
	const state = { players, enemies, minions };
	setGameState(state, []);
	return state;
}

afterEach(() => {
	setGameState(null, null);
});

describe('barrier dome — spherical (3D) blocking', () => {
	function domeFields(overrides = {}) {
		return {
			barrierDomeUntil: FUTURE(),
			barrierDomeRadius: 3,
			barrierDomeX: 0,
			barrierDomeY: FLOOR_Y,
			barrierDomeZ: 0,
			...overrides,
		};
	}

	it('same height: ranged damage from outside is blocked for a victim inside the sphere', () => {
		const victim = makePlayer('v', domeFields());
		setupState({
			players: { v: victim },
			enemies: [{ id: 'e1', x: 10, y: FLOOR_Y, z: 0, hp: 50 }],
		});

		const result = damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(result).toBeNull();
		expect(victim.hp).toBe(100);
	});

	it('same height: a victim outside the sphere in XZ is not protected', () => {
		const caster = makePlayer('caster', domeFields());
		const victim = makePlayer('v', { x: 5, z: 0 }); // XZ dist 5 > radius 3
		setupState({
			players: { caster, v: victim },
			enemies: [{ id: 'e1', x: 10, y: FLOOR_Y, z: 0, hp: 50 }],
		});

		damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(victim.hp).toBe(70);
	});

	it('a victim hovering above the dome (XZ-inside, 3D-outside) is NOT protected', () => {
		const caster = makePlayer('caster', domeFields());
		// XZ dist 1 ≤ 3, but 3D dist √(1 + 5.5²) ≈ 5.59 > 3
		const victim = makePlayer('v', { x: 1, y: FLOOR_Y + 5.5, z: 0 });
		setupState({
			players: { caster, v: victim },
			enemies: [{ id: 'e1', x: 10, y: FLOOR_Y, z: 0, hp: 50 }],
		});

		damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(victim.hp).toBe(70);
	});

	it('an attacker hovering above the dome (XZ-inside, 3D-outside) is treated as outside — shot blocked', () => {
		const victim = makePlayer('v', domeFields());
		setupState({
			players: { v: victim },
			// XZ dist 1 ≤ 3 (2D code would treat it as inside), 3D dist ≈ 9.55 > 3
			enemies: [{ id: 'e1', x: 1, y: FLOOR_Y + 9.5, z: 0, hp: 50 }],
		});

		const result = damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(result).toBeNull();
		expect(victim.hp).toBe(100);
	});

	it('an attacker inside the sphere (3D) is not blocked', () => {
		const victim = makePlayer('v', domeFields());
		setupState({
			players: { v: victim },
			enemies: [{ id: 'e1', x: 1, y: FLOOR_Y, z: 0, hp: 50 }], // 3D dist 1 ≤ 3
		});

		damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(victim.hp).toBe(70);
	});

	it('missing barrierDomeY falls back to floor Y: ground-level victim still protected', () => {
		const victim = makePlayer('v', domeFields({ barrierDomeY: undefined }));
		setupState({
			players: { v: victim },
			enemies: [{ id: 'e1', x: 10, y: FLOOR_Y, z: 0, hp: 50 }],
		});

		const result = damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(result).toBeNull();
		expect(victim.hp).toBe(100);
	});

	it('missing barrierDomeY falls back to floor Y, not 2D: an elevated XZ-inside victim is NOT protected', () => {
		const caster = makePlayer('caster', domeFields({ barrierDomeY: undefined }));
		const victim = makePlayer('v', { x: 1, y: FLOOR_Y + 5.5, z: 0 });
		setupState({
			players: { caster, v: victim },
			enemies: [{ id: 'e1', x: 10, y: FLOOR_Y, z: 0, hp: 50 }],
		});

		damagePlayer('v', 30, { ranged: true, attackerEnemyId: 'e1' });

		expect(victim.hp).toBe(70);
	});
});

describe('smoke bomb — spherical (3D) concealment', () => {
	function smokeFields(overrides = {}) {
		return {
			smokeBombUntil: FUTURE(),
			smokeBombRadius: 4,
			smokeBombX: 2,
			smokeBombY: FLOOR_Y,
			smokeBombZ: 0,
			...overrides,
		};
	}

	it('same height: concealed inside the sphere, not concealed outside in XZ', () => {
		const caster = makePlayer('c', { x: 2, z: 0, ...smokeFields() });
		setupState({ players: { c: caster } });

		expect(isPlayerConcealed(caster, Date.now())).toBe(true);

		caster.x = 20; // XZ dist 18 > radius 4
		expect(isPlayerConcealed(caster, Date.now())).toBe(false);
	});

	it('a player elevated above the smoke sphere (XZ-inside, 3D-outside) is targetable', () => {
		const caster = makePlayer('c', { x: 2, z: 0, ...smokeFields() });
		// XZ dist 0 but 3D dist 5.5 > radius 4
		const ally = makePlayer('a', { x: 2, y: FLOOR_Y + 5.5, z: 0 });
		setupState({ players: { c: caster, a: ally } });

		expect(isPlayerConcealed(ally, Date.now())).toBe(false);
	});

	it('missing smokeBombY falls back to floor Y: ground-level player still concealed', () => {
		const caster = makePlayer('c', { x: 2, z: 0, ...smokeFields({ smokeBombY: undefined }) });
		setupState({ players: { c: caster } });

		expect(isPlayerConcealed(caster, Date.now())).toBe(true);
	});

	it('missing smokeBombY falls back to floor Y, not 2D: an elevated XZ-inside player is targetable', () => {
		const caster = makePlayer('c', { x: 2, z: 0, ...smokeFields({ smokeBombY: undefined }) });
		const ally = makePlayer('a', { x: 2, y: FLOOR_Y + 5.5, z: 0 });
		setupState({ players: { c: caster, a: ally } });

		expect(isPlayerConcealed(ally, Date.now())).toBe(false);
	});
});
