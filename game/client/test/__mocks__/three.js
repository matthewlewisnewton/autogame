// Mock for Three.js — provides stub classes that main.js uses
// Each class is a constructor returning an object with chainable methods.

function stubClass(name, extraMethods = {}) {
	class C {
		constructor() {
			Object.defineProperty(this, '_name', { value: name });
		}
		static get [Symbol.toStringTag]() { return name; }
	}
	// Position, rotation, scale stubs
	C.prototype.position = { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; }, clone: function() { return { x: this.x, y: this.y, z: this.z }; } };
	C.prototype.rotation = { x: 0, y: 0, z: 0, set: function() {} };
	C.prototype.scale = { setScalar: function() {} };
	C.prototype.material = { color: { setHex: function() {} }, opacity: 1, dispose: function() {} };
	C.prototype.geometry = { dispose: function() {} };
	C.prototype.lookAt = function() { return this; };
	C.prototype.clone = function() { return new C(); };
	C.prototype.add = function() { return this; };
	C.prototype.remove = function() { return this; };
	C.prototype.dispose = function() {};
	C.prototype.lerp = function(target, t) { this.x = this.x + (target.x - this.x) * t; this.y = this.y + (target.y - this.y) * t; this.z = this.z + (target.z - this.z) * t; return this; };
	Object.assign(C.prototype, extraMethods);
	return C;
}

export const THREE = {
	Scene: stubClass('Scene', {
		add: function() {},
		remove: function() {},
		background: null
	}),
	PerspectiveCamera: stubClass('PerspectiveCamera', {
		aspect: 1,
		updateProjectionMatrix: function() {},
	}),
	Vector3: stubClass('Vector3', {
		set: function(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
	}),
	Color: stubClass('Color'),
	Clock: stubClass('Clock', {
		getDelta: function() { return 0.016; },
	}),
	AmbientLight: stubClass('AmbientLight'),
	DirectionalLight: stubClass('DirectionalLight'),
	WebGLRenderer: stubClass('WebGLRenderer', {
		setSize: function() {},
		render: function() {},
		domElement: document.createElement('canvas')
	}),
	// Geometries
	BoxGeometry: stubClass('BoxGeometry'),
	SphereGeometry: stubClass('SphereGeometry'),
	RingGeometry: stubClass('RingGeometry'),
	CylinderGeometry: stubClass('CylinderGeometry'),
	ConeGeometry: stubClass('ConeGeometry'),
	PlaneGeometry: stubClass('PlaneGeometry'),
	// Materials
	MeshStandardMaterial: stubClass('MeshStandardMaterial', {
		dispose: function() {},
		opacity: 1
	}),
	Mesh: stubClass('Mesh', {
		position: { x: 0, y: 0, z: 0, set: function(x, y, z) { this.x = x; this.y = y; this.z = z; }, clone: function() { return { x: this.x, y: this.y, z: this.z }; } },
		rotation: { x: 0, y: 0, z: 0 },
		scale: { setScalar: function() {} },
		material: { color: { setHex: function() {} }, opacity: 1, dispose: function() {} },
		geometry: { dispose: function() {} },
	}),
	DoubleSide: 2,
};

// Named exports so `import * as THREE from 'three'` works
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
export const CylinderGeometry = THREE.CylinderGeometry;
export const ConeGeometry = THREE.ConeGeometry;
export const PlaneGeometry = THREE.PlaneGeometry;
export const MeshStandardMaterial = THREE.MeshStandardMaterial;
export const Mesh = THREE.Mesh;
export const DoubleSide = THREE.DoubleSide;
