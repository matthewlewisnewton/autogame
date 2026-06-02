"""
Normalize Quaternius Superhero_Male_FullBody.fbx → player.glb (MODEL_SPIKE contract).

FBX import is X-up (height on +X). We rotate to Blender Z-up, then export Y-up glTF
so standing height is glTF Y and forward is glTF −Z.
"""
import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, ".authoring/ubc/Superhero_Male_FullBody.fbx")
OUT = os.path.join(ROOT, "public/models/player.glb")

TARGET_HEIGHT = 1.8
PLAYER_RADIUS = 0.5


def mesh_world_verts():
	deps = bpy.context.evaluated_depsgraph_get()
	verts = []
	for obj in bpy.data.objects:
		if obj.type != "MESH":
			continue
		eval_obj = obj.evaluated_get(deps)
		mw = eval_obj.matrix_world
		for v in eval_obj.data.vertices:
			verts.append(mw @ v.co)
	return verts


def bounds(verts):
	return (
		min(v.x for v in verts),
		max(v.x for v in verts),
		min(v.y for v in verts),
		max(v.y for v in verts),
		min(v.z for v in verts),
		max(v.z for v in verts),
	)


def mid_torso_xz(verts, z=0.9, band=0.35):
	r = 0.0
	for v in verts:
		if z - band <= v.z <= z + band:
			r = max(r, math.hypot(v.x, v.y))
	return r


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)

arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
objs = ([arm] if arm else []) + meshes

bpy.ops.object.select_all(action="DESELECT")
for o in objs:
	o.select_set(True)
bpy.context.view_layer.objects.active = arm or meshes[0]
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# X-up import → Z-up Blender: rotate +90° about Y (X → Z).
if arm:
	arm.rotation_euler[1] = math.radians(90)
	bpy.ops.object.select_all(action="DESELECT")
	for o in objs:
		o.select_set(True)
	bpy.ops.object.transform_apply(rotation=True)

# Face −Y in Blender (→ glTF −Z): model forward was +Y thin axis; rotate 180° Z.
if arm:
	arm.rotation_euler[2] = math.pi
	bpy.ops.object.select_all(action="DESELECT")
	for o in objs:
		o.select_set(True)
	bpy.ops.object.transform_apply(rotation=True)

verts = mesh_world_verts()
mn = bounds(verts)
height = mn[5] - mn[4]
scale = TARGET_HEIGHT / height

if arm:
	arm.scale = (scale, scale, scale)
	bpy.ops.object.select_all(action="DESELECT")
	for o in objs:
		o.select_set(True)
	bpy.ops.object.transform_apply(scale=True)

verts = mesh_world_verts()
mn = bounds(verts)
cx = (mn[0] + mn[1]) / 2
cy = (mn[2] + mn[3]) / 2
foot_z = mn[4]
offset = Vector((-cx, -cy, -foot_z))

if arm:
	arm.location += offset

bpy.context.view_layer.update()
verts = mesh_world_verts()
mn = bounds(verts)
height = mn[5] - mn[4]
foot_z = mn[4]
mid_r = mid_torso_xz(verts)
has_head = any(b.name == "Head" for b in arm.data.bones) if arm else False

print(
	f"height(z)={height:.4f} foot_z={foot_z:.4f} mid_xy={mid_r:.4f} head_bone={has_head}"
)

bpy.ops.object.select_all(action="DESELECT")
for o in objs:
	o.select_set(True)

bpy.ops.export_scene.gltf(
	filepath=OUT,
	export_format="GLB",
	export_yup=True,
	export_apply=True,
	export_materials="NONE",
	export_skins=True,
	export_animations=False,
	export_draco_mesh_compression_enable=False,
	use_selection=True,
)

print("Wrote", OUT, os.path.getsize(OUT))
if abs(height - TARGET_HEIGHT) > 0.05:
	raise SystemExit(f"height {height:.3f} outside 1.8 ± 0.05")
if abs(foot_z) > 0.02:
	raise SystemExit(f"feet z {foot_z:.3f} not at origin")
# T-pose arms widen the Blender-space slice; glTF Y-up export is verified separately.
if mid_r > 1.0:
	raise SystemExit(f"mid-torso xy {mid_r:.3f} unexpectedly large")
