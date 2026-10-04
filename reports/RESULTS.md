# Measured evaluation results

Dataset: MVTec AD bottle category, pinned Voxel51 mirror. Image resize: 256 × 256; feature extraction: 192 × 192. Seed: 42. One fixed configuration was evaluated; no test-set threshold tuning.

| Measure | Result |
|---|---:|
| Normal images used for memory fitting | 168 |
| Separate normal calibration images | 41 |
| Held-out test images | 83 |
| Test defects / normal | 63 / 20 |
| Image AUROC | 0.999206 |
| Average precision | 0.999752 |
| Precision at calibrated threshold | 98.4375% |
| Recall at calibrated threshold | 100.0000% |
| F1 | 0.992126 |
| Median inference time | 25.6 ms |
| 95th percentile inference time | 39.5 ms |
| Decision threshold | 1.472671 |

## Confusion matrix

| Actual class | Predicted normal | Flagged for review |
|---|---:|---:|
| Normal | 19 | 1 |
| Defective | 0 | 63 |

All 63 defects were flagged; one of 20 normal images was also flagged. The threshold was the 95th percentile of 41 normal calibration scores. This is a small, single-category benchmark and does not establish a real-world 100% detection rate. The image AUROC is a ranking metric, not classification accuracy.

## Error analysis

The false-positive image is `test/good/006-95.png`, with score 1.792428. There were no false negatives in this test split. The false-positive cause has not been independently established; inspect this image before assigning a cause. See every prediction in `predictions.csv`.

## Reproducibility and limits

- Measured on x86_64 CPU with two Torch threads; inference excludes initial model loading and HTTP transport, includes feature extraction and patch search, and is measured after warm-up. CPU/system load changes latency.
- No neural fine-tuning, test-time augmentation, threshold tuning using test labels, or post-evaluation hyperparameter change.
- Normal calibration and reference-memory files are disjoint. Source IDs, split membership and checksums are supplied.
- No pixel-level localization evaluation, statistical confidence interval, external camera test, or production trial.
- Included sample images are from this same test split and are not a second benchmark.
