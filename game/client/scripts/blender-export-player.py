import bpy
import math
import os

SRC = "/tmp/quaternius-player/extract/Universal Base Characters[Standard]/Base Characters/Unity/Superhero_Male_FullBody.fbx"
OUT = "/home/matt/workspace/.autogame-worktrees/185-character-models-spike-base-player-model/game/client/public/models/player-raw.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)

for obj in bpy.data.objects:
    if obj.type == "MESH":
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        obj.select_set(False)

for obj in bpy.data.objects:
    if obj.parent is None:
        obj.rotation_euler[2] = math.pi

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_yup=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
    export_skins=True,
    export_animations=False,
    export_draco_mesh_compression_enable=False,
)

print("Exported", OUT, os.path.getsize(OUT))
