# Map: remaining owner-name comments and test data

Checked against: `1ee9ad1487d2a3f8b6ceda7f73cf7218657f52c2` (origin/main); line evidence is worktree HEAD `93da28f48e626a19d46cc8c24f0a788c4af7372d`. Differences in covered files are `viewer/app/chat.js` and three test files; the cited owner-name occurrences are unchanged.
Files covered: runtime files in `viewer/`, `machine/`, `test-support/`; `viewer/test/`, `machine/test/fixtures/`, `test-support/smoke/`.

```text
runtime comments -> describe user interactions
hand-written tests -> exercise state identifiers and UI -> assertions
captured transcripts -> parser fixtures -> tests
```

Runtime comments name the owner at `viewer/app/sessions.js:476`, `viewer/app/sessions.js:536`, `viewer/app/chat.js:148`, `viewer/app/threads.js:326`, `viewer/app/threads.js:402`, `viewer/app/threads.js:425`, `viewer/pages/thread.js:433`, `viewer/pages/thread.js:495`, `viewer/pages/thread.js:593`, `viewer/pages/thread.js:607`, `viewer/pages/thread.js:797`, and `test-support/smoke/live.js:44`. The smoke comment records a prior decision, not an identifier. Runtime identifiers and API documentation are mapped in `docs/maps/owner-name-state.md`.

Hand-written tests exercise timestamp ordering (`viewer/test/app-threads.spec.js:108`, `viewer/test/app-hub.test.js:380`), queues and send-now (`viewer/test/app-threads.spec.js:356`, `viewer/test/app-send-now.spec.js:19`, `viewer/test/app-asides.test.js:176`), card attribution (`viewer/test/app-hub.test.js:1788`, `viewer/test/app-merged.spec.js:41`), restart relabeling and preservation (`viewer/test/app-handoff-restart.test.js:79`, `viewer/test/app-handoff-restart.test.js:95`), and handoff export and display (`viewer/test/app-handoff.test.js:40`, `viewer/test/app-handoff.spec.js:58`). Other authored sample text or names appear in `viewer/test/helpers/app-views-setup.js:53`, `viewer/test/app-hub.test.js:261`, `viewer/test/app-chat.test.js:81`, `viewer/test/app-chat.test.js:145`, and `viewer/test/app-check-card.spec.js:130`. `viewer/test/browser.spec.js:2411` matches the substring in “non-collinearity”, not the owner name.

Captured data differs from authored assertions: `machine/AGENTS.md:32` identifies `machine/test/fixtures/agy/` as live captures; names occur in `stop.json:2`, `stop-second.json:2`, `stop-role.json:2`, `stop-tools.json:2` and `permission-after.txt:17` under that directory. Codex rollout captures contain paths and command output at `machine/test/fixtures/codex-steps/instant.jsonl:1` and `machine/test/fixtures/codex-steps/wait.jsonl:3`; changing them alters recorded material. Inspect their consumers before choosing whether to sanitize captures or retain them.

Not checked: protocol prose (outside this inventory), runtime semantics beyond the cited comments and state map, fixture provenance beyond the cited router and transcript contents, and generated or external files.
