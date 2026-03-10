---
active: true
iteration: 1
max_iterations: 0
completion_promise: "All assigned GitHub issues have been implemented, tested, and committed."
started_at: "2026-03-10T23:20:36Z"
---

Use your subagents (like 'generalist') to work through and resolve the active GitHub issues for the dbcompass project. For each issue, follow this workflow: 1) Read the issue details, 2) Delegate the implementation and testing to the 'generalist' subagent, 3) Ensure comprehensive unit and Playwright tests are added/updated and pass in headless mode, 4) Commit the changes using a descriptive commit message that references the issue number (e.g. 'Fix #1: ...'), 5) Move on to the next issue. Repeat until all 9 recent issues are implemented and the test suite is green.
