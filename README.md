# InspectAI — Visual Defect Detection

A complete local computer-vision showcase: upload an image, inspect a qualitative anomaly heatmap, compare the score with a calibrated threshold, and export a JSON report. Includes a fitted model, real test samples, measured evaluation results, source code, reproducible training, and input-validation tests.

![Real inspection examples](docs/inspection_examples.png)

## Run on Windows (recommended: Python 3.12)

1. Extract the entire ZIP into a folder (do not run it inside the ZIP).
2. Install **Python 3.12, 64-bit** from https://www.python.org/downloads/ if needed. The Windows Python launcher (`py`) must be installed.
3. Double-click **`start_windows.bat`**. On the first run it creates an isolated environment and installs dependencies. Internet is needed for this step; allow several minutes and around 2 GB of free space.
4. When the terminal says the server is running, open **http://127.0.0.1:7860**.
5. Select a sample and click **Run inspection**. Try a normal bottle, a broken bottle, and a contaminated bottle. You can also upload a PNG/JPG/WebP.
6. Leave the terminal open while using the app. Press Ctrl+C to stop.

The distributed ZIP already contains the backbone and fitted memory bank. **No training, account, API key, or GPU is required to use it.** After dependency installation, inference runs offline. This is a local application, not a hosted public URL.

### Manual Windows setup

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe app.py
```

### Linux

Use Python 3.12 and run `bash start.sh`, then open http://127.0.0.1:7860. The Windows launcher was supplied but not executed on Windows; model and API validation were performed on Linux CPU with Python 3.12. Browser launch was blocked by this execution environment; a visual browser check could not be completed. Apple Silicon installation is not tested; install the appropriate PyTorch wheels if adapting it.

## What the model actually does

1. Resize the input to 192 × 192 and normalize with ImageNet channel statistics. Unlike a classifier preset, this workflow preserves the entire image without a center crop.
2. Extract frozen ResNet18 layer2 and layer3 feature maps. Smooth locally and align spatial resolutions.
3. Concatenate features, then use a seeded Gaussian random projection from 384 to 64 dimensions.
4. Store 6,000 randomly sampled patches from normal training images.
5. At inference, compute each patch's nearest-neighbor distance to the memory bank.
6. Average the nine largest patch distances for the image score. Smooth and resize patch scores for a qualitative heatmap.
7. Flag the image when its score exceeds the 95th percentile of scores from a **separate normal-only calibration set**.

The backbone is pretrained; it is **not fine-tuned**. Fitting learns the reference memory and decision threshold. This is an independently implemented patch-memory baseline, not official PatchCore. An anomaly score is a distance, **not a probability or confidence percentage**.

## Data and evaluation

We use the MVTec AD **bottle** category: 209 official normal training images and 83 official test images. The seeded training/calibration split reserves 41 of the training images for calibration and uses 168 for the memory bank. Test labels do not select the threshold or tune the model. Images are downloaded from a pinned Voxel51 mirror and resized to 256 × 256; features use 192 × 192 inputs.

- `reports/metrics.json`: image AUROC, average precision, precision, recall, F1, confusion matrix, and latency.
- `reports/predictions.csv`: every held-out test prediction.
- `reports/errors.json`: all false positives and false negatives at the preset threshold.
- `reports/RESULTS.md`: readable measured results and limitations.
- `models/metadata.json`: split membership, calibration scores, parameters, backbone checksum.
- `docs/data_manifest.json`: source URLs and checksums of resized dataset images.

Only four test samples are bundled for immediate interaction; they were chosen by filename within each category, not by model score. The complete dataset can be downloaded using the provided script. The test samples are drawn from the same benchmark reported in the metrics, not an additional independent evaluation set.

## Reproduce training and evaluation

From the project directory, in the environment with dependencies installed:

```bash
python scripts/setup_model.py
python scripts/download_data.py
python train.py --data data/bottle --models models
python evaluate.py --data data/bottle --models models --output reports
python -m unittest discover -s tests -v
python app.py
```

On Windows replace `python` with `.\.venv\Scripts\python.exe` if the environment is not activated. The data download requires internet, fetches 292 source images, resizes them locally, and records provenance. It can take several minutes. Re-running uses already-downloaded files. Do not change images in place without clearing the data folder first. Retraining overwrites the memory bank and model metadata; restart the app afterward. CPU latency will vary by machine and system load.

## API

`GET /api/status` returns model metadata, evaluation metrics, and sample choices.

`POST /api/inspect` accepts a multipart field named `image`, or JSON `{"sample":"normal.png"}`. Returns score, threshold, decision, inference time, original PNG and heatmap PNG as data URLs. It does not use the filename or the test label for inference.

`GET /api/metrics` serves the measured benchmark JSON.

Uploads are not retained after the request. Maximum request size: 10 MB; maximum image size: 20 megapixels. The built-in Flask server binds to localhost by default and is meant for a personal demo. Public hosting requires a production server and suitable deployment controls.

## Showcase it honestly

Read `docs/INTERVIEW_GUIDE.md` for a 60-second walkthrough, explanations, and appropriate resume wording. Before claiming personal implementation, review and understand the code and make your own contributions; this project was built with AI assistance.

Publish the source, memory bank, metrics, and samples to your own GitHub repository. The `.gitignore` excludes the backbone and full dataset. Cloned repositories need `python scripts/setup_model.py` before running. Keep dataset attribution and licenses. Add your actual GitHub URL to internship forms; no repository has been published for you by this package.

## Limits

- Validated only on the bottle category with a fixed camera-like viewpoint. Arbitrary photos, side-view bottles, and other products are out of scope.
- No independent camera dataset, confidence intervals, robustness benchmark, GPU/edge benchmark, ONNX conversion, neural fine-tuning, or VLM is included.
- Heatmaps guide review; **pixel-level localization has not been evaluated**.
- A small calibration set cannot guarantee a production false-positive rate. Report both missed defects and false alarms.
- Research and educational showcase, not a production quality-control certification.
- Dataset samples and derived assets are noncommercial; see `THIRD_PARTY.md`.

## Layout

```text
app.py                  Flask backend and local launcher
inspectai/detector.py    Feature extraction, memory search, heatmaps
train.py                Normal-only memory fitting and calibration
evaluate.py             Held-out evaluation and error analysis
static/                 Responsive dashboard CSS and JavaScript
templates/              Dashboard HTML
models/                 Backbone, fitted bank, metadata
samples/                Four attributed real test samples
reports/                Actual metrics and individual predictions
scripts/                Reproducible downloads
tests/                 API and protocol checks
```
