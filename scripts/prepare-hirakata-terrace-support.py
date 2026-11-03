"""Rebuild the approved stair opening and put terrace furniture on its real floor.

Use the original four model Python sources. The prior opening preparer verifies
their hashes and copies them into a separate directory, without image rendering.
Only the unsupported third cafe setting and its paving rings are moved here.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import sys


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Expected one terrace source anchor: ' + before)
    return text.replace(before, after, 1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--blender', type=Path)
    args = parser.parse_args()
    target = args.output_dir.resolve()
    prior = Path(__file__).with_name('prepare-hirakata-stair-opening.py')
    flags = subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0
    subprocess.run([sys.executable, str(prior), '--source-dir', str(args.source_dir),
                    '--output-dir', str(target)], creationflags=flags, check=True)
    script = target / 'build_model.py'
    text = script.read_text(encoding='utf-8')
    baseline_hash = hashlib.sha256(script.read_bytes()).hexdigest()
    text = replace_once(text, 'for x,y in [(16,-65),(16,-72),(16,-86)]:',
                        'for x,y in [(16,-65),(16,-72),(14,-57)]:')
    text = replace_once(text, "ring(15,-88,6.45,radius,radius,.16,'blue')",
                        "ring(14,-57,6.416,radius,radius,.16,'blue')")
    script.write_text(text, encoding='utf-8', newline='\n')
    manifest = {'stairOpeningSourceSha256': baseline_hash,
                'furniture': {'old': [16, 6.4, 86], 'new': [14, 6.4, 57]},
                'pavingRings': {'old': [15, 6.45, 88], 'new': [14, 6.416, 57]},
                'floorAndCollisionLayoutChanged': False, 'images': False}
    (target / 'terrace-patch.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    if args.blender:
        command = [str(args.blender.resolve(strict=True)), '--background', '--factory-startup',
                   '--python-exit-code', '1', '--python', str(script)]
        with (target / 'build.log').open('w', encoding='utf-8') as log:
            subprocess.run(command, stdout=log, stderr=subprocess.STDOUT, creationflags=flags, check=True)
    print(json.dumps({'prepared': str(target), 'exported': bool(args.blender), 'images': False}))


if __name__ == '__main__':
    main()
