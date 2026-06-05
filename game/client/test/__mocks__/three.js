// Canonical Three.js stub for client tests (imported by setup.js).

function stubClass(name) {
	class C {
		constructor(...args) {
			Object.defineProperty(this, '_name', { value: name });
			// Per-instance position and rotation (not shared on prototype)
			this.position = {
				x: 0, y: 0, z: 0,
				set: function(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
				copy: function(other) {
					if (other) {
						this.x = other.x;
						this.y = other.y;
						this.z = other.z;
					}
					return this;
				},
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
				set: function() { return this; },
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
				this.isMesh = true;
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
			const geoNames = ['ConeGeometry', 'BoxGeometry', 'SphereGeometry', 'RingGeometry', 'CircleGeometry', 'EdgesGeometry', 'CylinderGeometry', 'TorusGeometry', 'PlaneGeometry', 'IcosahedronGeometry', 'OctahedronGeometry', 'BufferGeometry'];
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
				} else if (name === 'TorusGeometry') {
					this.parameters = { radius: args[0], tube: args[1], radialSegments: args[2], tubularSegments: args[3], arc: args[4] };
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
	C.prototype.scale = {
		x: 1, y: 1, z: 1,
		setScalar: function(s) { this.x = this.y = this.z = s; },
		multiplyScalar: function(s) { this.x *= s; this.y *= s; this.z *= s; },
	};
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

function expandBoxFromNode(node, min, max, parentScale = { x: 1, y: 1, z: 1 }) {
	const p = node.geometry?.parameters;
	if (!p || p.width == null || p.height == null || p.depth == null) return;
	const sx = (node.scale?.x ?? 1) * parentScale.x;
	const sy = (node.scale?.y ?? 1) * parentScale.y;
	const sz = (node.scale?.z ?? 1) * parentScale.z;
	const px = (node.position?.x ?? 0) * parentScale.x;
	const py = (node.position?.y ?? 0) * parentScale.y;
	const pz = (node.position?.z ?? 0) * parentScale.z;
	const hw = (p.width * sx) / 2;
	const hh = (p.height * sy) / 2;
	const hd = (p.depth * sz) / 2;
	const corners = [
		[px - hw, py - hh, pz - hd],
		[px + hw, py + hh, pz + hd],
	];
	for (const [x, y, z] of corners) {
		min.x = Math.min(min.x, x);
		min.y = Math.min(min.y, y);
		min.z = Math.min(min.z, z);
		max.x = Math.max(max.x, x);
		max.y = Math.max(max.y, y);
		max.z = Math.max(max.z, z);
	}
}

export const THREE = {
	Scene: stubClass('Scene'),
	PerspectiveCamera: stubClass('PerspectiveCamera'),
	Vector3: class Vector3 {
		constructor(x = 0, y = 0, z = 0) {
			this.x = x;
			this.y = y;
			this.z = z;
		}
	},
	Box3: class Box3 {
		constructor() {
			this.min = { x: 0, y: 0, z: 0 };
			this.max = { x: 0, y: 0, z: 0 };
		}
		setFromObject(root) {
			const min = { x: Infinity, y: Infinity, z: Infinity };
			const max = { x: -Infinity, y: -Infinity, z: -Infinity };
			const rootScale = {
				x: root.scale?.x ?? 1,
				y: root.scale?.y ?? 1,
				z: root.scale?.z ?? 1,
			};
			root.traverse((node) => {
				if (node.isMesh || node.geometry?.parameters?.width != null) {
					expandBoxFromNode(node, min, max, rootScale);
				}
			});
			const ox = root.position?.x ?? 0;
			const oy = root.position?.y ?? 0;
			const oz = root.position?.z ?? 0;
			if (min.x === Infinity) {
				this.min = { x: 0, y: 0, z: 0 };
				this.max = { x: 0, y: 0, z: 0 };
			} else {
				this.min = { x: min.x + ox, y: min.y + oy, z: min.z + oz };
				this.max = { x: max.x + ox, y: max.y + oy, z: max.z + oz };
			}
			return this;
		}
		getSize(target) {
			target.x = this.max.x - this.min.x;
			target.y = this.max.y - this.min.y;
			target.z = this.max.z - this.min.z;
			return target;
		}
	},
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
	TorusGeometry: stubClass('TorusGeometry'),
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
			this.position = {
				x: 0, y: 0, z: 0,
				set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
				copy(other) {
					if (other) {
						this.x = other.x;
						this.y = other.y;
						this.z = other.z;
					}
					return this;
				},
			};
			this.rotation = {
				x: 0, y: 0, z: 0,
				copy(other) {
					if (other) {
						this.x = other.x;
						this.y = other.y;
						this.z = other.z;
					}
					return this;
				},
			};
			this.scale = {
				x: 1, y: 1, z: 1,
				set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
				setScalar(s) { this.x = this.y = this.z = s; return this; },
				multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; },
			};
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
export const Box3 = THREE.Box3;
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
export const TorusGeometry = THREE.TorusGeometry;
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
