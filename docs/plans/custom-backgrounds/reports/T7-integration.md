# T7 independent integration

Self/tricky review covered all239 code lines and the report. Tests exercise actual HTTP responses and native decoded Image completion with deterministic gates. No product code changes. Corrected the network fixture PNG IDAT CRC and changed editor screenshots from a shared global directory to testInfo.outputPath.

Validation uses the private writable config/cache/runtime/tmp environment documented in T7.md and `npm --prefix viewer run test:browser -- background-editor.spec.js background-network.spec.js --output=/tmp/backgrounds-resume-T7-tjKiXB/results`. Exact log: /tmp/backgrounds-resume-T7-tjKiXB/output.log.

```text
Running 40 tests using 2 workers
40 passed (58.7s)
exit 0
```

Screenshots: /tmp/backgrounds-resume-T7-tjKiXB/results/background-editor-represen-d1a88-re-appearance-after-removal-chromium/settings-1280.png and corresponding settings-390.png; exact discovered paths are recorded with final validation evidence.

## Choices
Per-test Playwright screenshot paths prevent collisions. Invalid PNG fixture corrected without changing product validation.
