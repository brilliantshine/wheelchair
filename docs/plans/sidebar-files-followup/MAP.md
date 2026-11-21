# Map: sidebar files follow-up

```text
chat poll -> slug discovery -> document list -> desktop and phone Files
                                               -> doc or picture renderer
lead sends file -> machine uploads -> file card -> authenticated download
archive -> delete uploads -> archived thread and branch reads
```

The shared desktop/phone renderer lists plan documents and pictures, then sent files; it removes sent links when archived (`viewer/pages/thread.js:381-465`). Documents use the doc page's Markdown renderer and the hub's JSON/download route (`viewer/pages/doc.js:25-66`; `viewer/app/routes.js:572-582`). Picture pages use an SVG graph viewer, DOM forms, or sandboxed HTML; aside pictures use stored graph paths (`viewer/pages/picture.js:31-52`; `viewer/pages/diagram.js:12-24,28-80`; `viewer/index.html:1888-1906`). These are distinct export surfaces; the current package lists no ZIP or image-export library (`viewer/package.json:5-16`; `viewer/vendor/xterm/`).

Today all plan discovery and reads are hub-local: discovery runs Git on the worktree, live documents check local files, archived documents and diagrams use local Git (`viewer/app/views.js:71-104`; `viewer/app/documents.js:13-47`; `viewer/app/threads.js:251-290`). Live graph/form/HTML readers likewise use hub-local paths (`viewer/pages/diagram.js:12-24`; `viewer/server.js:1488-1507,1673-1696`). Thread-list and chat discovery already run inside per-thread locks; re-entering `withThread` deadlocks, and awaiting a remote request there holds the lock (`viewer/app/routes.js:441-451`; `viewer/app/hub.js:120-134,280-294`). The existing handoff refresh calls the machine before locking and checks the snapshot again before using the result (`viewer/app/hub.js:267-278`).

Sent file and image copies share the numbered uploads folder with user attachments; the machine removes it on archive, and failure prevents the hub from completing archive (`machine/service.js:300-305,319-328,353-396,1209-1217`; `viewer/app/threads.js:217-247`). File delivery passes through an authenticated hub-to-machine stream; non-images are forced downloads with `nosniff`, which a preview must account for (`viewer/app/routes.js:551-560`; `viewer/app/machine-client.js:139-149`; `machine/service.js:527-540,1973-1981`).

See [thread files map](../../maps/thread-sidebar-files.md) for the checked commit, detailed flows and boundaries. Older overlapping maps changed since their recorded commits; the relevant flows were rechecked in the focused map.

Not checked: browser-specific image serialization and font embedding, every vendored xterm internal, handoff/import file preservation, other machines' deployed versions, or lifecycle cleanup beyond archive.
