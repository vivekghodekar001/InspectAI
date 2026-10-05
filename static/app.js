"use strict";

const $ = (id) => document.getElementById(id);
const state = {
  ready: false,
  busy: false,
  selection: null,
  result: null,
  mode: "original",
  history: [],
  previewUrl: null,
  selectionVersion: 0,
};
const modes = [...document.querySelectorAll("[data-mode]")].filter(
  (el) => el.tagName === "BUTTON",
);
const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function message(text, error = false) {
  $("message").textContent = text;
  $("message").classList.toggle("error", error);
}

function connection(status, text) {
  $("connection").dataset.state = status;
  $("connection-text").textContent = text;
}

function updateControls() {
  $("run").disabled = !state.ready || !state.selection || state.busy;
  $("run-label").textContent = state.busy ? "Inspecting…" : "Run inspection";
  $("file").disabled = state.busy;
  $("dropzone").classList.toggle("busy", state.busy);
  document.querySelectorAll(".sample, .session-item").forEach((button) => {
    button.disabled = state.busy;
  });
  modes.forEach((button) => {
    button.disabled =
      state.busy || (button.dataset.mode !== "original" && !state.result);
  });
  $("expand").disabled = state.busy || !state.selection;
  $("processing").hidden = !state.busy;
  $("image-stage").setAttribute("aria-busy", String(state.busy));
}

function setMode(mode) {
  if (mode !== "original" && !state.result) return;
  state.mode = mode;
  $("image-stage").dataset.mode = mode;
  document.querySelector(".original-frame").hidden = mode === "overlay";
  document.querySelector(".overlay-frame").hidden = mode === "original";
  modes.forEach((button) =>
    button.setAttribute("aria-pressed", String(button.dataset.mode === mode)),
  );
}

function clearResult() {
  state.result = null;
  $("findings").hidden = true;
  $("empty-findings").hidden = false;
  $("result-state").textContent = "Not inspected";
  $("result-status").dataset.state = "idle";
  $("overlay").removeAttribute("src");
  setMode("original");
}

function select(selection) {
  if (state.busy) return;
  state.selectionVersion += 1;
  state.selection = selection;
  clearResult();
  $("selected").textContent = selection.name;
  $("viewer-title").textContent = selection.name;
  $("image-caption").textContent = selection.file
    ? "Uploaded image · not yet inspected"
    : "MVTec bottle test sample · not yet inspected";
  $("original").src = selection.preview;
  $("original").alt = `Selected image: ${selection.name}`;
  $("stage-empty").hidden = true;
  $("image-frames").hidden = false;
  document.querySelectorAll(".sample").forEach((button) => {
    const active = button.dataset.file === selection.sample;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  message(
    state.ready
      ? "Image selected. Run inspection to compare with normal features."
      : "Image selected. Waiting for the model.",
  );
  updateControls();
}

async function selectFile(file) {
  if (state.busy || !file) return;
  const version = ++state.selectionVersion;
  if (!allowedTypes.has(file.type)) {
    message("Choose a PNG, JPG, or WebP image.", true);
    return;
  }
  // Leave room for the multipart request headers within the backend's 10 MiB cap.
  if (file.size > 10 * 1024 * 1024 - 4096) {
    message(
      "This file is too large. Choose an image smaller than 10 MB.",
      true,
    );
    return;
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.width < 32 || image.height < 32)
      throw new Error("The image must be at least 32 × 32 pixels.");
    if (image.width * image.height > 20_000_000)
      throw new Error("Choose an image smaller than 20 megapixels.");
    // A second selection may have started an inspection while this image decoded.
    if (state.busy || version !== state.selectionVersion) {
      URL.revokeObjectURL(url);
      return;
    }
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = url;
    select({ name: file.name, file, sample: null, preview: url });
  } catch (error) {
    URL.revokeObjectURL(url);
    message(
      error instanceof DOMException
        ? "This image could not be opened. Try another file."
        : error.message,
      true,
    );
  }
}

function showResult(data) {
  state.result = data;
  const result = data.result;
  const anomaly = result.is_anomaly;
  $("original").src = data.original;
  $("overlay").src = data.overlay;
  $("overlay").alt = `Anomaly heatmap for ${result.filename}`;
  $("empty-findings").hidden = true;
  $("findings").hidden = false;
  $("result-state").textContent = "Inspection complete";
  $("result-status").dataset.state = anomaly ? "anomaly" : "normal";
  $("decision").textContent = anomaly
    ? "Review this image."
    : "Within normal range.";
  $("decision-note").textContent = anomaly
    ? "The score is above the decision threshold. Check the highlighted regions."
    : "The score is below the decision threshold. This does not guarantee the absence of defects.";
  $("score").textContent = result.score.toFixed(3);
  $("threshold").textContent = result.threshold.toFixed(3);
  $("latency").textContent = `${result.latency_ms.toFixed(1)} ms`;
  $("result-category").textContent = result.category || "Bottle";
  const maximum = Math.max(result.threshold * 2, result.score * 1.15, 0.001);
  $("score-fill").style.width =
    `${Math.min((result.score / maximum) * 100, 100)}%`;
  $("threshold-mark").style.left = `${(result.threshold / maximum) * 100}%`;
  $("meter-max").textContent = maximum.toFixed(1);
  $("score-meter").classList.toggle("normal", !anomaly);
  $("score-meter").setAttribute(
    "aria-label",
    `Anomaly score ${result.score.toFixed(3)}; decision threshold ${result.threshold.toFixed(3)}. ${anomaly ? "Above" : "Below"} threshold.`,
  );
  $("image-caption").textContent =
    "Original and qualitative heatmap · 192 px model input";
  setMode("compare");
  updateControls();
}

function remember(data) {
  state.history.unshift({
    data,
    selection: { ...state.selection, preview: data.original },
  });
  state.history = state.history.slice(0, 6);
  $("session-list").replaceChildren();
  $("session-strip").hidden = false;
  state.history.forEach((entry) => {
    const button = document.createElement("button");
    button.className = `session-item${entry.data.result.is_anomaly ? " anomaly" : ""}`;
    const name = document.createElement("strong");
    name.textContent = entry.selection.name;
    const detail = document.createElement("span");
    detail.textContent = `${entry.data.result.is_anomaly ? "Review" : "Normal range"} / ${entry.data.result.score.toFixed(3)}`;
    button.append(name, detail);
    button.addEventListener("click", () => {
      if (state.busy) return;
      select(entry.selection);
      showResult(entry.data);
      message("Showing a previous inspection from this session.");
    });
    $("session-list").append(button);
  });
}

async function inspect() {
  if (state.busy || !state.ready || !state.selection) return;
  state.busy = true;
  clearResult();
  $("result-state").textContent = "Inspecting";
  updateControls();
  message(
    "Extracting features and comparing them with the normal reference set.",
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    let options;
    if (state.selection.file) {
      const form = new FormData();
      form.append("image", state.selection.file);
      options = { method: "POST", body: form, signal: controller.signal };
    } else {
      options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample: state.selection.sample }),
        signal: controller.signal,
      };
    }
    const response = await fetch("/api/inspect", options);
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "The server returned an unreadable response. Try again or check the server terminal.",
      );
    }
    if (!response.ok)
      throw new Error(
        data.error || "Inspection could not be completed. Try again.",
      );
    if (
      !data.result ||
      !Number.isFinite(data.result.score) ||
      !Number.isFinite(data.result.threshold) ||
      !Number.isFinite(data.result.latency_ms) ||
      typeof data.result.is_anomaly !== "boolean" ||
      !data.original ||
      !data.overlay
    )
      throw new Error(
        "The inspection response was incomplete. Please try again.",
      );
    data.created_at = new Date().toISOString();
    showResult(data);
    remember(data);
    message("Inspection complete. Compare the images or download the report.");
  } catch (error) {
    clearResult();
    $("result-state").textContent = "Could not inspect";
    $("result-status").dataset.state = "anomaly";
    message(
      error.name === "AbortError"
        ? "Inspection timed out. Check that the server is running, then try again."
        : error.message,
      true,
    );
  } finally {
    clearTimeout(timer);
    state.busy = false;
    updateControls();
  }
}

function renderMetrics(model, metrics) {
  if (!metrics) {
    $("evaluation-content").hidden = true;
    $("evaluation-empty").hidden = false;
    return;
  }
  const matrix = metrics.confusion_matrix;
  $("auroc").textContent = Number.isFinite(metrics.image_auroc)
    ? metrics.image_auroc.toFixed(4)
    : "N/A";
  $("detected").textContent = `${matrix[1][1]} / ${metrics.defect_images}`;
  $("false").textContent = `${matrix[0][1]} / ${metrics.normal_images}`;
  $("count").textContent = metrics.test_images;
  $("recall-caption").textContent =
    `${(metrics.recall * 100).toFixed(1)}% recall at the calibrated threshold.`;
  [
    ["tn", 0, 0],
    ["fp", 0, 1],
    ["fn", 1, 0],
    ["tp", 1, 1],
  ].forEach(([id, row, col]) => {
    $(id).textContent = matrix[row][col];
  });
  $("train-count").textContent = `${model.train_images} normal images`;
  $("calibration-count").textContent =
    `${model.calibration_images} normal images`;
  $("median-latency").textContent =
    `${metrics.median_inference_ms.toFixed(1)} ms`;
  $("benchmark-note").textContent =
    `The threshold was chosen using normal calibration images, before evaluating the ${metrics.test_images} test images. Inference timing excludes model loading and HTTP transport; it varies by machine.`;
}

async function load() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch("/api/status", { signal: controller.signal });
    if (!response.ok)
      throw new Error(
        "The model could not be loaded. Check the server terminal and restart the app.",
      );
    const data = await response.json();
    if (!data.model || !Array.isArray(data.samples))
      throw new Error(
        "The server status was incomplete. Refresh the page to try again.",
      );
    data.samples.forEach((sample, index) => {
      const button = document.createElement("button");
      button.className = "sample";
      button.dataset.file = sample.file;
      button.setAttribute("aria-label", `Select ${sample.label} sample`);
      button.setAttribute("aria-pressed", "false");
      const image = document.createElement("img");
      image.src = `/samples/${encodeURIComponent(sample.file)}`;
      image.alt = "";
      const copy = document.createElement("span");
      copy.className = "sample-copy";
      const name = document.createElement("span");
      name.className = "sample-name";
      name.textContent = sample.label;
      const caption = document.createElement("span");
      caption.className = "sample-caption";
      caption.textContent = `TEST SAMPLE / ${String(index + 1).padStart(2, "0")}`;
      copy.append(name, caption);
      const marker = document.createElement("span");
      marker.className = "sample-marker";
      marker.setAttribute("aria-hidden", "true");
      button.append(image, copy, marker);
      button.addEventListener("click", () =>
        select({
          sample: sample.file,
          file: null,
          name: sample.file,
          preview: image.src,
        }),
      );
      $("samples").append(button);
    });
    state.ready = true;
    connection("ready", "Model ready");
    try {
      renderMetrics(data.model, data.metrics);
    } catch {
      $("evaluation-content").hidden = true;
      $("evaluation-empty").hidden = false;
    }
    if (!state.selection && data.samples.length) {
      const first = data.samples[0];
      select({
        sample: first.file,
        file: null,
        name: first.file,
        preview: `/samples/${encodeURIComponent(first.file)}`,
      });
    }
    updateControls();
  } catch (error) {
    connection("error", "Unavailable");
    message(
      error.name === "AbortError"
        ? "The model is taking too long to respond. Check the server and refresh this page."
        : error.message,
      true,
    );
    $("evaluation-content").hidden = true;
    $("evaluation-empty").hidden = false;
    updateControls();
  } finally {
    clearTimeout(timer);
  }
}

$("file").addEventListener("change", (event) => {
  selectFile(event.target.files[0]);
  event.target.value = "";
});
["dragenter", "dragover"].forEach((type) =>
  $("dropzone").addEventListener(type, (event) => {
    event.preventDefault();
    if (!state.busy) $("dropzone").classList.add("drag");
  }),
);
["dragleave", "drop"].forEach((type) =>
  $("dropzone").addEventListener(type, (event) => {
    event.preventDefault();
    $("dropzone").classList.remove("drag");
  }),
);
$("dropzone").addEventListener("drop", (event) =>
  selectFile(event.dataTransfer.files[0]),
);
$("run").addEventListener("click", inspect);
modes.forEach((button) =>
  button.addEventListener("click", () => setMode(button.dataset.mode)),
);

document.querySelectorAll("[data-page]").forEach((button) =>
  button.addEventListener("click", () => {
    const page = button.dataset.page;
    document.querySelectorAll(".page").forEach((section) => {
      section.hidden = section.id !== `page-${page}`;
    });
    document.querySelectorAll(".nav-item").forEach((item) => {
      const active = item.dataset.page === page;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    const heading = document.querySelector(`#page-${page} h1`);
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "auto" });
  }),
);

$("expand").addEventListener("click", () => {
  const overlay = state.mode !== "original" && state.result;
  $("dialog-image").src = overlay ? $("overlay").src : $("original").src;
  $("dialog-image").alt = overlay
    ? "Enlarged anomaly heatmap"
    : "Enlarged original image";
  $("dialog-title").textContent = overlay
    ? "Heatmap detail"
    : "Original image detail";
  $("image-dialog").showModal();
});
$("close-dialog").addEventListener("click", () => $("image-dialog").close());
$("image-dialog").addEventListener("click", (event) => {
  if (event.target !== $("image-dialog")) return;
  const bounds = $("image-dialog").getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    $("image-dialog").close();
});
$("download").addEventListener("click", () => {
  if (!state.result || state.busy) return;
  const { result, note, created_at } = state.result;
  const blob = new Blob(
    [JSON.stringify({ ...result, note, created_at }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "inspectai-inspection.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
load();
