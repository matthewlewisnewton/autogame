import { vi } from 'vitest';

// ── Mock Three.js ──
function stubClass(name) {
	class C {
		constructor() {
			Object.defineProperty(this, '_name', { value: name });
		}
	}
	C.prototype.position = {
		x: 0, y: 0, z: 0,
		set: function(x, y, z) { this.x = x; this.y = y; this.z = z; },
		clone: function() { return { x: this.x, y: this.y, z: this.z }; }
	};
	C.prototype.rotation = { x: 0, y: 0, z: 0, set: function() {} };
	C.prototype.scale = { setScalar: function() {} };
	C.prototype.material = {
		color: { setHex: function() {} },
		opacity: 1,
		dispose: function() {}
	};
	C.prototype.geometry = { dispose: function() {} };
	C.prototype.lookAt = function() { return this; };
	C.prototype.clone = function() { return new C(); };
	C.prototype.add = function() { return this; };
	C.prototype.remove = function() { return this; };
	C.prototype.dispose = function() {};
	C.prototype.lerp = function(target, t) {
		this.x = this.x + (target.x - this.x) * t;
		this.y = this.y + (target.y - this.y) * t;
		this.z = this.z + (target.z - this.z) * t;
		return this;
	};
	C.prototype.setSize = function() {};
	C.prototype.render = function() {};
	C.prototype.updateProjectionMatrix = function() {};
	C.prototype.getDelta = function() { return 0.016; };
	C.prototype.domElement = typeof document !== 'undefined' ? document.createElement('canvas') : null;
	C.prototype.aspect = 1;
	return C;
}

const THREE = {
	Scene: stubClass('Scene'),
	PerspectiveCamera: stubClass('PerspectiveCamera'),
	Vector3: stubClass('Vector3'),
	Color: stubClass('Color'),
	Clock: stubClass('Clock'),
	AmbientLight: stubClass('AmbientLight'),
	DirectionalLight: stubClass('DirectionalLight'),
	WebGLRenderer: stubClass('WebGLRenderer'),
	BoxGeometry: stubClass('BoxGeometry'),
	SphereGeometry: stubClass('SphereGeometry'),
	RingGeometry: stubClass('RingGeometry'),
	CylinderGeometry: stubClass('CylinderGeometry'),
	ConeGeometry: stubClass('ConeGeometry'),
	PlaneGeometry: stubClass('PlaneGeometry'),
	MeshStandardMaterial: stubClass('MeshStandardMaterial'),
	Mesh: stubClass('Mesh'),
	DoubleSide: 2,
};

// Named exports
for (const key of Object.keys(THREE)) {
	THREE[key] = THREE[key];
}

// ── Mock socket.io-client ──
const fakeSocket = {
	id: 'mock-socket-id',
	on: function() { return this; },
	emit: function() { return this; },
	io: { on: function() { return this; } }
};

const ioMock = function() { return fakeSocket; };

// Register mocks
vi.mock('three', () => {
	const exports = { THREE, ...THREE };
	return exports;
});

vi.mock('socket.io-client', () => ({
	io: ioMock
}));
