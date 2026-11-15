---
slug: app-diagrams-uploads
status: planning   # planning | ready-for-review | approved | implementing | verifying | done
created: 2026-11-15
adopted-from: docs/proposals/app-diagrams-uploads/proposal.md
---

# More diagram forms and file uploads in app threads

**Idea:** `IDEA.md` — what this is for and why, in plain language. Read it first; it is
the north star this plan serves. Goal and Constraints live there, not here, so they don't
get buried as this file grows. **Map:** `MAP.md`.

## Open Questions

### Q1: What happens to images the lead showed once the thread is archived?
- **Context:** A shown image lives on the lead's machine (D3). Archiving deletes the
  thread's uploads (D28, IDEA). Diagrams survive archive because they are committed to the
  branch; images are not.
- **Options:** (a) they go with the uploads: an archived thread shows "image removed";
  (b) shown images are kept after archive, only Collin's uploads are deleted;
  (c) shown images are committed to the branch beside the graphs, so they reach the pull request.
- **Recommendation:** (a). Archive means done, a screenshot is rarely needed after, and it
  keeps one cleanup rule.

## Watch List

| # | Noticed | What needs looking into | Raised to user? | Outcome |
|---|---------|-------------------------|-----------------|---------|

## Decision Log

| # | Decision | Rationale | Source |
|---|----------|-----------|--------|
| D1 | The new forms reuse the `diagram` card (`plan`, `graph`, `title`). The graph file under `docs/plans/<plan>/graphs/` says its form: a JSON file with a `form` field (`timeline`, `before-after`, `layers`, `side-by-side`; absent means boxes and arrows), or an `.html` file for the hand-written fallback. | Keeps one card kind, and diagrams stay committed, so archived threads still show them the way graphs do today (MAP: archive route reads the branch) | defaulted |
| D2 | The thread page draws the four JSON forms itself, in the card, as plain HTML and CSS that stacks to one column at phone width. Boxes and arrows keep the existing graph-page iframe. The `.html` fallback loads in `<iframe sandbox="allow-scripts">` from a route that sends `Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:`. | D19/D29: formats are design work. Drawing them in the page avoids a second iframe per card; the CSP is what forbids network access | defaulted |
| D3 | The lead shows an image with a new `image` card (`path`, `title`). `card.js` copies the file into `~/.local/state/wheelchair/uploads/<thread-id>/` on the lead's machine and the card carries that stored name; the hub fetches it from the thread's machine when the page asks. Only the lead posts it; screenshots from other sessions reach Collin through the lead. PNG, JPEG, GIF, WebP; 25 MB. | Shown cards are lead-only (cards.md). Copying keeps the image after the agent's temp file is gone, and puts it under the same cleanup as uploads | defaulted |
| D4 | Uploads: the page sends each file raw to the hub, which streams it to the thread's machine; the machine refuses anything over 25 MB, stores it as `uploads/<thread-id>/<n>-<sanitized filename>` (a counter prefix avoids collisions) and returns the absolute path. The message the lead receives gets one line per file: `[attached: <path>]`. The page refuses a file over 25 MB before sending. | D20/D28; a counter is simpler than asking about overwrites | defaulted |
| D5 | Archive deletes `uploads/<thread-id>/` in the same machine archive call that stops sessions and removes worktrees (`machine/service.js:430-486`). | One place already owns archive cleanup (MAP) | defaulted |

## Spec

Draft; finalized when the open questions are settled.

### Diagram forms
(D1, D2.) Schemas to be written into `protocol/app/cards.md` under `diagram`.

### Images the lead shows
(D3.)

### Uploads
(D4, D5.)

## Accepted Risks

| Risk | Why accepted | Round |
|------|--------------|-------|

## Review Rounds

## Prior Work

| Spec item | State | Evidence (file:line) | Confidence |
|-----------|-------|----------------------|------------|

## Implementation Tasks

| # | Objective | Ownership boundary | Lane | Session id | Validation | Status |
|---|-----------|--------------------|------|-----------|------------|--------|

## Log
