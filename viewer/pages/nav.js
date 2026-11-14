(function () {
  'use strict';
  const host = document.getElementById('app-nav');
  if (!host) return;
  const current = host.getAttribute('data-current');
  const links = [
    ['features', 'Features', '/wheelchair/app/features'],
    ['threads', 'Threads', '/wheelchair/app/threads'],
    ['sessions', 'Sessions', '/wheelchair/app/sessions'],
  ];
  for (const [key, label, href] of links) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (key === current) a.setAttribute('aria-current', 'page');
    host.appendChild(a);
  }
  const needs = document.createElement('a');
  needs.href = '/wheelchair/app/features';
  needs.className = 'needs-count none';
  needs.textContent = 'Needs you: –';
  host.appendChild(needs);

  async function refresh() {
    try {
      const res = await fetch('/wheelchair/api/features');
      if (!res.ok) return;
      const data = await res.json();
      const n = Array.isArray(data.needs) ? data.needs.length : 0;
      needs.textContent = 'Needs you: ' + n;
      needs.className = 'needs-count' + (n ? '' : ' none');
    } catch (e) { /* keep the last count */ }
  }
  refresh();
  setInterval(refresh, 10000);
})();
