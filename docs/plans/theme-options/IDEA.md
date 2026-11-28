---
slug: theme-options
status: confirmed
mode: thorough
created: 2026-11-28
---

# Custom accent color and theme options

## What we're building

Let the user replace Wheelchair's default blue accent color with any color they pick, switch between light, dark, and system color modes, and choose from ready-made color theme presets. All choices live in Settings alongside the existing appearance controls and apply consistently across the app.

## Why — the problem

Today Wheelchair's accent color is fixed to blue and there is no way to switch color modes or pick a different color theme. Anyone who wants a different look, prefers dark or light mode explicitly, or wants to personalize the app's feel is stuck with the single default palette.

## What good looks like

- Picking any custom accent color in Settings updates buttons, links, highlights, and other accent elements across Wheelchair's pages, while keeping text readable against the chosen color.
- Switching between light, dark, and system color modes updates surfaces, text, and borders cleanly across pages and stays in sync with the OS when set to system.
- Selecting a ready-made theme preset applies a cohesive look in one click, and the user can still customize or reset back to Wheelchair's default.
- Theme choices persist across reloads and work cleanly alongside existing background/appearance settings.

## Not doing

- Typography, font-size, layout density, or corner-radius controls.
- Per-project or per-thread theme overrides (theme settings apply across the app).
- Custom raw CSS editing or user-uploaded stylesheet files.

## Constraints

- Must work cleanly with Wheelchair's existing Settings and Appearance (background) controls.
- Accent and theme colors must preserve readable text contrast across both light and dark modes.
- Must apply across all signed-in app pages without flashing the wrong theme on load where practical.
