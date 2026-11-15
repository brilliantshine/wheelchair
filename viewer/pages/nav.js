(function () {
  'use strict';
  // The header every app page shares: logo, hub line, the Features / Threads / Sessions control
  // with the session count, the Needs you count and the New thread button.
  const host = document.getElementById('app-nav');
  if (!host) return;
  const current = host.getAttribute('data-current');
  const API = '/wheelchair/api';

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  const brand = el('a', 'brand');
  brand.href = '/wheelchair/app/features';
  const logo = el('span', 'logo');
  logo.setAttribute('aria-hidden', 'true');
  // A fixed wheelchair mark; no page data goes through innerHTML.
  logo.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
    + 'stroke-width="2.4" stroke-linecap="round"><circle cx="9" cy="16" r="5"></circle><path d="M9 3v8h7l3 8"></path></svg>';
  brand.append(logo, el('span', 'brand-name', 'wheelchair'));
  brand.setAttribute('aria-label', 'wheelchair');
  host.appendChild(brand);

  const hub = el('div', 'hubline');
  hub.hidden = true;
  const hubDot = el('span', 'dot');
  const hubName = el('span', 'mono', '');
  const hubText = el('span', '', '');
  hub.append(hubDot, hubName, hubText);
  host.appendChild(hub);

  const seg = el('nav', 'seg');
  seg.setAttribute('aria-label', 'Views');
  const links = [
    ['features', 'Features', '/wheelchair/app/features'],
    ['threads', 'Threads', '/wheelchair/app/threads'],
    ['sessions', 'Sessions', '/wheelchair/app/sessions'],
  ];
  let sessionCount = null;
  for (const [key, label, href] of links) {
    const a = el('a', '', label);
    a.href = href;
    if (key === 'sessions') {
      sessionCount = el('span', 'count', '');
      sessionCount.hidden = true;
      a.append(sessionCount);
    }
    if (key === current) a.setAttribute('aria-current', 'page');
    seg.appendChild(a);
  }
  host.appendChild(seg);
  host.appendChild(el('span', 'spacer'));

  const needs = el('a', 'needs-count none');
  needs.href = '/wheelchair/app/features';
  const needsLabel = el('span', 'lbl', 'Needs you: ');
  const needsN = el('span', 'n', '–');
  needs.append(needsLabel, needsN);
  needs.setAttribute('aria-label', 'Needs you');
  host.appendChild(needs);

  const add = el('a', 'new-thread');
  add.append(el('span', 'plus', '+'), el('span', 'lbl', 'New thread'));
  add.setAttribute('aria-label', 'New thread');
  add.href = '/wheelchair/app/threads?new=1';
  // Where the page already has the form, the button takes you to it instead of reloading.
  add.addEventListener('click', (ev) => {
    const form = document.getElementById('new-form');
    if (!form) return;
    ev.preventDefault();
    form.classList.add('open');
    form.scrollIntoView({ block: 'nearest' });
    const field = document.getElementById('nt-project');
    if (field) field.focus();
  });
  host.appendChild(add);

  function syncHeight() {
    document.documentElement.style.setProperty('--nav-h', host.offsetHeight + 'px');
  }
  syncHeight();
  if (window.ResizeObserver) new ResizeObserver(syncHeight).observe(host);
  else window.addEventListener('resize', syncHeight);

  async function refreshNeeds() {
    try {
      const res = await fetch(API + '/features');
      if (!res.ok) return;
      const data = await res.json();
      const n = Array.isArray(data.needs) ? data.needs.length : 0;
      needsN.textContent = String(n);
      needs.setAttribute('aria-label', 'Needs you: ' + n);
      needs.className = 'needs-count' + (n ? '' : ' none');
    } catch (e) { /* keep the last count */ }
  }

  async function refreshSessions() {
    try {
      const res = await fetch(API + '/sessions');
      if (!res.ok) return;
      const groups = await res.json();
      if (!Array.isArray(groups)) return;
      const hubGroup = groups.find((g) => g.hub === true);
      const others = groups.filter((g) => g.hub !== true);
      const workers = others.filter((g) => g.reachable).length;
      if (hubGroup) {
        hub.hidden = false;
        hubDot.style.background = hubGroup.reachable ? '' : 'var(--bad)';
        hubName.textContent = hubGroup.machine;
        hubText.textContent = 'hub · ' + workers + (workers === 1 ? ' worker' : ' workers') + ' online';
      }
      let total = 0;
      for (const g of groups) total += (g.sessions || []).filter((s) => s.managed !== false).length;
      sessionCount.textContent = String(total);
      sessionCount.hidden = false;
    } catch (e) { /* keep the last line */ }
  }

  refreshNeeds();
  refreshSessions();
  setInterval(refreshNeeds, 10000);
  setInterval(refreshSessions, 10000);
})();
