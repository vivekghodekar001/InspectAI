"""Local inspection dashboard. Uploaded images are not retained after processing."""

import base64, io, json, threading, warnings
from pathlib import Path
from flask import Flask, request, jsonify, render_template, send_from_directory
from PIL import Image, ImageOps, UnidentifiedImageError
from inspectai.detector import Detector

ROOT = Path(__file__).parent
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = 20_000_000
warnings.simplefilter("error", Image.DecompressionBombWarning)
model = None
lock = threading.Lock()


def get_model():
    global model
    with lock:
        if model is None:
            model = Detector()
    return model


def encode(im):
    b = io.BytesIO()
    im.save(b, format="PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/status")
def status():
    m = get_model()
    metrics = ROOT / "reports/metrics.json"
    return jsonify(
        model={k: v for k, v in m.meta.items() if not isinstance(v, list)},
        metrics=json.loads(metrics.read_text()) if metrics.exists() else None,
        samples=json.loads((ROOT / "samples/index.json").read_text()),
    )


@app.get("/samples/<path:name>")
def sample(name):
    return send_from_directory(ROOT / "samples", name)


@app.post("/api/inspect")
def inspect():
    try:
        if "image" in request.files:
            im = Image.open(request.files["image"].stream)
            im.load()
            name = request.files["image"].filename or "upload"
        else:
            body = request.get_json(silent=True) or {}
            if not isinstance(body, dict):
                return jsonify(error="Expected a JSON object."), 400
            name = body.get("sample", "")
            if not isinstance(name, str):
                return jsonify(error="Sample name must be text."), 400
            allowed = {
                x["file"] for x in json.loads((ROOT / "samples/index.json").read_text())
            }
            if name not in allowed:
                return jsonify(error="Choose a sample or upload an image."), 400
            im = Image.open(ROOT / "samples" / name)
            im.load()
        if im.width < 32 or im.height < 32:
            return jsonify(error="Image must be at least 32 × 32 pixels."), 400
        m = get_model()
        with lock:
            result, heat = m.predict(im)
        result.update(
            filename=name,
            category=m.meta["category"],
            score_is_probability=False,
            model=m.meta["model"],
        )
        return jsonify(
            result=result,
            original=encode(
                ImageOps.exif_transpose(im).convert("RGB").resize((384, 384))
            ),
            overlay=encode(m.overlay(im, heat, m.meta["threshold"]).resize((384, 384))),
            note="Heatmap is qualitative. This model is calibrated for top-down MVTec bottle images only.",
        )
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        return (
            jsonify(
                error="Unable to read image. Upload a valid PNG, JPG, or WebP under 10 MB and 20 megapixels."
            ),
            400,
        )


@app.errorhandler(413)
def too_large(e):
    return jsonify(error="Upload is too large. Maximum size is 10 MB."), 413


@app.get("/api/metrics")
def metrics():
    return send_from_directory(ROOT / "reports", "metrics.json")


if __name__ == "__main__":
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--port", type=int, default=7860)
    p.add_argument("--host", default="127.0.0.1")
    a = p.parse_args()
    get_model()
    app.run(host=a.host, port=a.port, debug=False)
