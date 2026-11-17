# Remediation 1 — agents-screen-redesign

Verification attempt 1 (verifier `wc-000b13766ec4-verifier`, gpt-6.1-sol) on commit 589d66d6bbbf2351390e574bd6237a46b1f16b90: **FAIL**.

## Gaps, verbatim

GAP: §4 desktop tree — wide trees clip children beyond the unreachable left edge — viewer/pages/views.css:133 centers overflowing children; reproduced at 1280px with four children: first child begins at x=181 while the scroll area begins at x=298, with scrollLeft already 0.
GAP: §5 phone layout — selecting an agent leaves the tree above the details instead of showing details full screen — viewer/pages/views.css:169 overrides the hide rule at :168; reproduced at 390px with both main and side panels displayed and details starting at y=544.

## Tasks

Both gaps live in `viewer/pages/views.css` and get tests in `viewer/test/app-views.spec.js`. Overlapping files, so they run in sequence, in one worker session (brief `R1`, below covers R1a then R1b).

### R1a — wide trees scroll instead of clipping (§4)
- Objective: a tree wider than `.agents-tree` starts at the scroll area's left edge and the rest is reachable by scrolling; a narrow tree stays centred.
- Change: in `viewer/pages/views.css` (Agents section), make `.agents-tree` `display: flex` and give its top-level branch `.agents-tree > .agents-branch { margin: 0 auto; flex-shrink: 0; }` (auto margins centre it when it fits and collapse to 0 when it overflows), and use `justify-content: safe center` on `.agents-children` (desktop rule only) so nested rows cannot overflow leftwards either.
- Test: desktop (1280×800), mock a lead with five children (each 190px box), assert the first child box's left ≥ `.agents-tree`'s left (bounding boxes), `.agents-tree` scrollWidth > clientWidth, and that after `scrollLeft = scrollWidth`, the last child box's right ≤ the tree's right + 1. A second assertion with two children: the lead box is horizontally centred in `.agents-tree` (±2px).
- Ownership: `viewer/pages/views.css` (Agents rules only), `viewer/test/app-views.spec.js` (new Agents tests only).

### R1b — phone: selecting an agent shows only its details (§5)
- Objective: under 900px with `?lead=…&agent=…`, the tree (`.agents-main`) and the sidebar are hidden and only `.agents-side` shows.
- Change: in the `@media (max-width: 899px)` block, the show rule becomes `.agents-layout.has-lead:not(.has-agent) .agents-main { display: block; }` (the hide rule `.agents-layout.has-agent .agents-main { display: none; }` then holds).
- Test: at 390×844, open `/app/agents?lead=a&agent=<a child>` (mocked agents), assert `.agents-main` and `.agents-sidebar` hidden and `.agents-side` visible; tap "‹ <lead name>" → `.agents-main` visible, `.agents-side` hidden.
- Ownership: same files as R1a.

Validation: `npm --prefix viewer run test:browser` (whole suite), `node --test viewer/test/*.test.js`.
