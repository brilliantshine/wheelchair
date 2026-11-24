---
slug: custom-backgrounds
status: confirmed
mode: thorough
created: 2026-11-19
---

# Custom image and GIF backgrounds
## What we're building
A Background Customization section in Settings lets you choose an image or animated GIF for Wheelchair and adjust its visibility. Changes preview immediately; Save applies the background and opacity everywhere you use this Wheelchair, and Cancel restores the saved appearance.

## Why — the problem
Wheelchair currently has a fixed appearance. You want to personalize it with your own background while keeping conversations and controls easy to read and use.

## What good looks like
Upload a PNG, JPG, WEBP, or animated GIF in Settings.
Adjust background visibility from 0% to 100% and see the result immediately without refreshing.
Animated GIFs keep playing while displayed.
The background shows around content panels; the panels stay solid so their text and controls remain readable.
Save applies the same background and opacity across browsers and devices connected to this Wheelchair.
Saved preferences remain after restarting Wheelchair.
Cancel discards the preview and restores the saved appearance.
Remove the custom background and save to restore Wheelchair's original appearance everywhere.
## Not doing
Separate backgrounds or opacity preferences for each browser or device.
Image editing tools or a collection of multiple saved backgrounds.
Changes to unrelated Wheelchair features.
## Constraints
Follow Wheelchair's existing interface architecture and styling conventions.
Backgrounds must not intercept clicks, typing, scrolling, or other interface interactions.
Content panels remain solid; changing background opacity must not fade their text or controls.
Previewing changes does not replace the shared saved appearance until Save is pressed.
