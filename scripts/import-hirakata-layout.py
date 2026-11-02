"""Copy the saved model's authored walking geometry into a browser ES module.

Usage: python scripts/import-hirakata-layout.py <walk-layout.json>
The source coordinates are Blender X/Y horizontal, Z up; game conversion is
performed once by hirakata-map.js. No video frames or credentials are copied.
"""
from pathlib import Path
import hashlib
import json
import sys

source = Path(sys.argv[1])
root = Path(__file__).resolve().parents[1]
layout = json.loads(source.read_text(encoding='utf-8'))
for field in ['surfaces', 'ramps', 'polygons', 'boxes', 'segments']:
    assert isinstance(layout[field], list)
layout['sourceSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
(root / 'public/hirakata-complete-layout.js').write_text(
    '// Generated from the approved local model. Do not edit geometry by hand.\n'
    + 'export const HIRAKATA_MODEL_LAYOUT=' + json.dumps(layout, ensure_ascii=False, separators=(',', ':')) + ';\n',
    encoding='utf-8')
print(json.dumps({'layoutSourceSha256': layout['sourceSha256']}))
