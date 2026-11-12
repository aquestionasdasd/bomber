"""Prepare three reviewed CC0 photo finishes; no network or runtime dependency.

Usage: python scripts/prepare-hirakata-district-materials.py --input <materials>
  --output public/assets/hirakata-district-finish.js --report <private-report.json>
Requires Pillow and numpy. The original files, official files-api.json responses,
and polyhaven-license.html remain in the private input directory. Output is raw
RGBA for synchronous Three.js DataTexture creation, with bottom-up row order.
"""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 512
FAMILIES = {
    "asphalt": {
        "id": "clean_asphalt", "title": "Clean Asphalt", "author": "Dimitrios Savva",
        "resolution": "1k", "source_size": 1024, "source_width": 2.1,
        "albedo": (224, 1.65, 176, 248), "roughness": (238, .55, 194, 250),
        "md5": {"Diffuse": "7edccb95cbf72e63889baade8455f9e5", "Rough": "4238f2eab76530f4b0c66ddb929b142d", "nor_gl": "24dadd366637a722b59c19a672cbbcf6"},
    },
    "concrete": {
        "id": "granular_concrete", "title": "Granular Concrete",
        "author": "Dario Barresi (processing); Michael Jenkins (photography)",
        "resolution": "1k", "source_size": 1024, "source_width": 2.4,
        "albedo": (232, .75, 176, 248), "roughness": (228, .65, 178, 250),
        "md5": {"Diffuse": "189811555459ff4d539c862f2b478083", "Rough": "4905547af76bacba1e0163e80a797d3a", "nor_gl": "f6cbde2f3fd386f76114cf99db46528f"},
    },
    "paving": {
        "id": "granite_tile", "title": "Granite Tile (joint-free stone interior)",
        "author": "Charlotte Baglioni", "resolution": "4k", "source_size": 4096,
        "source_width": 2.3, "crop": (80, 80, 720, 720), "periodic_band": 24,
        "albedo": (228, .90, 176, 248), "roughness": (218, .60, 174, 246),
        "md5": {"Diffuse": "2a0253486ea71ce26a3a3cd5f913edce", "Rough": "4b4ecc5d7719d572bae2031415d737cc", "nor_gl": "2690f16a92f820f510f23bde6ce4ac87"},
    },
}


def sha256(raw):
    return hashlib.sha256(raw).hexdigest()


def periodic_edges(array, band):
    """Match paired outer edges, fading changes into a narrow boundary band.

    Apply the same spatial operation to registered color, roughness, and signed
    OpenGL vectors. Vector normalization happens afterwards; green is not flipped.
    """
    result = array.copy()
    for axis in (0, 1):
        value = np.swapaxes(result, 0, axis)
        for index in range(band):
            weight = .5 * (1 + np.cos(np.pi * index / (band - 1)))
            low, high = value[index].copy(), value[-index - 1].copy()
            mean = (low + high) * .5
            value[index] = low * (1 - weight) + mean * weight
            value[-index - 1] = high * (1 - weight) + mean * weight
    return result


def modulate(values, params):
    target, gain, minimum, maximum = params
    return np.clip(target + gain * (values - values.mean()), minimum, maximum)


def prepare_family(family, spec, input_root, license_sha):
    folder = input_root / spec["id"]
    api = json.loads((folder / "files-api.json").read_text(encoding="utf-8-sig"))
    sources, images = {}, {}
    suffix = "-4k" if spec["resolution"] == "4k" else ""
    for name, expected_md5 in spec["md5"].items():
        path = folder / (name + suffix + ".jpg")
        raw = path.read_bytes()
        info = api[name][spec["resolution"]]["jpg"]
        assert hashlib.md5(raw).hexdigest() == expected_md5 == info["md5"], name
        assert len(raw) == info["size"], name
        with Image.open(path) as source:
            assert source.size == (spec["source_size"], spec["source_size"]), name
            image = source.convert("RGB")
            if "crop" in spec:
                image = image.crop(spec["crop"])
            image = image.resize((SIZE, SIZE), Image.Resampling.LANCZOS)
            images[name] = np.asarray(image, dtype=np.float32)
        sources[name] = {"url": info["url"], "bytes": len(raw), "md5": expected_md5, "sha256": sha256(raw)}

    # Existing material color supplies the hue. Retain real photographic detail
    # with a modest neutral modulation, without adding grime or painted shadows.
    luma = images["Diffuse"] @ np.array([.2126, .7152, .0722], dtype=np.float32)
    albedo = modulate(luma, spec["albedo"])
    roughness = modulate(images["Rough"][:, :, 0], spec["roughness"])
    normal = images["nor_gl"] / 127.5 - 1
    if "periodic_band" in spec:
        albedo = periodic_edges(albedo, spec["periodic_band"])
        roughness = periodic_edges(roughness, spec["periodic_band"])
        normal = periodic_edges(normal, spec["periodic_band"])
    normal /= np.maximum(np.linalg.norm(normal, axis=2, keepdims=True), 1e-6)
    assert np.all(normal[:, :, 2] > 0), "OpenGL normal hemisphere changed"
    maps = {"albedo": np.repeat(albedo[:, :, None], 3, axis=2),
            "roughness": np.repeat(roughness[:, :, None], 3, axis=2),
            "normal": (normal + 1) * 127.5}
    encoded, report_maps = {}, {}
    for name, rgb in maps.items():
        rgba = np.empty((SIZE, SIZE, 4), dtype=np.uint8)
        rgba[:, :, :3] = np.rint(rgb).clip(0, 255).astype(np.uint8)
        rgba[:, :, 3] = 255
        raw = np.ascontiguousarray(rgba[::-1]).tobytes()
        assert len(raw) == SIZE * SIZE * 4
        assert np.all(rgba[:, :, 3] == 255)
        if name != "normal":
            assert np.array_equal(rgba[:, :, 0], rgba[:, :, 1])
            assert np.array_equal(rgba[:, :, 0], rgba[:, :, 2])
        encoded[name] = base64.b64encode(raw).decode("ascii")
        stats = {"bytes": len(raw), "sha256": sha256(raw),
                 "range": [int(rgba[:, :, :3].min()), int(rgba[:, :, :3].max())],
                 "mean": rgba[:, :, :3].mean(axis=(0, 1)).tolist(),
                 "standardDeviation": rgba[:, :, :3].std(axis=(0, 1)).tolist(),
                 "boundaryMeanAbsDifference": [float(np.abs(rgba[0, :, :3].astype(float) - rgba[-1, :, :3]).mean()),
                                               float(np.abs(rgba[:, 0, :3].astype(float) - rgba[:, -1, :3]).mean())]}
        if name == "normal":
            norm = np.linalg.norm(rgba[:, :, :3].astype(float) / 127.5 - 1, axis=2)
            stats["decodedNormalLengthRange"] = [float(norm.min()), float(norm.max())]
            assert norm.min() > .992 and norm.max() < 1.008
        if "periodic_band" in spec:
            assert stats["boundaryMeanAbsDifference"] == [0., 0.]
        report_maps[name] = stats
        Image.fromarray(rgba).save(folder / ("prepared-" + name + ".png"))

    crop_ratio = (spec["crop"][2] - spec["crop"][0]) / spec["source_size"] if "crop" in spec else 1
    provenance = {"asset": spec["title"], "author": spec["author"], "provider": "Poly Haven",
                  "url": "https://polyhaven.com/a/" + spec["id"], "license": "CC0-1.0",
                  "licenseUrl": "https://polyhaven.com/license", "licenseSnapshotSha256": license_sha,
                  "sourceWidthMeters": spec["source_width"] * crop_ratio,
                  "originalWidthMeters": spec["source_width"], "sourceResolution": spec["resolution"],
                  "processing": "Photographic diffuse/roughness/OpenGL normal; 512px Lanczos, neutral grayscale modulation, signed-vector renormalization, bottom-up DataTexture rows",
                  "sourceSha256": {name: item["sha256"] for name, item in sources.items()},
                  "mapSha256": {name: item["sha256"] for name, item in report_maps.items()}}
    if "crop" in spec:
        provenance["cropPixels"] = list(spec["crop"])
        provenance["periodicBoundaryBandPixels"] = spec["periodic_band"]
        provenance["processing"] += "; joint-free stone crop; paired edges blended in 24px band before vector normalization; normal axes unchanged"
    return {"width": SIZE, "height": SIZE, **encoded, "provenance": provenance}, {
        "sources": sources, "maps": report_maps, "provenance": provenance,
        "processingParameters": {"albedoTargetGainRange": spec["albedo"], "roughnessTargetGainRange": spec["roughness"]}}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    license_raw = (args.input / "polyhaven-license.html").read_bytes()
    assert b"CC0" in license_raw
    license_sha = sha256(license_raw)
    output, families = {}, {}
    for family, spec in FAMILIES.items():
        output[family], families[family] = prepare_family(family, spec, args.input, license_sha)
    module = ("// Three self-hosted CC0 photo finishes from Poly Haven; see each provenance.\n"
              "// Generated by scripts/prepare-hirakata-district-materials.py.\n"
              "export const DISTRICT_FINISH = Object.freeze(" + json.dumps(output, ensure_ascii=False, separators=(",", ":")) + ");\n").encode("utf-8")
    base_bytes = sum(item["bytes"] for value in families.values() for item in value["maps"].values())
    gzip_bytes = len(gzip.compress(module, compresslevel=9, mtime=0))
    assert base_bytes <= 9 * 1024 * 1024
    assert gzip_bytes <= 3 * 1024 * 1024, "Asset compression budget exceeded"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(module)
    report = {"families": families, "licenseSnapshotSha256": license_sha,
              "baseRgbaBytes": base_bytes, "moduleBytes": len(module), "moduleGzipBytes": gzip_bytes,
              "moduleSha256": sha256(module), "inputDownloadBytes": sum(item["bytes"] for value in families.values() for item in value["sources"].values()),
              "review": "All 1k diffuse originals visually inspected; no cracks/moss/heavy dirt. Paving crop excludes existing photo joints to preserve geometric tile joints. Runtime material appearance requires separate in-game review."}
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: report[key] for key in ("baseRgbaBytes", "moduleBytes", "moduleGzipBytes", "moduleSha256")}))


if __name__ == "__main__":
    main()
