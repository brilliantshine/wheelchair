(function () {
  'use strict';
  // Shared by every page (nav.js loads first): calls fn every ms while the tab is visible, does
  // nothing on a tick while hidden, and on becoming visible calls fn once and restarts the
  // interval so the next tick is a full ms later. stop() removes it for good.
  window.wcPoller = function (fn, ms) {
    let id = setInterval(tick, ms), stopped = false;
    function tick() { if (!stopped && document.visibilityState === 'visible') fn(); }
    function onShow() {
      if (stopped || document.visibilityState !== 'visible') return;
      clearInterval(id); id = setInterval(tick, ms); fn();
    }
    document.addEventListener('visibilitychange', onShow);
    return { stop() { stopped = true; clearInterval(id); document.removeEventListener('visibilitychange', onShow); } };
  };
  // The header every app page shares: logo, hub line, the Features / Threads / Agents control
  // with the live agent count and the Needs you count.
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
    ['agents', 'Agents', '/wheelchair/app/agents'],
    ['settings', 'Settings', '/wheelchair/app/settings'],
  ];
  let sessionCount = null;
  let settingsLink = null;
  let alertDot = null;
  for (const [key, label, href] of links) {
    const a = el('a', '');
    a.href = href;
    if (key === 'settings') {
      // Phones show a small gear in place of the word (app.css, 480px block); the name stays.
      // Hidden by CSS above 480px, not by the hidden attribute: app.css's [hidden] rule is
      // !important and would keep it hidden on phones too, leaving an empty button.
      const gear = el('span', 'gear');
      gear.setAttribute('aria-hidden', 'true');
      gear.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        + 'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle>'
        + '<path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path></svg>';
      a.append(gear, el('span', 'lbl', label));
      a.setAttribute('aria-label', label);
      settingsLink = a;
      alertDot = el('span', 'usage-dot');
      alertDot.hidden = true;
      alertDot.setAttribute('aria-hidden', 'true');
      a.append(alertDot);
    } else {
      a.textContent = label;
    }
    if (key === 'agents') {
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
      const agentsResponse = await fetch(API + '/agents');
      if (!agentsResponse.ok) return;
      const agents = await agentsResponse.json();
      function count(node) { return (node.live === true ? 1 : 0) + (node.children || []).reduce((n, child) => n + count(child), 0); }
      const total = (agents.leads || []).reduce((n, lead) => n + count(lead.session), 0);
      sessionCount.textContent = String(total);
      sessionCount.hidden = false;
    } catch (e) { /* keep the last line */ }
  }

  // The Settings dot: on while a provider's week is running short and nobody has opened Usage.
  function showDot(on) {
    if (!alertDot) return;
    alertDot.hidden = !on;
    settingsLink.setAttribute('aria-label', on ? 'Settings, usage needs a look' : 'Settings');
  }
  async function refreshAlert() {
    try {
      const res = await fetch(API + '/usage/alert');
      if (!res.ok) return;
      const data = await res.json();
      showDot(data.dot === true);
    } catch (e) { /* keep the last state */ }
  }
  // The Settings page tells us when Usage was opened and the alerts were marked seen.
  window.addEventListener('wc-usage-seen', () => showDot(false));

  refreshNeeds();
  refreshSessions();
  refreshAlert();
  setInterval(refreshAlert, 300000);
  window.wcPoller(refreshNeeds, 10000);
  window.wcPoller(refreshSessions, 10000);

  // The conversation pop-up (assistant-popup.*): the assistant when it is on, and on a project
  // thread's page that project's lead; never the conversation whose own page this is.
  let popupLoading = false, popupCss = false;
  async function loadPopup() {
    if (popupLoading) return;
    popupLoading = true;
    try {
      const here = location.pathname === '/wheelchair/app/thread' ? new URLSearchParams(location.search).get('id') || '' : null;
      const read = async (path) => {
        const res = await fetch(API + path);
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      };
      const [assistant, lead] = await Promise.all([read('/assistant'), here === null ? null : read('/project-lead?thread=' + encodeURIComponent(here))]);
      const offered = {};
      if (lead && lead.on === true && lead.project) offered.lead = { thread: lead.thread, project: lead.project };
      if (assistant && assistant.on === true && assistant.thread && assistant.thread !== here) offered.assistant = { thread: assistant.thread };
      window.__wcPopup = offered;
      if (window.WCPopup) { window.WCPopup.update(offered); return; }
      if (!offered.lead && !offered.assistant) return;
      if (!popupCss) {
        const css = el('link'); css.rel = 'stylesheet'; css.href = '/wheelchair/assets/pages/assistant-popup.css';
        document.head.appendChild(css); popupCss = true;
      }
      const load = (src) => new Promise((resolve) => { const s = el('script'); s.src = src; s.onload = resolve; s.onerror = resolve; document.head.appendChild(s); });
      if (!window.WCMarkdown) await load('/wheelchair/assets/pages/md.js');
      await load('/wheelchair/assets/pages/assistant-popup.js');
    } catch (e) { /* retry on the next check */ }
    finally { popupLoading = false; }
  }
  loadPopup();
  window.wcPoller(loadPopup, 30000);
})();
