"""Copy the reviewed model sources and open the T-SITE stair shaft.

Requires the original four Python model sources and Blender 3.3.1. This never
modifies the input directory, renders images, opens a UI or publishes assets.
After reviewing the GLB/layout diff, use the existing import-hirakata scripts.
"""
from pathlib import Path
import argparse
import hashlib
import json
import shutil
import subprocess
import sys


SOURCES = {
    "build_model.py": "dfba09cbd22d506c033f8cc39efe2507c948036392b501940cc04423c070b4a8",
    "station_parts.py": "a29a0fa6177ef59d409008b8cbdfeceed3df2ed0931c4721c85dd408bb33f6e9",
    "south_parts.py": "06873895fca35a4425a45e5bf2d714d089257883469933c67e980427401ac6d0",
    "north_parts.py": "638b9906a444484f57b9fdf40650d437ea31e6c1ef16b2a87435377be96f72a8",
}
OLD = "deck(15,-70,8,32,6.4,rails='none')"
NEW = """# Keep the landing and side walks; leave the stair shaft open.
# Authoring X/Y: shaft x13.5..16.5, y-86..-74, deck top z6.4.
deck(15,-64,8,20,6.4,rails='none')
TSITE_OPENING_SIDE_SURFACES=[]
for side,x in [('west',12.25),('east',17.75)]:
    deck(x,-80,2.5,12,6.4,rails='none')
    surface=WALK_SURFACES.pop()
    surface['id']='South_pedestrian_deck deck 10 '+side+' opening edge'
    TSITE_OPENING_SIDE_SURFACES.append(surface)
# Append these two new surfaces after generation, preserving all old IDs.
"""


def replace_once(source, old, new):
    if source.count(old) != 1:
        raise ValueError("Expected exactly one source anchor: " + old[:75])
    return source.replace(old, new, 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--blender", type=Path, help="Optional Blender 3.3.1 executable; otherwise prepare only")
    args = parser.parse_args()
    original, target = args.source_dir.resolve(), args.output_dir.resolve()
    if original == target or original in target.parents or target in original.parents:
        raise ValueError("Use a separate output directory, not the original source tree")
    for name, expected in SOURCES.items():
        if hashlib.sha256((original / name).read_bytes()).hexdigest() != expected:
            raise ValueError("Unreviewed model source: " + name)
    source = (original / "build_model.py").read_text(encoding="utf-8")
    source = replace_once(source, OLD, NEW)
    anchor = "# Real meshes and named parent modules, ready to move individually into a game."
    source = replace_once(source, anchor, "WALK_SURFACES.extend(TSITE_OPENING_SIDE_SURFACES)\n\n" + anchor)
    source = replace_once(source, "bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'hirakata-complete.blend'))\n", "")
    source = replace_once(source, "for name,pos,target,lens in [", "# Geometry export only: image-render loop removed.\n# REMOVED_RENDER_LOOP\nfor name,pos,target,lens in [")
    source = source.split("# REMOVED_RENDER_LOOP", 1)[0]
    if "bpy.ops.render.render(" in source:
        raise ValueError("Unexpected render call")
    target.mkdir(parents=True, exist_ok=True)
    for name in SOURCES:
        if name != "build_model.py":
            shutil.copyfile(original / name, target / name)
    (target / "build_model.py").write_text(source, encoding="utf-8", newline="\n")
    manifest = {"input": str(original), "output": str(target), "originalSha256": SOURCES,
                "change": "Split South_pedestrian_deck deck 10 into landing and two side walks; preserve all other surface IDs",
                "gameOpening": {"minX": 13.5, "maxX": 16.5, "minZ": 74, "maxZ": 86, "floorY": 6.4},
                "renderImages": False, "publish": False}
    (target / "source-patch.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"prepared": str(target), "sourceFiles": len(SOURCES), "images": False}), flush=True)
    if args.blender:
        executable = args.blender.resolve(strict=True)
        command = [str(executable), "--background", "--factory-startup", "--python-exit-code", "1", "--python", str(target / "build_model.py")]
        flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
        with (target / "build.log").open("w", encoding="utf-8") as log:
            subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, creationflags=flags, check=True)
        print(json.dumps({"exported": str(target / "hirakata-complete.glb"), "layout": str(target / "walk-layout.json")}), flush=True)


if __name__ == "__main__":
    main()
