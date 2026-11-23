# R1a — spend-line browser test made reliable

## Changed
- `viewer/test/app-openrouter-spend.spec.js`: replaced the one-shot `getComputedStyle` read with retrying assertions: `not.toHaveClass(/usage-left/)`, `not.toHaveCSS('flex-basis','76px')`, `toHaveCSS('flex-grow','1')`, `toHaveCSS('text-align','left')`, and an `expect.poll` one-line height check that also requires `el.isConnected`. No app code touched.

## Validation
`cd viewer && npx playwright test test/app-openrouter-spend.spec.js --repeat-each=20 --reporter=line`

```
exit 0
...
[40/40] [firefox] › test/app-openrouter-spend.spec.js:23:1 › spend text is not in the 76px column and fits one line
  40 passed (43.1s)
```

## Choices
none
