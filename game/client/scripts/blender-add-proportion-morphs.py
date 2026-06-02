"""
Add six proportion shape keys to the normalized player mesh and export player.glb.

Contract: morph names height, headSize, torsoWidth, armLength, legLength, shoulderWidth.
glTF base mesh = 0.0 extreme; morph delta = (1.0 − 0.0) so influence 0.5 ≈ neutral
(see game/docs/MODEL_SPIKE.md).

Run from game/client/:
  flatpak run org.blender.Blender --background --python scripts/blender-add-proportion-morphs.py
"""
import bpy
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_GLB = os.path.join(ROOT, "public/models/player.glb")
OUT_GLB = SRC_GLB

MORPH_KEYS = (
    "height",
    "headSize",
    "torsoWidth",
    "armLength",
    "legLength",
    "shoulderWidth",
)

BONE_WEIGHTS = {
    "height": {
        "thigh": 1.0,
        "calf": 1.0,
        "foot": 0.6,
        "spine": 0.85,
        "pelvis": 0.5,
        "neck": 0.25,
        "head": 0.15,
    },
    "headSize": {"head": 1.0, "neck": 0.55},
    "torsoWidth": {"spine": 1.0, "pelvis": 0.75, "chest": 0.9},
    "armLength": {
        "upperarm": 1.0,
        "lowerarm": 1.0,
        "hand": 0.85,
        "clavicle": 0.35,
    },
    "legLength": {"thigh": 1.0, "calf": 1.0, "foot": 0.5},
    "shoulderWidth": {"clavicle": 1.0, "upperarm": 0.45, "spine": 0.2},
}

DEFORM = {
    "height": ("scale_y", 1.12),
    "headSize": ("scale_radial", 1.22),
    "torsoWidth": ("scale_x", 1.14),
    "armLength": ("extend_limb", 1.1, "arm"),
    "legLength": ("extend_limb", 1.1, "leg"),
    "shoulderWidth": ("scale_x", 1.16, "shoulder"),
}


def vertex_bone_weights(mesh):
    vgroups = {vg.index: vg.name.lower() for vg in mesh.vertex_groups}
    buckets = {k: [0.0] * len(mesh.data.vertices) for k in MORPH_KEYS}
    for v in mesh.data.vertices:
        for g in v.groups:
            gname = vgroups.get(g.group, "")
            w = g.weight
            if w <= 0:
                continue
            for morph, patterns in BONE_WEIGHTS.items():
                for pat in patterns:
                    if pat in gname:
                        buckets[morph][v.index] = max(buckets[morph][v.index], w)
    return buckets


def morph_weight(morph, bone_w):
    patterns = BONE_WEIGHTS[morph]
    w = 0.0
    for pat, factor in patterns.items():
        w = max(w, bone_w * factor)
    return min(1.0, w)


def bounds_y(coords):
    ys = [c.y for c in coords]
    return min(ys), max(ys)


def deform_vertex(co, morph, w, sign):
    if w < 0.02:
        return co.copy()
    kind, amount, *rest = DEFORM[morph]
    t = amount if sign > 0 else 1.0 / amount
    hint = rest[0] if rest else None
    p = co.copy()
    blend = 1.0 + (t - 1.0) * w

    if kind == "scale_y":
        foot_y = 0.0
        p.y = foot_y + (p.y - foot_y) * blend

    elif kind == "scale_x":
        cx = 0.0
        cz = 0.0
        pivot_y = 0.95 if hint == "shoulder" else 0.9
        delta = Vector((p.x - cx, 0.0, p.z - cz))
        p.x = cx + delta.x * blend
        p.z = cz + delta.z * blend

    elif kind == "scale_radial":
        center = Vector((0.0, 1.55, 0.0))
        delta = p - center
        delta.y *= 0.35
        p = center + delta * blend

    elif kind == "extend_limb":
        cx = 0.0
        cz = 0.0
        if hint == "arm":
            side = 1.0 if p.x >= cx else -1.0
            pivot = Vector((side * 0.22, 1.15, cz))
        else:
            pivot = Vector((cx, 0.2, cz))
        along = p - pivot
        p = pivot + along * blend

    return p


def deform_mesh(coords, morph, buckets, sign):
    out = []
    for i, co in enumerate(coords):
        w = morph_weight(morph, buckets[morph][i])
        out.append(deform_vertex(co, morph, w, sign))
    return out


def main():
    if not os.path.isfile(SRC_GLB):
        raise SystemExit(f"Missing source: {SRC_GLB}")

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC_GLB)

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    armatures = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if not meshes:
        raise SystemExit("No mesh in player.glb")

    mesh_obj = max(meshes, key=lambda o: len(o.data.vertices))
    print("Morph mesh:", mesh_obj.name, "verts", len(mesh_obj.data.vertices))

    for o in list(bpy.data.objects):
        if o.type == "MESH" and o != mesh_obj:
            bpy.data.objects.remove(o, do_unlink=True)

    neutral = [v.co.copy() for v in mesh_obj.data.vertices]
    buckets = vertex_bone_weights(mesh_obj)
    min_all = list(neutral)
    for morph in MORPH_KEYS:
        min_all = deform_mesh(min_all, morph, buckets, sign=-1)
    max_by_morph = {m: deform_mesh(neutral, m, buckets, sign=+1) for m in MORPH_KEYS}

    for i, v in enumerate(mesh_obj.data.vertices):
        v.co = min_all[i]

    # glTF rest = 0.0 on all proportions; influence 0.5 ≈ neutral; 1.0 = per-key max.
    mesh_obj.shape_key_add(name="Basis", from_mix=False)
    for morph in MORPH_KEYS:
        sk = mesh_obj.shape_key_add(name=morph)
        for i, v in enumerate(mesh_obj.data.vertices):
            sk.data[i].co = max_by_morph[morph][i] - min_all[i]

    for morph in MORPH_KEYS:
        sk = mesh_obj.data.shape_keys.key_blocks[morph]
        err = 0.0
        for i, v in enumerate(mesh_obj.data.vertices):
            mid = min_all[i] + sk.data[i].co * 0.5
            err = max(err, (mid - neutral[i]).length)
        if err > 0.03:
            print(f"WARN: {morph} 0.5 blend error {err:.4f}")

    bpy.ops.object.select_all(action="DESELECT")
    for o in bpy.data.objects:
        if o.type in {"MESH", "ARMATURE"}:
            o.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_materials="NONE",
        export_skins=True,
        export_morph=True,
        export_animations=False,
        export_draco_mesh_compression_enable=False,
        use_selection=True,
    )

    print("Wrote", OUT_GLB, os.path.getsize(OUT_GLB))


main()
