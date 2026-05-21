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
const handlerLog = {}; // event -> array of callbacks (keyed by "socketId:event")
let socketConnected = true;
let socketCounter = 0; // tracks how many times io() was called

function createMockSocket() {
	socketCounter++;
	const id = `mock-socket-${socketCounter}`;
	return {
		id,
		on: function(event, callback) {
			const key = `${id}:${event}`;
			if (!handlerLog[key]) handlerLog[key] = [];
			handlerLog[key].push(callback);
			return this;
		},
		emit: function(event, data) {
			emitLog.push({ event, data, socketId: id });
			return this;
		},
		connect: function() {
			socketConnected = true;
			return this;
		},
		disconnect: function() {
			socketConnected = false;
			return this;
		},
		io: { on: function() { return this; } }
	};
}

const ioMock = function() { return createMockSocket(); };

// ── Set up localStorage with a fake JWT token ──
// main.js reads `autogame_token` from localStorage at module load time.
// Without it, createSocket() is never called and `socket` stays null.
if (typeof localStorage !== 'undefined') {
	try {
		localStorage.setItem('autogame_token', 'test-fake-jwt-token');
	} catch (_) { /* ignore */ }
}

// ── Create auth overlay DOM elements at setup time ──
// main.js captures these references at module load time (top-level getElementById),
// so they must exist before any test imports main.js.
if (typeof document !== 'undefined') {
	function ensureAuthElements() {
		if (document.getElementById('auth-overlay')) return;

		const overlay = document.createElement('div');
		overlay.id = 'auth-overlay';
		overlay.classList.add('hidden');

		const modal = document.createElement('div');
		modal.id = 'auth-modal';

		const registerForm = document.createElement('div');
		registerForm.id = 'register-form';
		const regUser = document.createElement('input');
		regUser.type = 'text';
		regUser.id = 'register-username';
		const regPass = document.createElement('input');
		regPass.type = 'password';
		regPass.id = 'register-password';
		const regBtn = document.createElement('button');
		regBtn.id = 'register-btn';
		const regError = document.createElement('span');
		regError.id = 'register-error';
		registerForm.appendChild(regUser);
		registerForm.appendChild(regPass);
		registerForm.appendChild(regBtn);
		registerForm.appendChild(regError);

		const loginForm = document.createElement('div');
		loginForm.id = 'login-form';
		loginForm.classList.add('hidden');
		const logUser = document.createElement('input');
		logUser.type = 'text';
		logUser.id = 'login-username';
		const logPass = document.createElement('input');
		logPass.type = 'password';
		logPass.id = 'login-password';
		const logBtn = document.createElement('button');
		logBtn.id = 'login-btn';
		const logError = document.createElement('span');
		logError.id = 'login-error';
		loginForm.appendChild(logUser);
		loginForm.appendChild(logPass);
		loginForm.appendChild(logBtn);
		loginForm.appendChild(logError);

		modal.appendChild(registerForm);
		modal.appendChild(loginForm);
		overlay.appendChild(modal);
		document.body.appendChild(overlay);

		// Logout button
		if (!document.getElementById('logout-btn')) {
			const logoutBtn = document.createElement('button');
			logoutBtn.id = 'logout-btn';
			logoutBtn.classList.add('hidden');
			document.body.appendChild(logoutBtn);
		}
	}
	ensureAuthElements();
}

// Expose emit log + reset helper for tests (only in jsdom environment)
if (typeof window !== 'undefined') {
	window.__socketEmitLog = () => emitLog;
	window.__clearSocketEmitLog = () => { emitLog.length = 0; };
	window.__triggerSocketEvent = function(event, data) {
		// handlerLog is keyed by "socketId:event" — find all matching handlers
		for (const key of Object.keys(handlerLog)) {
			if (key.endsWith(`:${event}`)) {
				for (const cb of handlerLog[key]) cb(data);
			}
		}
	};
	/** Return the set of events registered on a specific socket id. */
	window.__socketHandlerEvents = function(socketId) {
		const events = new Set();
		const prefix = `${socketId}:`;
		for (const key of Object.keys(handlerLog)) {
			if (key.startsWith(prefix)) {
				events.add(key.slice(prefix.length));
			}
		}
		return events;
	};
	/** Return the current socket counter (how many mock sockets have been created). */
	window.__socketCounter = () => socketCounter;
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
