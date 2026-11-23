# Map: the Threads list

Checked against: `7c380321f4556a08b63485203d613feeeae1f640` (origin/main)
Files covered: `viewer/app/threads.js`, `viewer/app/routes.js`, `viewer/app/sessions.js`, `viewer/pages/threads.js`, `viewer/pages/threads.html`

> Lead-chat paths rechecked against `1ee9ad1487d2a3f8b6ceda7f73cf7218657f52c2`; see [lead-chat/MAP.md](../plans/lead-chat/MAP.md). Other claims retain their historical checked commit.

> The covered files changed after the checked-against commit. The lighter-server paths were rechecked against `e4117bdcacf06f2a3c73dd22d8af8d8086cb00e3`; see [lighter-server/MAP.md](../plans/lighter-server/MAP.md). Other claims below retain their historical checked-against commit.

## Flow

The browser polls `/threads` and `/features` every five seconds (`viewer/pages/threads.js:88-111`). The thread endpoint returns each whole stored thread with session tokens removed (`viewer/app/routes.js:314-325`, `viewer/app/sessions.js:48-51`). Each thread therefore already carries its recorded sessions, including their roles, operational names, parent links and live state when recorded (`viewer/app/threads.js:20-36`, `viewer/app/sessions.js:130-146`).

The page groups by project, sorts by the person's last message, and makes each row a link to the thread. It uses live lead state for the working dot and displays stage, needs, provider, machine and age; it does not display a lead name (`viewer/pages/threads.js:36-65`, `:70-84`). A stub may have no sessions (`viewer/app/threads.js:105`). A restarted thread can have several lead records (`viewer/app/threads.js:118-153`), so selecting the lead to link is a product decision; message routing uses the latest live lead (`viewer/app/routes.js:343-348`). The row is already an anchor, relevant when adding a separate link (`viewer/pages/threads.js:40-67`).

```text
GET threads + features -> page groups and sorts -> thread row -> thread page
```

## What I did not look at

- Thread conversation rendering, card presses and document links; this map now covers the list only.
- CSS and browser test fixtures.
