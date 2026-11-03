"""Rebuild the approved station model with bounded, single-segment edge finish.

The original four sources remain read-only. The existing terrace preparer also
preserves the approved T-SITE stair opening and supported furniture. Blender is
run without a window or image render. No public asset or deployment is changed.
"""
from pathlib import Path
from collections import Counter
import argparse
import hashlib
import json
import struct
import subprocess
import sys


FINISH = r'''
# District finish: chamfer only four vertical box edges before material batching.
# The top/bottom planes and bounds stay in place, including all support heights.
# Floors, stair treads, tactile strips, labels, vehicles and cafe contacts retain
# their original geometry. No new mesh, material or destruction module is added.
import bmesh
from collections import Counter
ORIGINAL_DISTRICT_BOX=box
DISTRICT_GEOMETRY=[]
DISTRICT_SKIPPED=Counter()
DISTRICT_BEVEL_CACHE={}
DISTRICT_PROTECTED_GROUPS={'Ground_and_roads','Vehicles','North_stationary_buses',
    'TSITE_terrace','Station_central_stairs','South_station_stair'}
DISTRICT_PROTECTED_MATERIALS={'road','paving','tile','tile2','tile3','yellow','soil',
    'leaf','leaflight','leafdark','light','window','green_glass','glass_light','glass_dark'}
DISTRICT_PROTECTED_CALLS={'stair','deck','station_floor','station_planks'}

def district_bevel_template(w,d,h,width):
    key=(w,d,h,width)
    if key in DISTRICT_BEVEL_CACHE:return DISTRICT_BEVEL_CACHE[key]
    bm=bmesh.new()
    try:
        signs=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
               (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
        vertices=[bm.verts.new((a*w/2,b*d/2,c*h/2)) for a,b,c in signs]
        for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
            bm.faces.new([vertices[i] for i in face])
        edges=[e for e in bm.edges if abs(e.verts[0].co.z-e.verts[1].co.z)>h*.99]
        if len(edges)!=4:raise ValueError('Expected four vertical finish edges')
        bmesh.ops.bevel(bm,geom=edges,offset=width,offset_type='OFFSET',segments=1,
                        affect='EDGES',profile=.5,clamp_overlap=True)
        bm.normal_update();bm.verts.index_update()
        verts=[tuple(v.co) for v in bm.verts]
        faces=[tuple(v.index for v in f.verts) for f in bm.faces]
        # BMesh uses floats: snap unchanged extents to their exact authored value.
        # This retains contact planes and boxes' source bounds without expanding.
        for axis,size in enumerate((w,d,h)):
            verts=[tuple((-size/2 if abs(p[axis]+size/2)<1e-5 else
                          size/2 if abs(p[axis]-size/2)<1e-5 else p[axis])
                         if i==axis else p[i] for i in range(3)) for p in verts]
        if len(verts)!=16 or sum(len(f)-2 for f in faces)!=28:
            raise ValueError('Unexpected one-segment bevel topology')
        for axis,size in enumerate((w,d,h)):
            if min(p[axis] for p in verts)!=-size/2 or max(p[axis] for p in verts)!=size/2:
                raise ValueError('Finish changed authored bounds')
        if any(p[2] not in (-h/2,h/2) for p in verts):
            raise ValueError('Finish moved a support plane')
        result=(verts,faces);DISTRICT_BEVEL_CACHE[key]=result;return result
    finally:bm.free()

def box(x,y,z,w,d,h,mat='panel',angle=0):
    reason=None
    if CURRENT in DISTRICT_PROTECTED_GROUPS:reason='protected module'
    elif mat in DISTRICT_PROTECTED_MATERIALS:reason='protected material'
    elif min(w,d)<.08 or h<.2:reason='thin or low part'
    elif w*d>64 and h<.6:reason='broad slab'
    frame=sys._getframe(1)
    while reason is None and frame is not None:
        if frame.f_code.co_name in DISTRICT_PROTECTED_CALLS:reason='walking surface or stairs'
        frame=frame.f_back
    if reason:
        DISTRICT_SKIPPED[reason]+=1
        return ORIGINAL_DISTRICT_BOX(x,y,z,w,d,h,mat,angle)
    width=min(.02,min(w,d)*.06)
    verts,faces=district_bevel_template(w,d,h,width)
    co,si=math.cos(angle),math.sin(angle)
    add([(x+co*a-si*b,y+si*a+co*b,z+c) for a,b,c in verts],faces,mat)
    DISTRICT_GEOMETRY.append(dict(group=CURRENT,material=mat,center=[x,y,z],
        dimensions=[w,d,h],angle=angle,width=width,segments=1,axis='vertical',
        beforeTriangles=12,afterTriangles=28))

'''

REPORT = r'''
# The hard budget is checked before exporting assets; caller also verifies GLB.
district_before=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in MODEL if o.type=='MESH')-16*len(DISTRICT_GEOMETRY)
district_after=district_before+16*len(DISTRICT_GEOMETRY)
if district_after>district_before*1.10:
    raise ValueError('District geometry exceeds 10 percent triangle increase')
district_report=dict(method='Blender BMesh, selected vertical edges, one segment',
    beforeTriangles=district_before,afterTriangles=district_after,
    addedTriangles=district_after-district_before,triangleIncrease=(district_after/district_before)-1,
    maxWidth=.02,relativeWidthLimit=.06,triangleIncreaseLimit=.10,
    selectedBoxes=len(DISTRICT_GEOMETRY),skippedBoxes=dict(DISTRICT_SKIPPED),
    byModule=dict(Counter(r['group'] for r in DISTRICT_GEOMETRY)),
    changedMeshNames=sorted({r['group']+' / '+r['material'] for r in DISTRICT_GEOMETRY}),
    contactPlanesUnchanged=True,images=False,audio=False,records=DISTRICT_GEOMETRY)
(OUT/'district-geometry-report.json').write_text(json.dumps(district_report,indent=2),encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'hirakata-complete.blend'))
'''


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Expected one district source anchor: ' + before[:80])
    return text.replace(before, after, 1)


def load_glb(path):
    raw = path.read_bytes()
    if struct.unpack_from('<III', raw) != (0x46546C67, 2, len(raw)):
        raise ValueError('Expected GLB v2: ' + str(path))
    size, kind = struct.unpack_from('<II', raw, 12)
    if kind != 0x4E4F534A:
        raise ValueError('Expected JSON chunk')
    return json.loads(raw[20:20+size]), raw[28+size:], raw


def accessor(model, index):
    doc, binary, _ = model
    a = doc['accessors'][index]
    view = doc['bufferViews'][a['bufferView']]
    widths = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    sizes = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    size = widths[a['type']] * sizes[a['componentType']]
    step = view.get('byteStride', size)
    start = view.get('byteOffset', 0) + a.get('byteOffset', 0)
    payload = b''.join(binary[start+i*step:start+i*step+size] for i in range(a['count']))
    return {'componentType': a['componentType'], 'type': a['type'], 'count': a['count'],
            'sha256': hashlib.sha256(payload).hexdigest()}


def signatures(model):
    result = {}
    for mesh in model[0]['meshes']:
        parts = []
        for p in mesh['primitives']:
            parts.append({'attributes': {k: accessor(model, v) for k, v in p['attributes'].items()},
                          'indices': accessor(model, p['indices']), 'material': p['material'],
                          'mode': p.get('mode', 4)})
        result[mesh['name']] = parts
    return result


def validate(baseline, target):
    before, after = load_glb(baseline/'hirakata-complete.glb'), load_glb(target/'hirakata-complete.glb')
    old, new = signatures(before), signatures(after)
    report = json.loads((target/'district-geometry-report.json').read_text(encoding='utf-8'))
    if list(old) != list(new):
        raise ValueError('Mesh names/order changed')
    for field in ('nodes', 'materials', 'scenes'):
        if before[0][field] != after[0][field]:
            raise ValueError(field + ' changed')
    if (baseline/'walk-layout.json').read_bytes() != (target/'walk-layout.json').read_bytes():
        raise ValueError('Walking/collision layout bytes changed')
    expected = set(report['changedMeshNames'])
    changed = {name for name in old if old[name] != new[name]}
    if changed != expected:
        raise ValueError('Unexpected changed mesh payloads: ' + repr(changed ^ expected))
    count = lambda s: sum(p['indices']['count']//3 for parts in s.values() for p in parts)
    if count(new) != report['afterTriangles'] or count(old) != report['beforeTriangles']:
        raise ValueError('Triangle accounting mismatch')
    if count(new) > count(old)*1.10:
        raise ValueError('GLB exceeded 10 percent triangle budget')
    checks = {'inputSha256': hashlib.sha256(before[2]).hexdigest(),
              'outputSha256': hashlib.sha256(after[2]).hexdigest(),
              'beforeBytes': len(before[2]), 'afterBytes': len(after[2]),
              'nodes': len(after[0]['nodes']), 'meshes': len(new), 'materials': len(after[0]['materials']),
              'beforeTriangles': count(old), 'afterTriangles': count(new),
              'changedMeshes': sorted(changed), 'unchangedMeshPayloads': len(old)-len(changed),
              'namesOrderNodesMaterialsScenesIdentical': True, 'walkLayoutBytesIdentical': True,
              'layoutSha256': hashlib.sha256((target/'walk-layout.json').read_bytes()).hexdigest(),
              'unchangedMeshHashes': {n: old[n] for n in old if n not in changed},
              'scope': 'Silent offline geometry; no browser FPS, gameplay or deployment claims'}
    (target/'geometry-validation.json').write_text(json.dumps(checks, indent=2)+'\n', encoding='utf-8')
    return {k: v for k, v in checks.items() if k not in ('unchangedMeshHashes', 'changedMeshes')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--baseline-dir', type=Path, help='Approved stair/terrace output for exact payload validation')
    parser.add_argument('--blender', type=Path)
    args = parser.parse_args()
    if args.blender and not args.baseline_dir:
        parser.error('--baseline-dir is required for a verified Blender build')
    target = args.output_dir.resolve()
    baseline = args.baseline_dir.resolve() if args.baseline_dir else None
    if baseline and (baseline == target or baseline in target.parents or target in baseline.parents):
        raise ValueError('Baseline and output must be separate directories')
    flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
    prior = Path(__file__).with_name('prepare-hirakata-terrace-support.py')
    subprocess.run([sys.executable, str(prior), '--source-dir', str(args.source_dir),
                    '--output-dir', str(target)], creationflags=flags, check=True)
    source = target/'build_model.py'
    text = source.read_text(encoding='utf-8')
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    text = replace_once(text, 'def quad(points,mat):', FINISH+'\ndef quad(points,mat):')
    export = "bpy.ops.export_scene.gltf(filepath=str(OUT/'hirakata-complete.glb')"
    text = replace_once(text, export, REPORT+'\n'+export)
    source.write_text(text, encoding='utf-8', newline='\n')
    manifest = {'terraceSourceSha256': source_hash, 'preparedSourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'geometry': 'Selected opaque box vertical-edge bevel', 'maxWidthMetres': .02,
                'relativeWidthLimit': .06, 'segments': 1, 'triangleIncreaseLimit': .10,
                'preserved': ['support planes', 'walking layout', 'floor and road geometry', 'stairs',
                              'tactile paving', 'text', 'vehicles', 'TSITE terrace furniture', 'mesh/material/module order'],
                'images': False, 'audio': False, 'publicAssetChanged': False}
    (target/'district-source-patch.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({'prepared': str(target), 'exported': False, 'images': False}), flush=True)
    if args.blender:
        with (target/'build.log').open('w', encoding='utf-8') as log:
            subprocess.run([str(args.blender.resolve(strict=True)), '--background', '--factory-startup',
                            '--python-exit-code', '1', '--python', str(source)],
                           stdout=log, stderr=subprocess.STDOUT, creationflags=flags, check=True)
        print(json.dumps({'exported': str(target/'hirakata-complete.glb'), 'validation': validate(baseline, target)}), flush=True)


if __name__ == '__main__':
    main()
