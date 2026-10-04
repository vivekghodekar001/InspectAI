import io, json, unittest
from pathlib import Path
from PIL import Image
import app

ROOT = Path(__file__).resolve().parents[1]


class InspectionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.app.test_client()

    def test_dashboard_and_status(self):
        self.assertEqual(self.client.get("/").status_code, 200)
        d = self.client.get("/api/status").get_json()
        self.assertGreater(d["model"]["train_images"], 0)
        self.assertEqual(d["metrics"]["test_images"], 83)

    def test_sample_inference_has_real_images(self):
        item = json.loads((ROOT / "samples/index.json").read_text())[0]
        r = self.client.post("/api/inspect", json={"sample": item["file"]})
        self.assertEqual(r.status_code, 200)
        d = r.get_json()
        self.assertGreater(d["result"]["score"], 0)
        self.assertTrue(d["overlay"].startswith("data:image/png;base64,"))
        self.assertNotEqual(d["original"], d["overlay"])
        self.assertFalse(d["result"]["score_is_probability"])

    def test_uploaded_image_matches_sample(self):
        item = json.loads((ROOT / "samples/index.json").read_text())[0]
        a = self.client.post("/api/inspect", json={"sample": item["file"]}).get_json()[
            "result"
        ]["score"]
        with (ROOT / "samples" / item["file"]).open("rb") as f:
            r = self.client.post(
                "/api/inspect", data={"image": (io.BytesIO(f.read()), "uploaded.png")}
            )
        self.assertEqual(r.status_code, 200)
        self.assertAlmostEqual(a, r.get_json()["result"]["score"], places=5)

    def test_invalid_inputs(self):
        self.assertEqual(
            self.client.post(
                "/api/inspect", json={"sample": "../../app.py"}
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.post(
                "/api/inspect", data={"image": (io.BytesIO(b"not an image"), "bad.png")}
            ).status_code,
            400,
        )
        b = io.BytesIO()
        Image.new("RGB", (5, 5)).save(b, "PNG")
        b.seek(0)
        self.assertEqual(
            self.client.post(
                "/api/inspect", data={"image": (b, "tiny.png")}
            ).status_code,
            400,
        )

    def test_upload_limit(self):
        self.assertEqual(
            self.client.post(
                "/api/inspect",
                data=b"x" * (10 * 1024 * 1024 + 1),
                content_type="application/octet-stream",
            ).status_code,
            413,
        )

    def test_no_train_calibration_overlap(self):
        m = json.loads((ROOT / "models/metadata.json").read_text())
        self.assertFalse(set(m["train_files"]) & set(m["calibration_files"]))
        self.assertEqual(len(m["train_files"]) + len(m["calibration_files"]), 209)


if __name__ == "__main__":
    unittest.main()
