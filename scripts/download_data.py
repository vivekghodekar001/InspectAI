"""Download the bottle category from a pinned MVTec AD mirror; retain provenance."""

import argparse, concurrent.futures, hashlib, io, json, time, urllib.request
from pathlib import Path
from PIL import Image

REV = "30a183a3b96e3aef953f230784b123b719b09d97"
BASE = f"https://huggingface.co/datasets/Voxel51/mvtec-ad/resolve/{REV}/"


def fetch(path):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(BASE + path, timeout=60) as r:
                return r.read()
        except Exception:
            if attempt == 3:
                raise
            time.sleep(attempt + 1)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--output", default="data/bottle")
    a = p.parse_args()
    root = Path(a.output)
    root.mkdir(parents=True, exist_ok=True)
    samples = json.loads(fetch("samples.json"))["samples"]
    samples = [s for s in samples if s["category"]["label"] == "bottle"]

    def one(s):
        rel = Path(s["split"]) / s["defect"]["label"] / Path(s["filepath"]).name
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            raw = fetch(s["filepath"])
            im = Image.open(io.BytesIO(raw)).convert("RGB")
            im.resize((256, 256), Image.Resampling.LANCZOS).save(target)
        return {
            "file": str(rel).replace("\\", "/"),
            "source": BASE + s["filepath"],
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "split": s["split"],
            "defect": s["defect"]["label"],
        }

    out = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
        for item in pool.map(one, samples):
            out.append(item)
            if len(out) % 25 == 0:
                print(f"Downloaded {len(out)}/{len(samples)}", flush=True)
    (root / "manifest.json").write_text(
        json.dumps({"revision": REV, "resize": [256, 256], "images": out}, indent=2)
    )
    (root / "LICENSE.txt").write_bytes(fetch("license.txt"))
    print(f"Ready: {len(out)} images in {root}", flush=True)


if __name__ == "__main__":
    main()
