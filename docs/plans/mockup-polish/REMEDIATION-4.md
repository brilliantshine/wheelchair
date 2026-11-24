# Remediation 4 — mockup-polish

Verification attempt 4 (commit b060a327): the Claude verifier passed; the GPT verifier (gpt-6.2-sol) reported one gap, verbatim:

```
GAP: S3 — PNG export changes the size of elements styled with `rem` when the mockup sets a root font size. In Chromium and Firefox, a `10rem × 3rem` block with `html { font-size: 62.5% }` renders at 100 × 30 CSS px in the preview. At 2×, the export should show a 200 × 60 px block, but it shows a 320 × 96 px block. [Export code](viewer/pages/picture-export.js:124) · [Measurements](/tmp/wc-mockup-verify4-RsmSOw/screens.log)
```

The lead answered: fix it.

# Task R4 — mockup-polish remediation 4 (rem sizes in the mockup PNG)

Plan slug: `mockup-polish`. Task id: `R4`. The lead's session is `wc-c06d283728e9-lead` (message it only if something below is impossible).

## The problem

Inside the SVG `foreignObject` drawing, `rem` resolves against the `<svg>` root's default 16px, not the mockup's `html` font size. A mockup with `html { font-size: 62.5% }` and a `10rem x 3rem` block shows 100x30 CSS px in its iframe but 160x48 in the PNG.

## The change (exact), all in `viewer/pages/picture-export.js`

1. `canvasBackground(html, w, h)` (~line 84) already opens a hidden w x h frame and reads computed styles. Make it also read the `html` element's computed `font-size` and resolve an object `{ bg, fontSize }` instead of the background alone:
   - `bg` is exactly what it resolves today (`{ list, from }` or `null`).
   - `fontSize` is `f.contentWindow.getComputedStyle(d.documentElement).fontSize` (e.g. `"10px"`), or `null` on failure (the `catch` resolves `{ bg: null, fontSize: null }`).
   Rename the function to `readMockupPage` and update its comment to say it reads the canvas background and the root font size.
2. In `mockupCanvas` (~line 112): `const page = await readMockupPage(plain, w, h); const bg = page.bg;` (the rest of the background code stays as it is).
3. In the `svg` string (~line 136), add `style="font-size:<fontSize>"` on the `<svg>` element when `page.fontSize` is a value matching `/^[\d.]+px$/`; leave it off otherwise.

Touch nothing else in the file.

## The test (add to `viewer/test/app-mockup-png.spec.js`)

"rem sizes follow the mockup's root font size": a new fixture mockup (follow how the existing fixtures in that file are written and registered) with `html { font-size: 62.5% }`, a white background, and an absolutely positioned block `left: 0; top: 0; width: 10rem; height: 3rem; background: rgb(0, 128, 0)`. Download its PNG the way the other tests do and decode the pixels the same way. At export scale `k` (the existing tests show how they get it): the pixel at (95*k, 25*k) is green, and the pixel at (110*k, 25*k) and at (50*k, 40*k) is white. Show it fails on the old code: run it before your picture-export.js change and paste the failure.

## Ownership boundary

Only `viewer/pages/picture-export.js` and `viewer/test/app-mockup-png.spec.js`. Report: `docs/plans/mockup-polish/reports/R4.md`. Never delete files with `rm` (or any other way). Never start a viewer server by hand; never run `./install.sh`.

## Validation (paste the output in your report)

```bash
npm --prefix viewer run test:browser -- app-mockup-png app-picture-download app-spot-comment
npm --prefix viewer run test:browser -- app-mockup-png --repeat-each=3
```
Also paste `git diff` of your commit.

If the same check fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
