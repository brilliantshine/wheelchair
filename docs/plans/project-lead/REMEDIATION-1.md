# Remediation 1 — project lead

Verification attempt 1 checked commit `6603a190`. Claude verifier: PASS. GPT verifier: FAIL.

## Gap list (verbatim, GPT verifier)

- GAP: S1 — A queued message can be consumed by the previous lead while Project leads is Off and its stop is pending — With the machine stop failing, the isolated viewer submitted the queued message to the previous lead and emptied the queue. Delivery checks session readiness without checking the setting (`viewer/app/sessions.js:533`, `viewer/app/sessions.js:975`).
- GAP: S1 — A lead whose stop is pending can still post allowed cards while Off — The machine callback calls `acceptCard`, whose project-lead check validates the card kind without checking the setting (`viewer/app/routes.js:523`, `viewer/app/cards.js:101`).
- GAP: S3/S4 — Refresh reports failure when the machine takes more than five seconds to reply — The isolated viewer returned `machine timeout` after 5,013 ms, and the machine fixture completed successfully at 5,500 ms. The hub uses the five-second default while the machine allows up to 60 seconds for the upstream fetch alone (`viewer/app/project-lead-actions.js:63`, `viewer/app/machine-client.js:73`, `machine/lib/project-lead.js:16`).
- GAP: S3 — Refresh retains the former upstream default ref after a default-branch rename — I renamed the isolated repository's default from `main` to `next` and deleted the old upstream branch. After refresh the lead clone still listed both `upstream/main` and `upstream/next` (`machine/lib/project-lead.js:23`).
- GAP: S4 — An unrelated thread's title can erase a valid same-project question — In the isolated viewer, a local question containing "Release notes" lost its text because an outside thread had that title. The waiting summary showed "Approval" (`viewer/app/project-lead-actions.js:20`, `viewer/app/project-lead-actions.js:30`, `viewer/app/views.js:151`).
- GAP: S4 — An outside thread's pull request URL can remain in a local reply when the URL is its only reference to that thread — The filter checks thread IDs, titles, paths, session names and peer-log text, leaving standalone pull request URLs outside its match set (`viewer/app/project-lead-actions.js:20`, `viewer/app/assistant-actions.js:51`).
- GAP: Threads mockups, phone and desktop — The pinned conversation titles render at regular weight and the Archived control is centered. The mockups show bold titles and left-aligned Archived — `threads-phone.png` and `threads-desktop.png` below.
- GAP: Project lead thread mockups, phone and desktop — The composer is visibly taller and adds a divider across the page above it — `thread-phone.png` and `thread-desktop.png` below.
- GAP: Pop-up mockups, both selections and sizes — The conversation links and Open thread control render underlined, and opening the project lead adds a bright focus outline around the composer. The agreed mockups show plain links and the neutral composer border — the four pop-up captures below.
- GAP: Settings mockups, phone and desktop — The Models and preferences heading and Project leads switch do not appear together at either agreed size. Reaching the switch scrolls past the heading, and the Threads card continues below Tool steps — `settings-phone.png` and `settings-desktop.png` below, `viewer/pages/settings.js:571` and `viewer/pages/settings.js:605`.

## Disposition

- Gaps 1, 2 and 4: rare paths, recorded in PLAN.md Accepted Risks (round verification-1).
- Gaps 7-10: deferred at the lead's answer as D4-D7 (source verification).
- Gaps 3, 5 and 6: fixed in task R1 below (one task: all three live in `viewer/app/project-lead-actions.js`). Built by GPT originally (T2, T9, T10), routed to GPT.

## Task R1


## Objective: verification-1 remediation (three gaps, one file)

The build passed one verifier and failed another. You fix these three gaps, verbatim from
the verifier:

- GAP: S3/S4 — Refresh reports failure when the machine takes more than five seconds to reply — The isolated viewer returned `machine timeout` after 5,013 ms, and the machine fixture completed successfully at 5,500 ms. The hub uses the five-second default while the machine allows up to 60 seconds for the upstream fetch alone (`viewer/app/project-lead-actions.js:63`, `viewer/app/machine-client.js:73`, `machine/lib/project-lead.js:16`).
- GAP: S4 — An unrelated thread's title can erase a valid same-project question — In the isolated viewer, a local question containing "Release notes" lost its text because an outside thread had that title. The waiting summary showed "Approval" (`viewer/app/project-lead-actions.js:20`, `viewer/app/project-lead-actions.js:30`, `viewer/app/views.js:151`).
- GAP: S4 — An outside thread's pull request URL can remain in a local reply when the URL is its only reference to that thread — The filter checks thread IDs, titles, paths, session names and peer-log text, leaving standalone pull request URLs outside its match set (`viewer/app/project-lead-actions.js:20`, `viewer/app/assistant-actions.js:51`).

Make exactly these changes:

1. **Refresh timeout.** `viewer/app/project-lead-actions.js:~63`: pass a timeout of 100000 ms
   as `hub.call`'s fifth argument (`hub.call(machine, suffix, method, body, timeout)`,
   `viewer/app/machine-client.js:73`). The machine's relay to the hub already waits 120 s
   (`machine/service.js:~2343`). Check that `viewer/app/wc.js` gives the `refresh` request at
   least 120 s before giving up; if it uses a shorter per-request timeout for
   `project-lead` actions, raise it for `refresh` only, and say in your report what you found.
2. **Titles out of the match set.** In the redaction set (`project-lead-actions.js:~20-27`),
   stop adding other threads' `title` and peer-log entries' `title`. Keep ids, project paths,
   session names and peer-log `text` and `session`. Remove the now-unneeded title clauses
   from the clean-up loop at `~:28` (keep the own-path clauses).
3. **PR URLs in the match set.** Add each outside thread's pull request URLs: `thread.pr_url`,
   `thread.target_pr` when it is a URL string, and the done card's URL via
   `require('./handoff.js').donePr(thread)` (see `viewer/app/threads.js:508-510`), skipping
   empty values.

Tests in `viewer/test/project-lead.test.js` (small separate `test(...)` blocks; break each fix
once, watch the test fail, restore):
- `refresh` succeeds when the fake machine answers `/v1/project-lead/refresh` after 6 s (add a
  delay switch to `viewer/test/helpers/app-machine.js`, as its `/v1/usage` reply already has
  `delay`); give the test its own timeout of at least 30 s.
- a same-project open `question` card whose text contains an outside thread's title (at least
  8 characters, e.g. "Release notes") keeps its text in `threads` `waiting` and in `thread`
  `cards`.
- a same-project chat item whose text contains only an outside thread's PR URL is left out of
  `thread` `recent`, while one with the project's own PR URL stays.
- Update any existing assertion that expected a title-only mention to be hidden (T9's
  "cross-thread messages and recent chat omit other project identifiers and titles"): it now
  expects ids, paths, session names and PR URLs hidden, and a title-only mention kept. Say in
  the report which assertions changed.

## Ownership boundary

`viewer/app/project-lead-actions.js`, `viewer/app/wc.js` (only for item 1, if needed),
`viewer/test/project-lead.test.js`, `viewer/test/helpers/app-machine.js`,
`docs/plans/project-lead/reports/R1.md`. Nothing else.

## Validation (one at a time; paste the output tails)

```bash
node --check viewer/app/project-lead-actions.js viewer/test/project-lead.test.js viewer/test/helpers/app-machine.js
node --test viewer/test/project-lead.test.js
node --test viewer/test/assistant.test.js
node --test viewer/test/*.test.js
```
Do not run `install/test/run.sh` (its live-state check fails while other sessions run here).
