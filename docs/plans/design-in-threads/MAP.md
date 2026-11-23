# Map: design in threads

Checked against `0682593b69c19bc93ee2af333f57cbf5b9efd685` (origin/main). See [visual design in threads](../../maps/thread-visual-design.md) for the traced paths, limits and evidence. Existing [agent screens](../../maps/agent-screens.md), [thread page](../../maps/app-thread-page.md), and [done card](../../maps/done-card.md) maps cover adjacent flows; their covered files changed since their checked commits, so the relevant paths were rechecked in the new map rather than trusting their older line numbers.

```text
plan file -> lead diagram card -> phone thread -> user feedback
worker screen -> report path -> sub-lead -> lead image card -> phone thread
```

A static HTML diagram already displays a mockup in a sandbox, with no scripts or network, in a 340px-tall full-width iframe; full size downloads HTML rather than PNG (`protocol/app/cards-lead.md:180-211`; `viewer/pages/diagram.js:70-77`; `viewer/pages/thread.css:207`; `viewer/pages/picture.js:61-75`). Any provider can write the file, but only the lead can post the card (`viewer/app/card.js:30-43`). Form diagrams are fixed text-based arrangements, not arbitrary UI mockups (`viewer/pages/diagram.js:28-54`).

Workers already inspect desktop-visible changes and can pass screenshots to the lead through reports, but posting depends on the lead and there is no prescribed per-task mockup comparison (`protocol/app/worker.md:45`; `protocol/app/sub-lead.md:179`; `protocol/app/lead.md:909-912`). The Spec can name a design file in its prose but the template has no dedicated field (`protocol/templates/PLAN.md:44-51`). Playwright Chromium is installed and rendered a phone-size PNG in memory on this machine; other machines are not guaranteed to have it (`viewer/package.json:8-11`; `install.sh:147-155`).

## What I did not look at

Live phone behavior, other agent machines and providers, and complete archival or failure paths. No application test suite was run for this documentation-only map.
