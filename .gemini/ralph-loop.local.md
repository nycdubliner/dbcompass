---
active: true
iteration: 1
max_iterations: 0
completion_promise: "The app is robust, performant, and fully verified across mobile viewports."
started_at: "2026-03-10T23:01:41Z"
---

Refactor dbcompass into a modular, robust, and performant app. 1) Modularize logic (math, API, UI) into ES modules. 2) Implement Vitest for unit testing core utilities (distance/bearing). 3) Implement Playwright for E2E and Visual Regression testing to fix iPhone/Pixel layout mismatches—tests MUST ALWAYS run HEADLESS. 4) Replace brittle absolute positioning with a responsive CSS Grid/Flexbox layout using clamp() for scaling. 5) Update the GitHub Actions workflow to run the full test suite as a deployment gate.
