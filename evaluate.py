import argparse, csv, json, time, platform
from pathlib import Path
import numpy as np
from PIL import Image
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    precision_recall_fscore_support,
    confusion_matrix,
)
from inspectai.detector import Detector


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", default="data/bottle")
    p.add_argument("--models", default="models")
    p.add_argument("--output", default="reports")
    a = p.parse_args()
    model = Detector(a.models)
    rows = []
    files = sorted((Path(a.data) / "test").glob("*/*.png"))
    if not files:
        raise SystemExit("No test images found")
    # Warm-up is excluded from timing.
    with Image.open(files[0]) as im:
        model.predict(im)
    for f in files:
        with Image.open(f) as im:
            r, _ = model.predict(im)
        rows.append(
            {
                "file": str(f.relative_to(a.data)),
                "defect": f.parent.name,
                "label": int(f.parent.name != "good"),
                **r,
            }
        )
    y = [r["label"] for r in rows]
    s = [r["score"] for r in rows]
    pred = [int(r["is_anomaly"]) for r in rows]
    precision, recall, f1, _ = precision_recall_fscore_support(
        y, pred, average="binary", zero_division=0
    )
    cm = confusion_matrix(y, pred, labels=[0, 1]).tolist()
    result = {
        "dataset": "MVTec AD bottle — full official test split via pinned mirror",
        "test_images": len(y),
        "normal_images": y.count(0),
        "defect_images": y.count(1),
        "image_auroc": float(roc_auc_score(y, s)) if len(set(y)) > 1 else None,
        "average_precision": (
            float(average_precision_score(y, s)) if len(set(y)) > 1 else None
        ),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "confusion_matrix": cm,
        "confusion_matrix_order": [["TN", "FP"], ["FN", "TP"]],
        "threshold": model.meta["threshold"],
        "threshold_selection": "Normal-only calibration; test labels never used to choose threshold",
        "median_inference_ms": float(np.median([r["latency_ms"] for r in rows])),
        "p95_inference_ms": float(np.quantile([r["latency_ms"] for r in rows], 0.95)),
        "hardware": platform.machine() + " CPU; torch threads=2",
        "pixel_localization_evaluated": False,
        "per_defect_recall": {
            d: sum(r["is_anomaly"] for r in rows if r["defect"] == d)
            / sum(r["defect"] == d for r in rows)
            for d in sorted(set(r["defect"] for r in rows) - {"good"})
        },
    }
    out = Path(a.output)
    out.mkdir(exist_ok=True)
    (out / "metrics.json").write_text(json.dumps(result, indent=2))
    with (out / "predictions.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=rows[0].keys())
        w.writeheader()
        w.writerows(rows)
    (out / "errors.json").write_text(
        json.dumps([r for r in rows if bool(r["label"]) != r["is_anomaly"]], indent=2)
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
