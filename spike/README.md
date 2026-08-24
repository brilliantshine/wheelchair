# spike/ — throwaway

Answers one question: is *answering* with a diagram worth building properly, or is being shown an
accurate one most of the value? Built 2026-08-22. Verdict: yes, worth building — the direction is
right and the wanted changes are recorded in `docs/plans/editable-node-graphs/`.

Not the plan. No auth, no locking, no concurrency story, whole-file writes, one graph at a time.
Do not grow this into the real thing; `docs/plans/editable-node-graphs/PLAN.md` is that.

```bash
node spike/serve.js [path/to/graph.json]   # default: spike/graph.json
# then open http://127.0.0.1:7373/
```

drag move · dblclick canvas add · dblclick node rename · click select · shift+click a second node
links them · `a` agree · `r` reject · wheel zoom. Saves on release.

What it already taught us, all of it from looking at the real thing rather than reasoning:

- An `<svg>` with `height: auto` falls back to a 150px intrinsic size and silently clips
  everything below it. The markup was perfect; a DOM test passed.
- Trimming an edge at a fixed radius from a node's centre buries the arrowhead under the box.
- An edge label centred on its line lands inside whichever box the gap is too narrow for.
- `setPointerCapture` on the `<svg>` retargets the following `click` away from the node, so
  selection must happen on `pointerup`.
- Node labels must be plain behaviour. A router's own phrasing is a compression for someone
  already inside that module, and it reads as noise to the person the diagram is for.
