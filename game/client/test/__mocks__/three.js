// Canonical Three.js stub for client tests (imported by setup.js).

function stubClass(name) {
	class C {
		constructor(...args) {
			Object.defineProperty(this, '_name', { value: name });
			// Per-instance position and rotation (not shared on prototype)
			this.position = {
				x: 0, y: 0, z: 0,
				set: function(x, y, z) { this.x = x; this.y = y; this.z = z; },
				clone: function() { return { x: this.x, y: this.y, z: this.z }; },
				lerp: function(target, t) {
					this.x = this.x + (target.x - this.x) * t;
					this.y = this.y + (target.y - this.y) * t;
					this.z = this.z + (target.z - this.z) * t;
					return this;
				},
			};
			this.rotation = {
				x: 0, y: 0, z: 0,
				set: function() {},
				copy: function(other) {
					if (other) {
						this.x = other.x;
						this.y = other.y;
						this.z = other.z;
					}
					return this;
				},
			};
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
			if (name === 'MeshBasicMaterial' && args[0] && typeof args[0] === 'object') {
				Object.assign(this, args[0]);
			}
			// Geometry constructors — store parameters so tests can inspect them
			const geoNames = ['ConeGeometry', 'BoxGeometry', 'SphereGeometry', 'RingGeometry', 'CircleGeometry', 'EdgesGeometry', 'CylinderGeometry', 'PlaneGeometry', 'IcosahedronGeometry', 'OctahedronGeometry', 'BufferGeometry'];
			if (geoNames.includes(name)) {
				this.parameters = {};
				if (name === 'ConeGeometry') {
					this.parameters = { radius: args[0], height: args[1], radialSegments: args[2] };
				} else if (name === 'BoxGeometry') {
					this.parameters = { width: args[0], height: args[1], depth: args[2] };
				} else if (name === 'SphereGeometry') {
					this.parameters = { radius: args[0], widthSegments: args[1], heightSegments: args[2] };
				} else if (name === 'RingGeometry') {
					this.parameters = { innerRadius: args[0], outerRadius: args[1], thetaSegments: args[2], thetaStart: args[3], thetaLength: args[4] };
				} else if (name === 'CircleGeometry') {
					this.parameters = { radius: args[0], segments: args[1], thetaStart: args[2], thetaLength: args[3] };
				} else if (name === 'EdgesGeometry') {
					this.parameters = { geometry: args[0] };
				} else if (name === 'CylinderGeometry') {
					this.parameters = { radiusTop: args[0], radiusBottom: args[1], height: args[2], radialSegments: args[3] };
				} else if (name === 'PlaneGeometry') {
					this.parameters = { width: args[0], height: args[1] };
				} else if (name === 'IcosahedronGeometry') {
					this.parameters = { radius: args[0], detail: args[1] };
				} else if (name === 'OctahedronGeometry') {
					this.parameters = { radius: args[0], detail: args[1] };
				} else if (name === 'BufferGeometry') {
					this.parameters = { points: args[0] };
				}
			}
			if (name === 'Mesh' || name === 'LineSegments') {
				this.userData = {};
			}
			if (name === 'LineBasicMaterial' && args[0] && typeof args[0] === 'object') {
				Object.assign(this, args[0]);
			}
		}
	}
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
	C.prototype.add = function(child) {
		if (!this.children) this.children = [];
		this.children.push(child);
		return this;
	};
	C.prototype.remove = function() { return this; };
	C.prototype.traverse = function(cb) {
		cb(this);
		if (this.children) {
			for (const child of this.children) {
				if (typeof child.traverse === 'function') child.traverse(cb);
				else cb(child);
			}
		}
		return this;
	};
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

export const THREE = {
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
	CircleGeometry: stubClass('CircleGeometry'),
	EdgesGeometry: stubClass('EdgesGeometry'),
	CylinderGeometry: stubClass('CylinderGeometry'),
	ConeGeometry: stubClass('ConeGeometry'),
	PlaneGeometry: stubClass('PlaneGeometry'),
	IcosahedronGeometry: stubClass('IcosahedronGeometry'),
	OctahedronGeometry: stubClass('OctahedronGeometry'),
	BufferGeometry: class BufferGeometry extends stubClass('BufferGeometry') {
		setFromPoints(points) {
			this.parameters = { points };
			return this;
		}
	},
	MeshStandardMaterial: stubClass('MeshStandardMaterial'),
	MeshBasicMaterial: stubClass('MeshBasicMaterial'),
	LineBasicMaterial: stubClass('LineBasicMaterial'),
	Mesh: stubClass('Mesh'),
	LineSegments: stubClass('LineSegments'),
	Group: class Group {
		constructor() {
			this.children = [];
			this.userData = {};
			this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };
			this.rotation = { x: 0, y: 0, z: 0 };
			this.scale = { setScalar: function() {} };
		}
		add(child) {
			this.children.push(child);
			return this;
		}
		remove() { return this; }
		traverse(cb) {
			cb(this);
			for (const child of this.children) {
				if (typeof child.traverse === 'function') child.traverse(cb);
				else cb(child);
			}
			return this;
		}
	},
	DoubleSide: 2,
};

export const Scene = THREE.Scene;
export const PerspectiveCamera = THREE.PerspectiveCamera;
export const Vector3 = THREE.Vector3;
export const Color = THREE.Color;
export const Clock = THREE.Clock;
export const AmbientLight = THREE.AmbientLight;
export const DirectionalLight = THREE.DirectionalLight;
export const WebGLRenderer = THREE.WebGLRenderer;
export const BoxGeometry = THREE.BoxGeometry;
export const SphereGeometry = THREE.SphereGeometry;
export const RingGeometry = THREE.RingGeometry;
export const CircleGeometry = THREE.CircleGeometry;
export const EdgesGeometry = THREE.EdgesGeometry;
export const CylinderGeometry = THREE.CylinderGeometry;
export const ConeGeometry = THREE.ConeGeometry;
export const PlaneGeometry = THREE.PlaneGeometry;
export const IcosahedronGeometry = THREE.IcosahedronGeometry;
export const OctahedronGeometry = THREE.OctahedronGeometry;
export const BufferGeometry = THREE.BufferGeometry;
export const MeshStandardMaterial = THREE.MeshStandardMaterial;
export const MeshBasicMaterial = THREE.MeshBasicMaterial;
export const LineBasicMaterial = THREE.LineBasicMaterial;
export const Mesh = THREE.Mesh;
export const Group = THREE.Group;
export const LineSegments = THREE.LineSegments;
export const DoubleSide = THREE.DoubleSide;
