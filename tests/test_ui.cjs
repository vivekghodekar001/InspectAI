const { JSDOM } = require("jsdom");
const fs = require("fs");
const assert = require("node:assert/strict");
const root = require("path").resolve(__dirname, "..");
const fixture = JSON.parse(
  fs.readFileSync(require("path").join(__dirname, ".ui-fixtures.json")),
);
const html = fs.readFileSync(root + "/templates/index.html", "utf8");
const js = fs.readFileSync(root + "/static/app.js", "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
function create(statusFailure = false) {
  const dom = new JSDOM(html, {
    url: "http://localhost:7861",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  const context = { dom, w, mode: "ok", calls: 0, downloads: 0 };
  w.scrollTo = () => {};
  w.URL.createObjectURL = () => "blob:fixture";
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {
    context.downloads++;
  };
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  w.fetch = async (url, options) => {
    if (url === "/api/status")
      return { ok: !statusFailure, json: async () => fixture.status };
    assert.equal(url, "/api/inspect");
    context.calls++;
    await tick();
    if (context.mode === "error")
      return {
        ok: false,
        json: async () => ({ error: "Test server failure" }),
      };
    if (context.mode === "malformed")
      return { ok: true, json: async () => ({}) };
    return {
      ok: true,
      json: async () =>
        JSON.parse(
          JSON.stringify(fixture.results[JSON.parse(options.body).sample]),
        ),
    };
  };
  w.eval(js);
  return context;
}
(async () => {
  const t = create();
  const w = t.w;
  const $ = (id) => w.document.getElementById(id);
  await tick();
  assert.equal(w.document.querySelectorAll(".sample").length, 4);
  assert.equal($("selected").textContent, "normal.png");
  assert.equal($("run").disabled, false);
  assert.equal($("findings").hidden, true);
  assert.equal($("count").textContent, "83");
  assert.equal(
    w.document.querySelector('[data-mode="compare"]').disabled,
    true,
  );
  $("run").click();
  assert.equal($("run").disabled, true);
  assert.equal($("file").disabled, true);
  assert.equal($("processing").hidden, false);
  await tick();
  await tick();
  assert.equal($("decision").textContent, "Within normal range.");
  assert.equal($("findings").hidden, false);
  assert.equal($("image-stage").dataset.mode, "compare");
  assert.equal($("run").disabled, false);
  w.document.querySelector('[data-mode="overlay"]').click();
  assert.equal(w.document.querySelector(".original-frame").hidden, true);
  $("expand").click();
  assert.equal($("image-dialog").open, true);
  $("close-dialog").click();
  assert.equal($("image-dialog").open, false);
  $("download").click();
  assert.equal(t.downloads, 1);
  w.document.querySelector('[data-file="broken-large.png"]').click();
  assert.equal($("findings").hidden, true);
  assert.equal($("image-stage").dataset.mode, "original");
  $("download").click();
  assert.equal(t.downloads, 1); // stale report cannot be downloaded
  $("run").click();
  await tick();
  await tick();
  assert.equal($("decision").textContent, "Review this image.");
  assert.equal(w.document.querySelectorAll(".session-item").length, 2);
  w.document.querySelectorAll(".session-item")[1].click();
  assert.equal($("decision").textContent, "Within normal range.");
  for (const page of ["evaluation", "method", "inspect"]) {
    w.document.querySelector(`.nav-item[data-page="${page}"]`).click();
    assert.equal($(`page-${page}`).hidden, false);
    assert.equal(w.document.querySelectorAll(".page:not([hidden])").length, 1);
  }
  t.mode = "error";
  $("run").click();
  await tick();
  await tick();
  assert.equal($("findings").hidden, true);
  assert.equal($("message").textContent, "Test server failure");
  assert.equal($("run").disabled, false);
  t.mode = "malformed";
  $("run").click();
  await tick();
  await tick();
  assert.match($("message").textContent, /incomplete/);
  t.mode = "ok";
  for (let i = 0; i < 7; i++) {
    $("run").click();
    await tick();
    await tick();
  }
  assert.equal(w.document.querySelectorAll(".session-item").length, 6);
  Object.defineProperty($("file"), "files", {
    configurable: true,
    value: [new w.File(["bad"], "bad.txt", { type: "text/plain" })],
  });
  $("file").dispatchEvent(new w.Event("change"));
  await tick();
  assert.match($("message").textContent, /PNG/);
  Object.defineProperty($("file"), "files", {
    configurable: true,
    value: [
      new w.File([new Uint8Array(10485760)], "huge.png", { type: "image/png" }),
    ],
  });
  $("file").dispatchEvent(new w.Event("change"));
  await tick();
  assert.match($("message").textContent, /too large/);
  const ids = [...w.document.querySelectorAll("[id]")].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  t.dom.window.close();
  const failure = create(true);
  await tick();
  assert.equal(failure.w.document.getElementById("run").disabled, true);
  assert.equal(
    failure.w.document.getElementById("connection-text").textContent,
    "Unavailable",
  );
  failure.dom.window.close();
  console.log(
    "PASS: normal/defect inference; original/compare/heatmap; modal; report export; stale-result reset; busy-state lock; history capped at six; all navigation; error/malformed recovery; unsupported/oversized upload; unavailable model; unique IDs. Real model-response fixtures, DOM execution (not visual browser rendering).",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
