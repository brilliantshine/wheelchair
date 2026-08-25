---
name: spine
description: Back-fill or extend router documents (AGENTS.md/CLAUDE.md) across a directory tree — each one saying what a directory owns, its boundaries, and where to go next. Scans the target with spine/scan.sh, then proposes every file it would create or extend and stops for confirmation before writing anything. Use when a repo or subtree has no routers, or has grown past what its existing routers cover. Args - a path to a working tree.
---

Read `{{WHEELCHAIR_ROOT}}/protocol/spine.md` and
follow it exactly. The skill argument is a path to a working tree, not a plan slug.
