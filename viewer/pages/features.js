'use strict';

// Features view (Spec "Views", "Feature status"): features by stage, and the Needs you strip.
(() => {
  const STAGES = [
    ['idea', 'Idea'],
    ['planning', 'Planning'],
    ['review', 'Review'],
    ['building', 'Building'],
    ['verifying', 'Verifying'],
    ['done', 'Done'],
  ];
  const KIND = { question: 'Question', needs: 'Needs you', approval: 'Approval, start building' };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function threadHref(id, cardId) {
    const base = `/wheelchair/app/thread?id=${encodeURIComponent(id)}`;
    return cardId ? `${base}#card-${encodeURIComponent(cardId)}` : base;
  }

  function renderNeeds(needs) {
    const list = document.getElementById('needs-list');
    list.replaceChildren();
    for (const item of needs) {
      const row = el('li', 'v-card need');
      row.dataset.kind = item.kind;
      row.append(el('span', 'v-badge', KIND[item.kind] || item.kind));
      const link = el('a', 'v-link', item.title);
      link.href = threadHref(item.thread_id, item.card_id);
      row.append(link);
      list.append(row);
    }
    document.getElementById('needs').hidden = needs.length === 0;
  }

  function renderGroups(data) {
    const root = document.getElementById('groups');
    root.replaceChildren();
    let total = 0;
    for (const [key, title] of STAGES) {
      const items = data[key] || [];
      total += items.length;
      const group = el('section', `v-group${items.length ? '' : ' empty'}`);
      group.dataset.stage = key;
      group.append(el('h2', '', `${title} (${items.length})`));
      const list = el('ul', 'v-list');
      for (const feature of items) {
        const row = el('li', 'v-card feature');
        const link = el('a', 'v-link', feature.slug);
        link.href = threadHref(feature.id);
        row.append(link);
        row.append(el('span', 'v-badge', feature.status || key));
        row.append(el('span', 'sub', String(feature.project || '')));
        list.append(row);
      }
      group.append(list);
      root.append(group);
    }
    document.getElementById('empty').hidden = total > 0;
  }

  async function refresh() {
    const error = document.getElementById('error');
    try {
      const response = await fetch('/wheelchair/api/features');
      if (!response.ok) throw new Error(`features ${response.status}`);
      const data = await response.json();
      renderNeeds(data.needs || []);
      renderGroups(data);
      error.hidden = true;
    } catch (failure) {
      error.textContent = `Could not load features: ${failure.message}`;
      error.hidden = false;
    }
  }

  refresh();
  setInterval(refresh, 5000);
})();
