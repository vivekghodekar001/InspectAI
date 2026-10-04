from pathlib import Path
import hashlib, urllib.request

root = Path(__file__).resolve().parents[1] / "models"
root.mkdir(exist_ok=True)
p = root / "resnet18-f37072fd.pth"
if not p.exists():
    tmp = p.with_suffix(".download")
    urllib.request.urlretrieve(
        "https://download.pytorch.org/models/resnet18-f37072fd.pth", tmp
    )
    if not hashlib.sha256(tmp.read_bytes()).hexdigest().startswith("f37072fd"):
        tmp.unlink()
        raise RuntimeError("Model checksum mismatch")
    tmp.replace(p)
print("Backbone ready:", p)
