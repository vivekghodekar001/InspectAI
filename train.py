import argparse, hashlib, json, time
from pathlib import Path
import numpy as np
from PIL import Image
import torch
from inspectai.detector import Detector


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="data/bottle")
    p.add_argument("--models", default="models")
    p.add_argument("--bank-size", type=int, default=6000)
    a = p.parse_args()
    files = sorted((Path(a.data) / "train" / "good").glob("*.png"))
    if len(files) < 20:
        raise SystemExit(
            "Need at least 20 normal PNG training images in DATA/train/good"
        )
    if a.bank_size < 100:
        raise SystemExit("bank-size must be >=100")
    rng = np.random.default_rng(42)
    order = rng.permutation(len(files))
    n = max(10, len(files) // 5)
    calibration = [files[i] for i in order[:n]]
    train = [files[i] for i in order[n:]]
    model = Detector(a.models, load_bank=False)
    all_features = []
    start = time.perf_counter()
    for i, f in enumerate(train):
        with Image.open(f) as im:
            v, _ = model.features(im)
        all_features.append(v)
        if (i + 1) % 25 == 0:
            print(f"Extracted {i+1}/{len(train)} normal images", flush=True)
    bank = torch.cat(all_features)
    idx = rng.choice(len(bank), min(a.bank_size, len(bank)), replace=False)
    model.bank = bank[idx].contiguous()
    scores = []
    for f in calibration:
        with Image.open(f) as im:
            scores.append(model.raw(im)[0])
    threshold = float(np.quantile(scores, 0.95))
    root = Path(a.models)
    root.mkdir(exist_ok=True)
    np.savez_compressed(root / "memory.npz", bank=model.bank.numpy())
    meta = {
        "model": "ResNet18 patch-memory baseline",
        "category": Path(a.data).name,
        "input_size": 192,
        "feature_dimension": 64,
        "memory_patches": len(model.bank),
        "seed": 42,
        "train_images": len(train),
        "calibration_images": len(calibration),
        "threshold": threshold,
        "threshold_rule": "95th percentile of held-out normal calibration scores",
        "score_definition": "Mean of top 9 nearest-neighbor patch distances",
        "training_seconds": round(time.perf_counter() - start, 2),
        "train_files": [f.name for f in train],
        "calibration_files": [f.name for f in calibration],
        "calibration_scores": scores,
        "backbone_sha256": hashlib.sha256(
            (root / "resnet18-f37072fd.pth").read_bytes()
        ).hexdigest(),
        "data_source": "MVTec AD via Voxel51 mirror; resized to 256x256",
        "limitations": "Bottle-category baseline. Not validated for other objects, cameras, or production. No neural fine-tuning.",
    }
    (root / "metadata.json").write_text(json.dumps(meta, indent=2))
    print(
        json.dumps({k: v for k, v in meta.items() if not isinstance(v, list)}, indent=2)
    )


if __name__ == "__main__":
    main()
