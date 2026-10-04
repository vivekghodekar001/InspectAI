# Explain InspectAI in an interview

## 60-second demonstration

**0–10 seconds:** “InspectAI is a bottle-defect inspection application. It learns what normal images look like and compares new images with that reference.”

**10–25 seconds:** Select the normal sample, run inspection, and explain the score and threshold. Then select a broken or contaminated sample and show the changed score and overlay. Describe the actual displayed decision; do not claim every sample is correctly classified.

**25–40 seconds:** “The model uses an ImageNet-pretrained ResNet18 as a frozen feature extractor. I use multiscale patches and nearest-neighbor distances to a normal-image memory bank. The heatmap highlights where features differ.”

**40–55 seconds:** Show the benchmark cards and `reports/errors.json`. “The threshold comes from held-out normal calibration images. The official test images are used only for evaluation. These results apply to one dataset category.”

**55–60 seconds:** Export a report. “Next I would test a different camera, measure pixel localization, and benchmark an optimized feature extractor.”

## Questions you should be able to answer

**Why anomaly detection?** In inspection, normal images are often easier to collect than examples of every possible defect. This model does not need defective training examples.

**What did training learn?** A normal-patch reference memory and an image-level decision threshold. It did not update the neural network weights.

**Why not call the score confidence?** Distance from normal features is not a calibrated probability of a defect.

**What is AUROC?** A threshold-independent ranking measure. Roughly, the probability that a random defective image receives a higher score than a random normal image. It does not tell you the operational false-alarm rate at the selected threshold.

**Why separate calibration?** Comparing reference images with their own memory can give artificially low scores. A separate normal set gives a more realistic threshold without consulting test labels.

**Why might it fail?** Changed lighting, camera angle, image scale, or a new product can shift features. Small defects can disappear at low resolution. The memory may not cover all normal variation.

**How is this different from PatchCore?** It uses random memory subsampling and a simple top-patch mean. The complete published PatchCore uses additional algorithmic choices, including coreset selection and score reweighting. This is a compact baseline, not a reproduction.

**What is actually optimized?** CPU use is kept manageable with a 192-pixel input, 64-dimensional projection, capped 6,000-patch memory, and two Torch threads. No hardware acceleration or deployment speedup claim is made without comparative measurements.

**Where was AI assistance used?** This starting project was generated and validated with an AI coding assistant. Review it, understand the design, and describe your own subsequent modifications accurately.

## Suitable project description

“InspectAI — a ResNet18 feature-based anomaly detection application for visual bottle inspection, with normal-only memory fitting, held-out threshold calibration, qualitative heatmaps, a local Flask dashboard, and reproducible test-set evaluation.”

Insert only actual metrics from `reports/RESULTS.md`. Do not claim production deployment, edge acceleration, segmentation accuracy, or neural fine-tuning.
