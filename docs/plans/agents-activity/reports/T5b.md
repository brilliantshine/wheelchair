# T5b report

- `viewer/pages/agents.js`: corrected phone connector geometry, redraws and invalid hops; expanded the map viewBox, moved the memory title to the ring group, and handled missing labels and hour-long elapsed times.
- `viewer/test/app-views.spec.js`: covered the requested activity, ring, path, wording, timing and phone cases; the mock can capture the requested screenshots with `AGENTS_SHOTS`.
- `docs/plans/agents-activity/reports/T5b.md`: this report.

I looked at `desktop.png` and `phone.png` in the requested scratchpad folder. I checked the activity map, Web label/count/timer and caption, 75% amber ring, and desktop question route; the selected worker panel fills the phone screen, so its tree is hidden by the existing phone layout.

## Validation

First run, `AGENTS_SHOTS=<requested screenshot folder> npm --prefix viewer run test:browser`:

```text
  2 failed
    [chromium] › test/app-views.spec.js:175:5 › phone › activity, memory and question paths render from the agents API
    [firefox] › test/app-views.spec.js:175:5 › phone › activity, memory and question paths render from the agents API
  8 skipped
  670 passed (3.7m)
```

The new phone assertion compared the worker connector with the wrong branch's border. Corrected the assertion before the second run.

Second run, `AGENTS_SHOTS=<requested screenshot folder> npm --prefix viewer run test:browser`:

```text
  1 failed
    [firefox] › test/app-views.spec.js:175:5 › phone › activity, memory and question paths render from the agents API
  8 skipped
  671 passed (4.1m)
```

The remaining failure is the phone connector alignment assertion in Firefox (`Expected: true; Received: false`). Chromium passed the same check. The cause remains unverified: it could be the rendered geometry or the measurement/timing of the assertion. I stopped iterating because the same browser validation gate failed twice, as required by the brief.

## Choices

- `viewer/pages/agents.js`: kept an SVG overlay and followed the existing phone border geometry; invalid hops do not add a legend.
- `viewer/pages/agents.js`: extended the map viewBox to 275 units high, retaining the spot positions.
- `viewer/test/app-views.spec.js`: screenshot capture is enabled by `AGENTS_SHOTS` during the browser suite.
