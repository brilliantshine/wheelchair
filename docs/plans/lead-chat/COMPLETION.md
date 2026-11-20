---
slug: lead-chat
date: 2026-11-19
implemented-by: "standard (gpt-6.1-terra: T1, T2, T3; claude-sonnet-5-5: T4, T5); integration fixes by the sub-lead (claude-opus-5-5)"
verified-by: []
---

# Completion Report — Leads that know about each other

Written for a hostile reviewer: every claim checkable, no claim without evidence.

## Spec coverage

| Spec item | Origin | Implemented at (file:line) | Validated by |
|-----------|--------|----------------------------|--------------|
| Terms: same machine via `resolveMachine` | this run | viewer/app/peers.js:6 | viewer/test/app-lead-list.test.js (hub vs hostname) |
| Terms: reachable (not archived, not frozen) | this run | viewer/app/peers.js:11 | app-lead-list.test.js; app-lead-messages.test.js |
| Terms: linked (either side's `lead_links`) | this run | viewer/app/peers.js:12 | app-lead-list.test.js; app-lead-messages.test.js (link on either side) |
| Terms: latest live lead | this run | viewer/app/peers.js:13 | app-lead-messages.test.js (restart routes to latest lead) |
| §1 `wc.js session leads [--all-projects]` sends `{action:'leads', all_projects}` | this run | viewer/app/wc.js:72-75 | viewer/test/wc-cli.test.js |
| §1 lead-only, 403 `only a lead may list other leads` | this run | viewer/app/sessions.js:654-655 | app-lead-list.test.js |
| §1 entries (thread, lead/null, project, linked, title, stage, idea, progress, branch, pr_url), peers + linked, most recent first, own/archived/frozen/other-machine excluded | this run | viewer/app/peers.js:29-52 (`progressLabel`, `listLeads`) | app-lead-list.test.js |
| §1 `--all-projects`: other-project threads with five fields; linked once with full entry | this run | viewer/app/peers.js:40-52 | app-lead-list.test.js |
| §2 cross-thread `message` only from a lead; non-lead keeps 404 | this run | viewer/app/cards.js:143-146 | app-lead-messages.test.js (workers cannot cross threads) |
| §2 six refusals in order, nothing stored | this run | viewer/app/cards.js:146-153 | app-lead-messages.test.js (refusals ordered, store nothing) |
| §2 locking: sender lock, then target lock; deliver after `updateThread` returns | this run | viewer/app/hub.js:200-214 | app-lead-messages.test.js (simultaneous legacy leads, no deadlock) |
| §2 queued text with `[thread <id>: <title>]` and `[question <id>]` to latest live lead | this run | viewer/app/hub.js:208 | app-lead-messages.test.js |
| §2 `passes_on` only own-thread | pre-existing check, unchanged | viewer/app/cards.js:69 | app-lead-messages.test.js (passes_on outside refused) |
| §2 Agents screen ignores cross-thread asks | this run | viewer/app/agents.js:45 | app-lead-messages.test.js |
| §2 receiving turn hidden (no chat change) | pre-existing | viewer/app/chat.js:127 | app-lead-messages.test.js (transcriptItems hides it) |
| §3 `reach` kind: lead-only, `thread` + `why` | this run | viewer/app/card.js:15, 32, 103 | viewer/test/app-reach.test.js |
| §3 post-time refusals (8) incl. one open per thread; stores target_title, target_project, title | this run | viewer/app/cards.js:133-141; viewer/app/peers.js:15-27 | app-reach.test.js |
| §3 Allow / Don't allow press, allow failed, already linked, writes only pressed thread, 409 no live lead, second press 422 | this run | viewer/app/threads.js:326-348 | app-reach.test.js |
| §3 retractable; refusal text | this run | viewer/app/card.js:244-245 | app-reach.test.js; viewer/test/app-hub.test.js:2076 |
| §3 Needs you | this run | viewer/app/views.js:141 | app-reach.test.js |
| §3 handoff export kinds, history line, quiet reason | this run | viewer/app/handoff.js:5, 38, 99 | app-reach.test.js |
| §3 shown on the thread page with Allow / Don't allow and answered state | this run | viewer/pages/thread.js:547, 582-586, 717-735, 1008 | viewer/test/app-reach.spec.js (Chromium, Firefox) |
| §4 lead.md "Other leads on this machine" (no plan reference) | this run | protocol/app/lead.md:706-717 | viewer/test/protocol-rules.test.js |
| §4 cards.md: message, `[thread ...]` marker, passes_on, reach thread-id rule, kinds table, commands, press forms | this run | protocol/app/cards.md:26, 51, 104, 144, 167, 184 | protocol-rules.test.js (sections) and review |
| §4 cards-lead.md `reach` section, retract kinds/text | this run | protocol/app/cards-lead.md:273-290, 311 | protocol-rules.test.js |
| Validation: protocol-rules lead kinds include `reach` | this run | viewer/test/protocol-rules.test.js:34 | itself |

## Deviations from plan

- §3 display: the Spec's heading bolds the target title; the whole heading is an `h3` with the title in `<strong>`, so in the current theme the title does not stand out from the rest of the heading. Buttons are the plain action buttons rather than the full-width question options (T4 choice, logged).
- Progress label for `session leads` is a copy of the page's private formatter (viewer/app/peers.js:29), not a shared import; wording matches `cards.md` today.

## Routers

viewer/AGENTS.md: `app/peers.js` added to the file table (peer-thread rules and the lead listing). No other ownership moved.

## Validation evidence

`node --test viewer/test/*.test.js; echo "exit $?"` (integrated tip):
```
# tests 710
# pass 710
# fail 0
exit 0
```

`npm --prefix viewer run test:browser; echo "exit $?"`:
```

  34 skipped
  1046 passed (10.9m)
exit 0
```

`bash machine/test/run.sh; echo "exit $?"`, first run:
```
not ok 129 - project tools launch privately and stale Antigravity files are swept
# tests 373
# pass 372
# fail 1
exit 1
```
(`project tools launch privately...` failed with `tmux buffer failed` from the fake tmux; no file under `machine/` changed in this build.) Second run:
```
# tests 373
# pass 373
# fail 0
exit 0
```

## Known gaps / residual risks

- Test depth (scout notes): `--all-projects` filters are not exercised on other-project archived/frozen/other-machine threads; only one progress-label branch is tested; already-linked and Don't allow queue text asserted by regex; Allow failures other than archived are not tested.
- `viewer/pages/aside.js` "waiting on" list does not include `reach` (not required by the Spec; Needs you does).
- The failed-Allow answered tag uses the check icon in the `resolved` style.
- `machine/test/project-tools-service.test.js` flaked once (tmux buffer) and passed on rerun.

## Remediation rounds

### Remediation 1 (after verification attempt 1, b341883a)

Gaps (GPT verifier; Claude verifier passed): reach history line did not name the target thread; `reach.why` accepted several lines; the chat-view hiding test used the transcript parser instead of the thread's chat view. Fixed in task R1 (standard / gpt-6.1-terra), see REMEDIATION-1.md:

- viewer/app/handoff.js:38 — history starts `Talk to <target_title> (<project>)`; validated by viewer/test/app-reach.test.js (exact history text).
- viewer/app/card.js:50, 104 — `line` validator for `reach.why` only; validated by app-reach.test.js (\n and \r refused, one line accepted).
- viewer/test/app-lead-messages.test.js:55-71 — goes through `hub.chat` on the receiving thread: the ordinary turn shows, the delivered message and the reply do not.

`node --test viewer/test/*.test.js; echo "exit $?"` after the merge:
```
# tests 711
# pass 711
# fail 0
exit 0
```

### Remediation 2 (after verification attempt 2, 5728cab9)

Gap (GPT verifier; Claude verifier passed): a thread with no stored title showed a blank or `undefined` name in `session leads`, the Allow card, Needs you and the `[thread ...]` marker. Fixed in task R2 (light / gpt-6-luna), see REMEDIATION-2.md:

- viewer/app/peers.js:14 — `threadName`: title, else plan slug, else project folder, else thread id (the pages' order, viewer/pages/threads.js:39). Used at peers.js:50 (listing), viewer/app/cards.js:140-141 (`target_title`, stored title), cards.js:190 (sender marker).
- Tests: app-lead-list.test.js (slug fallback), app-reach.test.js (project-folder fallback, no `undefined`), app-lead-messages.test.js (marker uses the fallback).

`node --test viewer/test/*.test.js; echo "exit $?"` after the merge:
```
# tests 711
# pass 711
# fail 0
exit 0
```
