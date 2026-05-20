import { vi } from 'vitest';

// ── Mock Three.js ──
function stubClass(name) {
	class C {
		constructor(...args) {
			Object.defineProperty(this, '_name', { value: name });
			// Mesh constructor: (geometry, material) — store both
			if (name === 'Mesh' && args.length >= 2) {
				this.geometry = args[0];
				this.material = args[1];
			}
			// MeshStandardMaterial constructor: (options) — store properties
			if (name === 'MeshStandardMaterial' && args[0] && typeof args[0] === 'object') {
				Object.assign(this, args[0]);
				// Wrap numeric color into an object with getHex() for test compatibility
				if (typeof this.color === 'number') {
					this.color = { _value: this.color, getHex: function() { return this._value; }, setHex: function(v) { this._value = v; } };
				}
				// Wrap numeric emissive the same way
				if (typeof this.emissive === 'number') {
					this.emissive = { _value: this.emissive, getHex: function() { return this._value; }, setHex: function(v) { this._value = v; }, set: function(v) { this._value = v; } };
				}
			}
			// Geometry constructors — store parameters so tests can inspect them
			const geoNames = ['ConeGeometry', 'BoxGeometry', 'SphereGeometry', 'RingGeometry', 'CylinderGeometry', 'PlaneGeometry', 'IcosahedronGeometry', 'OctahedronGeometry'];
			if (geoNames.includes(name)) {
				this.parameters = {};
				if (name === 'ConeGeometry') {
					this.parameters = { radius: args[0], height: args[1], radialSegments: args[2] };
				} else if (name === 'BoxGeometry') {
					this.parameters = { width: args[0], height: args[1], depth: args[2] };
				} else if (name === 'SphereGeometry') {
					this.parameters = { radius: args[0], widthSegments: args[1], heightSegments: args[2] };
				} else if (name === 'RingGeometry') {
					this.parameters = { innerRadius: args[0], outerRadius: args[1], thetaSegments: args[2] };
				} else if (name === 'CylinderGeometry') {
					this.parameters = { radiusTop: args[0], radiusBottom: args[1], height: args[2], radialSegments: args[3] };
				} else if (name === 'PlaneGeometry') {
					this.parameters = { width: args[0], height: args[1] };
				} else if (name === 'IcosahedronGeometry') {
					this.parameters = { radius: args[0], detail: args[1] };
				} else if (name === 'OctahedronGeometry') {
					this.parameters = { radius: args[0], detail: args[1] };
				}
			}
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
		emissive: {
			_value: 0x000000,
			set: function(c) { this._value = c; },
			get: function() { return this._value; }
		},
		emissiveIntensity: 0,
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
	C.prototype.project = function(camera) {
		// Stub: leave coordinates as-is (NDC space)
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
	IcosahedronGeometry: stubClass('IcosahedronGeometry'),
	OctahedronGeometry: stubClass('OctahedronGeometry'),
	MeshStandardMaterial: stubClass('MeshStandardMaterial'),
	Mesh: stubClass('Mesh'),
	DoubleSide: 2,
};

// ── Mock socket.io-client ──
const emitLog = [];
const handlerLog = {}; // event -> array of callbacks
const fakeSocket = {
	id: 'mock-socket-id',
	on: function(event, callback) {
		if (!handlerLog[event]) handlerLog[event] = [];
		handlerLog[event].push(callback);
		return this;
	},
	emit: function(event, data) {
		emitLog.push({ event, data });
		return this;
	},
	io: { on: function() { return this; } }
};

const ioMock = function() { return fakeSocket; };

// Expose emit log + reset helper for tests (only in jsdom environment)
if (typeof window !== 'undefined') {
	window.__socketEmitLog = () => emitLog;
	window.__clearSocketEmitLog = () => { emitLog.length = 0; };
	window.__triggerSocketEvent = function(event, data) {
		const handlers = handlerLog[event];
		if (handlers) {
			for (const cb of handlers) cb(data);
		}
	};
	window.__soundLogEnabled = true; // enable _playSoundCallLog in test environment
}

// Register mocks
vi.mock('three', () => {
	const exports = { THREE, ...THREE };
	return exports;
});

vi.mock('socket.io-client', () => ({
	io: ioMock
}));
