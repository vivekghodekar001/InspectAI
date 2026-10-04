from pathlib import Path
import json, time
import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import gaussian_filter
import torch
from torch.nn import functional as F
from torchvision.models import resnet18

ROOT = Path(__file__).resolve().parents[1]
SIZE = 192


class Detector:
    """Frozen ImageNet ResNet18 features + seeded random projection + patch kNN.

    This is a compact baseline, not an exact PatchCore implementation.
    Scores are distances, not probabilities. Calibration uses held-out normal images.
    """

    def __init__(self, model_dir=ROOT / "models", load_bank=True):
        torch.set_num_threads(2)
        self.model_dir = Path(model_dir)
        self.net = resnet18(weights=None)
        weights = self.model_dir / "resnet18-f37072fd.pth"
        if not weights.exists():
            raise FileNotFoundError(
                "Missing backbone. Run python scripts/setup_model.py"
            )
        self.net.load_state_dict(
            torch.load(weights, map_location="cpu", weights_only=True)
        )
        self.net.eval()
        self.mean = torch.tensor([0.485, 0.456, 0.406]).view(1, 3, 1, 1)
        self.std = torch.tensor([0.229, 0.224, 0.225]).view(1, 3, 1, 1)
        rng = np.random.default_rng(42)
        self.projection = torch.from_numpy(
            rng.standard_normal((384, 64)).astype("float32") / 8
        )
        self.bank = None
        self.meta = {}
        if load_bank:
            with np.load(self.model_dir / "memory.npz", allow_pickle=False) as z:
                self.bank = torch.from_numpy(z["bank"].copy())
            self.meta = json.loads((self.model_dir / "metadata.json").read_text())

    @torch.inference_mode()
    def features(self, image):
        im = (
            ImageOps.exif_transpose(image)
            .convert("RGB")
            .resize((SIZE, SIZE), Image.Resampling.BILINEAR)
        )
        x = (
            torch.from_numpy(np.array(im).copy()).permute(2, 0, 1).float().unsqueeze(0)
            / 255
        )
        x = (x - self.mean) / self.std
        x = self.net.maxpool(self.net.relu(self.net.bn1(self.net.conv1(x))))
        x = self.net.layer1(x)
        a = self.net.layer2(x)
        b = self.net.layer3(a)
        a = F.avg_pool2d(a, 3, 1, 1)
        b = F.avg_pool2d(b, 3, 1, 1)
        b = F.interpolate(b, size=a.shape[-2:], mode="bilinear", align_corners=False)
        v = torch.cat([a, b], dim=1).squeeze(0).permute(1, 2, 0)
        return v.reshape(-1, 384) @ self.projection, v.shape[0]

    @torch.inference_mode()
    def raw(self, image):
        if self.bank is None:
            raise RuntimeError("Fit a memory bank first")
        features, h = self.features(image)
        d = torch.cdist(features, self.bank).amin(dim=1).numpy().reshape(h, h)
        # Mean of the nine most unusual feature locations reduces single-pixel noise.
        score = float(np.partition(d.ravel(), -9)[-9:].mean())
        heat = np.array(
            Image.fromarray(d).resize((SIZE, SIZE), Image.Resampling.BILINEAR)
        )
        return score, gaussian_filter(heat, sigma=2)

    def predict(self, image, threshold=None):
        start = time.perf_counter()
        score, heat = self.raw(image)
        threshold = float(
            threshold if threshold is not None else self.meta["threshold"]
        )
        return {
            "score": round(score, 6),
            "threshold": round(threshold, 6),
            "decision": "Review defect" if score > threshold else "Within normal range",
            "is_anomaly": bool(score > threshold),
            "latency_ms": round((time.perf_counter() - start) * 1000, 1),
        }, heat

    @staticmethod
    def overlay(image, heat, scale):
        base = ImageOps.exif_transpose(image).convert("RGB").resize((SIZE, SIZE))
        norm = np.clip(heat / max(float(scale), 1e-8), 0, 1)
        rgb = np.stack([255 * norm, 190 * (1 - norm), 255 * (1 - norm)], axis=-1)
        alpha = (0.12 + 0.55 * norm)[..., None]
        mixed = np.asarray(base) * (1 - alpha) + rgb * alpha
        return Image.fromarray(np.uint8(mixed))
