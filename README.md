# InspectAI

**AI-Based Image Anomaly Detection for Visual Inspection**

InspectAI is a local computer vision application that detects unusual or defective images using a **ResNet18-based anomaly detection model**.

Currently designed and evaluated for the **MVTec AD bottle category**.

## ✨ Features

- 🖼️ Image upload and sample selection
- 🔍 Visual anomaly detection
- 📊 Anomaly score and decision
- 🌡️ Qualitative heatmap
- ⚡ Inference time measurement
- 🖥️ Local Flask dashboard
- 🔒 Uploaded images are not retained

## 🔄 How It Works

```text
Image
  ↓
Preprocessing
  ↓
ResNet18 Features
  ↓
Feature Projection
  ↓
Normal Memory Bank
  ↓
Nearest-Neighbor Comparison
  ↓
Anomaly Score
  ↓
Threshold
  ↓
Normal / Possible Defect
  ↓
Heatmap
```

## 🧠 Model

- **Backbone:** ResNet18
- **Input:** 192 × 192
- **Feature Dimension:** 64
- **Memory Bank:** Up to 6000 patches
- **Method:** Patch nearest-neighbor distance
- **Threshold:** 95th percentile of normal calibration scores
- **Fine-tuning:** No

> A compact anomaly-detection baseline, not an exact PatchCore implementation.

## 📦 Dataset

**MVTec Anomaly Detection (MVTec AD)** — Bottle category.

## 🚀 Run

### Windows

```bash
start_windows.bat
```

### Manual

```bash
python app.py
```

Open: `http://127.0.0.1:7860`

## 📈 Evaluation

```bash
python evaluate.py
```

Reports include **AUROC, Precision, Recall, F1-score, Confusion Matrix, and Inference Latency**.

## 📁 Project Structure

```text
InspectAI/
├── app.py
├── train.py
├── evaluate.py
├── inspectai/
├── models/
├── reports/
├── samples/
├── scripts/
├── templates/
├── static/
└── tests/
```

## ⚠️ Limitations

Currently focused on the **MVTec AD bottle category** and not validated for production use or other camera/object setups.

## 🤝 Contributing

Contributions are welcome. Create a branch, make your changes, test, commit, push, and open a Pull Request.

## 📄 License

See `LICENSE`.

## 👤 Author

**Vivek Ghodekar**