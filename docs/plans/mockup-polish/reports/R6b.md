# R6b — make the div-rule PNG test able to fail

## Change

- `viewer/test/app-mockup-png.spec.js`: removed absolute positioning from the `divrule` fixture's `.b` rule so the block sits in normal flow. The test body and pixel checks are unchanged.

## Validation

Temporary fault injection: changed the `picture-export.js` root element from `wc-export-root` to `div`, then ran:

```text
npm --prefix viewer run test:browser -- app-mockup-png -g "div rule"
exit 0
  ✓  [chromium] › test/app-mockup-png.spec.js:118:1 › a mockup's div rule does not move the picture
  ✓  [firefox] › test/app-mockup-png.spec.js:118:1 › a mockup's div rule does not move the picture
  2 passed (2.4s)
```

The requested failure could not be demonstrated: the test passed under this mutation in both browsers. The source file was restored to `wc-export-root` before subsequent validation and is not part of the change.

Clean-source targeted run:

```text
npm --prefix viewer run test:browser -- app-mockup-png -g "div rule"
exit 0
  ✓  [chromium] › test/app-mockup-png.spec.js:118:1 › a mockup's div rule does not move the picture
  ✓  [firefox] › test/app-mockup-png.spec.js:118:1 › a mockup's div rule does not move the picture
  2 passed (2.4s)
```

Full requested run:

```text
npm --prefix viewer run test:browser -- app-mockup-png --repeat-each=2
exit 0
  40 passed (22.6s)
```

Working-tree status before commit:

```text
git status --short
 M viewer/test/app-mockup-png.spec.js
```

## Commit diff

```diff
diff --git a/viewer/test/app-mockup-png.spec.js b/viewer/test/app-mockup-png.spec.js
index ec692d96..3e748a60 100644
--- a/viewer/test/app-mockup-png.spec.js
+++ b/viewer/test/app-mockup-png.spec.js
@@ -24,7 +24,7 @@ const FIXTURES = {
   // A script must not run: it would turn the block green.
   script: '<style>body{margin:0}.b{width:50px;height:50px;background:#ff0000}</style><body><div class="b"></div><script>document.querySelector(".b").style.background="#00ff00"</script></body>',
   rem: '<style>html{font-size:62.5%;background:#fff}body{margin:0}.b{position:absolute;left:0;top:0;width:10rem;height:3rem;background:rgb(0, 128, 0)}</style><body><div class="b"></div></body>',
-  divrule: '<style>html{background:#fff}body{margin:0}div{padding:24px}.b{position:absolute;left:0;top:0;width:120px;height:40px;padding:0;background:rgb(0, 128, 0)}</style><body><div class="b"></div></body>',
+  divrule: '<style>html{background:#fff}body{margin:0}div{padding:24px}.b{width:120px;height:40px;padding:0;background:rgb(0, 128, 0)}</style><body><div class="b"></div></body>',
   em: '<style>html{font-size:62.5%;background:#fff}body{margin:0}.r{position:absolute;left:0;top:0;width:10rem;height:3rem;background:rgb(0, 128, 0)}.e{position:absolute;left:0;top:50px;width:10em;height:3em;background:rgb(0, 0, 255)}</style><body><div class="r"></div><div><div class="e"></div></div></body>',
 };
```

## Choices

none
