# Remediation 5 — mockup-polish

Verification attempt 5 (commit 41512f55). Both verifiers reported the same gap; verbatim (GPT, then Claude):

```
GAP: S3 — The PNG exporter applies a percentage root font size twice to inherited text and `em` lengths. With `html { font-size: 62.5% }`, a `10em` block previews at 100 CSS px in both browsers. The 2× PNG should show a 200-pixel block, but it measures 126 pixels in Chromium and 125 in Firefox. The exporter sets the computed 10 px on the outer SVG and leaves the percentage on the inner HTML. (viewer/pages/picture-export.js:127, :136)
GAP: S3 (mockup PNG looks like the mockup) — the R4 fix broke `em` sizes and text that inherits its size, in mockups that set a percentage root font size ... the mockup's own `html{font-size:62.5%}` rule still matches the wrapping `html` element inside the `foreignObject`, so that element ends up at 62.5% of 10px = 6.25px ... Possible fix: put the same px font size inline on the wrapping `html` element too.
```

Merged as one gap. The lead answered: fix. This is the second fix attempt on the root-font-size gap (R4 was the first); if it fails again, it goes to the lead as a plan defect.

# Task R5 — mockup-polish remediation 5 (root font size applied twice)

Plan slug: `mockup-polish`. Task id: `R5`. The lead's session is `wc-c06d283728e9-lead` (message it only if something below is impossible).

## The problem

`viewer/pages/picture-export.js` `mockupCanvas` puts the mockup's resolved root font size (e.g. `10px` for `html { font-size: 62.5% }`) on the `<svg>` root (~line 136). But the mockup's own `html { font-size: 62.5% }` rule still matches the wrapped `html` element inside the `foreignObject`, so that element becomes 62.5% of 10px = 6.25px. `rem` is right, but `em` sizes and text that inherits its size come out at 62.5%.

## The change (exact), in `viewer/pages/picture-export.js` only

Right after the line that sets the wrapped html's style (`wrap.setAttribute('style', (wrap.getAttribute('style') || '') + ';display:block;width:' + w + 'px;height:' + h + 'px');`, ~line 127), compute the px test once and, when it passes, also append `;font-size:<px> !important` to `wrap`'s style. Concretely: move the `/^[\d.]+px$/.test(page.fontSize || '')` check up to a `const rootPx = ... ? page.fontSize : null;` before that line, append `';font-size:' + rootPx + ' !important'` to `wrap`'s style when `rootPx` is set, and build the svg `style` attribute from `rootPx` as today. Nothing else changes.

## The test (in `viewer/test/app-mockup-png.spec.js`)

Add a fixture `em` next to the existing `rem` fixture (~line 26):
```
'<style>html{font-size:62.5%;background:#fff}body{margin:0}.r{position:absolute;left:0;top:0;width:10rem;height:3rem;background:rgb(0, 128, 0)}.e{position:absolute;left:0;top:50px;width:10em;height:3em;background:rgb(0, 0, 255)}</style><body><div class="r"></div><div><div class="e"></div></div></body>'
```
(the `.e` block sits in a plain `div`, so its `em` is the inherited root size, 10px). Add a test "em sizes and inherited text follow the mockup's root font size", written like the existing rem test (~line 109, `k = 2`): pixels (95k, 25k) green `[0,128,0]`; (110k, 25k) white; (95k, 75k) blue `[0,0,255]`; (110k, 75k) white. Keep the existing rem test. Show the new test fails on the current code: run it before your picture-export.js change and paste the failure.

## Ownership boundary

Only `viewer/pages/picture-export.js` and `viewer/test/app-mockup-png.spec.js`. Report: `docs/plans/mockup-polish/reports/R5.md`. Never delete files with `rm` (or any other way). Never start a viewer server by hand; never run `./install.sh`.

## Validation (paste the output, with exit codes, in your report)

```bash
npm --prefix viewer run test:browser -- app-mockup-png app-picture-download
npm --prefix viewer run test:browser -- app-mockup-png --repeat-each=3
```
Also paste `git diff` of your commit.

If the same check fails twice, stop and report rather than iterating.

List each decision you made that this brief did not settle, one line each, naming the file or piece of the design it affected. Write 'none' if there were none.
