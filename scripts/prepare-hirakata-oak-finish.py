"""Prepare a neutral, self-hosted 512px CC0 oak finish from three reviewed JPGs.

No network access. Inputs must be the three 1k Poly Haven files below. This is
asset preparation, not image generation: recorded grain/roughness/normals stay
registered while albedo is neutralized to multiply the game's existing colors.
Usage: python scripts/prepare-hirakata-oak-finish.py --input <wood-assets> \
  --output public/assets/hirakata-oak-finish.js --report <private-report.json>
Requires Pillow and numpy; does not affect runtime dependencies.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

SOURCE = {
    "Diffuse": ("39a99df4e328d62d74f3122722a64a95", "diff"),
    "Rough": ("a19b44176a078b9ae93314133848c9aa", "rough"),
    "nor_gl": ("d05406f5fdaf51f0d7b115b35d9af1b7", "nor_gl"),
}
SIZE = 512


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    sources = {}
    images = {}
    for name, (digest, suffix) in SOURCE.items():
        path = args.input / (name + ".jpg")
        raw = path.read_bytes()
        assert hashlib.md5(raw).hexdigest() == digest, f"Unexpected source: {name}"
        image = Image.open(path).convert("RGB")
        assert image.size == (1024, 1024), f"Unexpected source dimensions: {name}"
        images[name] = np.asarray(image.resize((SIZE, SIZE), Image.Resampling.LANCZOS), dtype=np.float32)
        sources[name] = {
            "url": f"https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/oak_veneer_01/oak_veneer_01_{suffix}_1k.jpg",
            "bytes": len(raw), "md5": digest, "sha256": hashlib.sha256(raw).hexdigest(),
        }
    # Neutral detail keeps the warm original timber and gray East hall distinct.
    luma = images["Diffuse"] @ np.array([.2126, .7152, .0722], dtype=np.float32)
    luma = np.clip(223 + 1.35 * (luma - luma.mean()), 168, 250)
    albedo = np.repeat(luma[:, :, None], 3, axis=2)
    rough = images["Rough"][:, :, 0]
    rough = np.clip(222 + .60 * (rough - rough.mean()), 164, 250)
    rough = np.repeat(rough[:, :, None], 3, axis=2)
    normal = images["nor_gl"] / 127.5 - 1
    normal /= np.maximum(np.linalg.norm(normal, axis=2, keepdims=True), 1e-6)
    normal = (normal + 1) * 127.5
    maps = {"albedo": albedo, "roughness": rough, "normal": normal}
    encoded = {}
    report_maps = {}
    for name, rgb in maps.items():
        rgba = np.empty((SIZE, SIZE, 4), dtype=np.uint8)
        rgba[:, :, :3] = np.rint(rgb).clip(0, 255).astype(np.uint8)
        rgba[:, :, 3] = 255
        # DataTexture rows start at bottom. Preserve OpenGL normal convention.
        raw = np.ascontiguousarray(rgba[::-1]).tobytes()
        encoded[name] = base64.b64encode(raw).decode("ascii")
        report_maps[name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
                             "range": [int(rgba[:, :, :3].min()), int(rgba[:, :, :3].max())],
                             "mean": rgba[:, :, :3].mean(axis=(0, 1)).tolist()}
        Image.fromarray(rgba).save(args.input / ("prepared-" + name + ".png"))
    provenance = {"asset": "Oak Veneer 01", "author": "Jenelle van Heerden", "provider": "Poly Haven",
                  "url": "https://polyhaven.com/a/oak_veneer_01", "license": "CC0-1.0",
                  "licenseUrl": "https://polyhaven.com/license", "sourceWidthMeters": 1.8,
                  "processing": "1k JPG to 512px; neutral luminance albedo, satin roughness range, renormalized OpenGL normals, rows reversed for DataTexture",
                  "sourceSha256": {name: item["sha256"] for name, item in sources.items()},
                  "mapSha256": {name: item["sha256"] for name, item in report_maps.items()}}
    output = {"width": SIZE, "height": SIZE, **encoded, "provenance": provenance}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text("// Poly Haven Oak Veneer 01, Jenelle van Heerden, CC0-1.0.\n"
                           "// Prepared by scripts/prepare-hirakata-oak-finish.py; three raw RGBA maps.\n"
                           "export const OAK_FINISH = Object.freeze(" + json.dumps(output, ensure_ascii=False, separators=(",", ":")) + ");\n", encoding="utf-8")
    report = {"sources": sources, "maps": report_maps, "provenance": provenance,
              "totalDownloadedBytes": sum(item["bytes"] for item in sources.values()),
              "moduleBytes": args.output.stat().st_size,
              "moduleSha256": hashlib.sha256(args.output.read_bytes()).hexdigest()}
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"prepared": True, "width": SIZE, "height": SIZE,
                      "moduleBytes": report["moduleBytes"], "downloadedBytes": report["totalDownloadedBytes"]}))


if __name__ == "__main__":
    main()
