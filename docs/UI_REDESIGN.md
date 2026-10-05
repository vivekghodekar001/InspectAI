# Inspection workspace redesign

The interface is organized around selecting an image, comparing it with the normal reference, and reviewing the finding. It uses a warm neutral background, a restrained rust accent, a large inspection canvas, and a dark findings panel. The desktop layout keeps source, image, and finding visible together; tablet and mobile layouts stack the panels.

## Changes

- New application header with separate Inspection, Evaluation, and Model notes views.
- Original, Compare, and Heatmap controls; accessible image enlargement dialog.
- Immediate image previews, file-format/size/dimension checks, and drag-and-drop.
- Score meter with the actual calibrated threshold and an explicit distance label.
- Session history for the last six inspections, held in memory and cleared on reload.
- Stale findings and export data are cleared when another image is selected or inference fails.
- Model-loading and request-timeout messages; inputs locked during inference.
- Real evaluation counts and confusion matrix, kept separate from inspection controls.
- Keyboard focus styles, native buttons and dialog, status announcements, reduced-motion support, responsive layouts, and no external font/CDN dependency.

The backend, fitted model, threshold, and benchmark results are unchanged. No result shown by the live interface is fabricated. The standalone offline preview uses explicitly labeled recorded sample responses and does not accept uploads.

## Validation

All six existing Python API/protocol tests passed on the redesign checkout. Four real sample responses were generated from the fitted model. DOM tests passed for normal/defect results, three viewing modes, dialog controls, export, stale-result reset, busy-state locking, six-item history, navigation, error recovery, invalid uploads, and unavailable-model handling. JavaScript syntax and Git whitespace checks passed.

A rendered browser check remains outstanding: local browser automation could not launch in this execution environment. Responsive CSS and accessibility interactions were implemented, but this is not a claim of visual-browser or full accessibility certification.

## Run the optional UI regression suite

These tests require Node.js 22 or newer in addition to the existing Python environment. Node is **not needed to run the application**.

```powershell
.\.venv\Scripts\python.exe tests/build_ui_fixtures.py
npm install --prefix tests
npm test --prefix tests
```

The generated fixture is based on real model responses and is ignored by Git. The DOM tests exercise the interface without a browser rendering engine.

## Requested design plugins

The requested `ui-ux-pro-max`, `taste-skill`, and `impeccable` plugins were not available in the installed skill catalog or plugin discovery during this task. This redesign was implemented directly; no use of those plugins is claimed.
