'use strict';
// Settings → You → Theme. A visit owns the unsaved draft and the preview token; the block's DOM
// is built once and updated in place, so typing and the native color picker keep their focus.
(() => {
  const palette = window.wcThemePalette, theme = window.wcTheme;
  const ENDPOINT = '/wheelchair/api/settings/theme';
  const MODES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
  const FALLBACK = { mode: 'dark', preset: 'default', accent: null };
  const CONFLICT = 'Theme changed elsewhere. Click Reset to load the latest settings.';
  let visit = null, generation = 0, view = null;

  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    node.append(...kids.flat());
    return node;
  }

  const pick = (m) => (m ? { mode: m.mode, preset: m.preset, accent: m.accent } : null);

  function ensureVisit() {
    if (!visit) visit = { generation: ++generation, dirty: false, baseRevision: null, op: 0, saving: false, token: null, draft: null, hexText: null, hexError: false, conflict: false, error: '', status: '' };
    return visit;
  }

  // A clean visit mirrors the saved theme: draft and revision always from the same snapshot.
  function adopt(v) {
    if (v.dirty) return;
    const m = theme.current().metadata;
    if (!m) return;
    if (v.draft && v.baseRevision !== m.revision) v.status = '';
    v.draft = pick(m);
    v.baseRevision = m.revision;
  }

  function discard() {
    const v = visit;
    visit = null;
    if (!v) return;
    v.op++;
    if (v.token) theme.release(v.token);
  }

  // Every control goes through here. `hex` is the typed text, when the hex field made the change.
  function edit(change, { hex, keepHex = false } = {}) {
    const v = ensureVisit();
    adopt(v);
    if (v.saving || !v.draft) return;
    const next = { ...v.draft, ...change };
    const same = ['mode', 'preset', 'accent'].every((key) => next[key] === v.draft[key]);
    // Choosing what is already saved is not an edit; typing in the hex field always is.
    if (!v.dirty && same && hex === undefined) return;
    if (!v.dirty) { v.dirty = true; v.token = theme.acquire(); }
    v.draft = next;
    if (hex !== undefined) { v.hexText = hex; v.hexError = !palette.parseHexColor(hex); }
    else if (!keepHex) { v.hexText = null; v.hexError = false; }
    v.status = '';
    v.error = '';
    theme.preview(v.token, { ...next });
    update();
  }

  function reset() {
    discard();
    theme.refresh();
    update();
  }

  async function save() {
    const v = visit;
    if (!v || !v.dirty || v.saving || v.hexError || v.conflict) return;
    const op = ++v.op;
    v.saving = true; v.error = ''; v.status = '';
    update();
    let response = null, body = null;
    try {
      response = await fetch(ENDPOINT, { method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...v.draft, revision: v.baseRevision }) });
      body = await response.json();
    } catch {}
    const saved = response?.status === 200 && body;
    // Left You while saving: the saved theme still applies everywhere, no editor is touched.
    if (visit !== v || op !== v.op) { if (saved) theme.applySaved(body); return; }
    v.saving = false;
    if (saved) {
      theme.applySaved(body);
      theme.release(v.token);
      Object.assign(v, { dirty: false, token: null, draft: null, hexText: null, hexError: false, status: 'Saved' });
    } else if (response?.status === 409) {
      if (body) theme.applySaved(body);
      v.conflict = true;
    } else {
      v.error = body?.error || body?.detail || "Couldn't save theme";
    }
    update();
  }

  function build() {
    const row = (title, line, ...content) => h('div', { class: 'theme-row' },
      h('div', { class: 'theme-label' }, title, h('span', { class: 'hint', text: line })),
      h('div', { class: 'theme-content' }, content));

    const modes = MODES.map(([id, label]) => h('button', { type: 'button', 'data-mode': id, text: label, onclick: () => edit({ mode: id }, { keepHex: true }) }));
    const presets = palette.PRESETS.map((preset) => {
      const bar = h('span', { class: 'theme-bar', 'aria-hidden': 'true' }, h('i'), h('i'));
      bar.style.background = preset.swatches[0];
      bar.children[0].style.background = preset.swatches[1];
      bar.children[1].style.background = preset.swatches[2];
      return h('button', { type: 'button', class: 'theme-preset', 'data-preset': preset.id, onclick: () => edit({ preset: preset.id }, { keepHex: true }) },
        bar, h('span', { class: 'theme-check', 'aria-hidden': 'true', text: '✓' }), h('span', { class: 'theme-preset-name', text: preset.label }));
    });
    const color = h('input', { type: 'color', class: 'theme-color', 'aria-label': 'Accent color' });
    color.addEventListener('input', () => edit({ accent: color.value.toLowerCase() }));
    const hex = h('input', { type: 'text', class: 'theme-hex', 'aria-label': 'Accent hex color', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: '9' });
    hex.addEventListener('input', () => {
      const parsed = palette.parseHexColor(hex.value);
      edit(parsed ? { accent: parsed } : {}, { hex: hex.value });
    });
    const quick = palette.QUICK_ACCENTS.map((accent) => {
      const button = h('button', { type: 'button', class: 'theme-swatch', 'data-accent': accent, 'aria-label': 'Use accent ' + accent, title: accent, onclick: () => edit({ accent }) });
      button.style.background = accent;
      return button;
    });
    const hexError = h('p', { class: 'inline-err', role: 'alert', text: 'Enter a 3- or 6-digit hex color, like #10b981.' });
    const toPreset = h('button', { type: 'button', class: 'theme-link', text: 'Reset to preset', onclick: () => edit({ accent: null }) });
    const toDefault = h('button', { type: 'button', class: 'theme-link', text: 'Reset to default', onclick: () => edit({ preset: 'default', accent: null }) });
    const status = h('p', { class: 'hint theme-status', role: 'status' });
    const error = h('p', { class: 'inline-err', role: 'alert' });
    const undo = h('button', { type: 'button', text: 'Reset', onclick: reset });
    const submit = h('button', { type: 'button', class: 'primary', text: 'Save theme', onclick: save });

    const root = h('div', { class: 'theme-editor' },
      h('div', { class: 'theme-head' }, h('h2', { text: 'Theme' }), h('span', { class: 'hint', text: 'Choose colors for Wheelchair across your devices.' })),
      h('div', { class: 'box theme-box' },
        row('Color mode', 'Choose light, dark, or follow your system.', h('div', { class: 'theme-modes', role: 'group', 'aria-label': 'Color mode' }, modes)),
        row('Theme preset', 'A coordinated starting palette.', h('div', { class: 'theme-presets', role: 'group', 'aria-label': 'Theme preset' }, presets)),
        row('Accent color', 'Customize the selected preset.',
          h('div', { class: 'theme-accent' }, color, hex, h('div', { class: 'theme-swatches', role: 'group', 'aria-label': 'Quick accents' }, quick)),
          hexError,
          h('div', { class: 'theme-resets' }, toPreset, toDefault)),
        h('div', { class: 'theme-actions' }, h('div', { class: 'theme-message' }, status, error), undo, submit)));
    return { root, modes, presets, color, hex, quick, hexError, toPreset, toDefault, status, error, undo, submit };
  }

  function update() {
    if (!view) return;
    const v = ensureVisit();
    adopt(v);
    const state = theme.current();
    const draft = v.draft || FALLBACK;
    const preset = palette.PRESETS.find((p) => p.id === draft.preset) || palette.PRESETS[0];
    const accent = draft.accent || preset.defaultAccent;
    const locked = v.saving || !v.draft;
    for (const button of view.modes) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === draft.mode));
      button.disabled = locked;
    }
    for (const button of view.presets) {
      button.setAttribute('aria-pressed', String(button.dataset.preset === draft.preset));
      button.disabled = locked;
    }
    for (const button of view.quick) button.disabled = locked;
    view.color.value = accent;
    view.color.disabled = locked;
    const text = v.hexText ?? accent;
    if (view.hex.value !== text) view.hex.value = text;
    view.hex.disabled = locked;
    view.hex.setAttribute('aria-invalid', String(v.hexError));
    view.hexError.hidden = !v.hexError;
    view.toPreset.disabled = locked || draft.accent === null;
    view.toDefault.disabled = locked || (draft.preset === 'default' && draft.accent === null);
    const problem = v.conflict ? CONFLICT : v.error || (v.draft ? '' : state.error);
    view.error.textContent = problem;
    view.error.hidden = !problem;
    view.status.textContent = problem ? '' : v.saving ? 'Saving…' : v.dirty ? 'Previewing on this page · Save to apply across devices'
      : v.draft ? v.status : 'Loading theme…';
    view.undo.disabled = v.saving || !v.dirty;
    view.submit.disabled = locked || !v.dirty || v.hexError || v.conflict;
  }

  // One node per mount, matching the other Settings blocks.
  function render() {
    view = build();
    update();
    return view.root;
  }

  // An unchanged poll leaves a clean editor alone; a dirty draft ignores every saved change.
  let seen = '';
  theme.subscribe((state) => {
    const signature = JSON.stringify([state.metadata, state.metadata ? '' : state.error]);
    if (signature === seen) return;
    seen = signature;
    if (view?.root.isConnected && !visit?.dirty) update();
  });
  // A page restored from the back-forward cache still shows the DOM of the discarded draft.
  window.addEventListener('pageshow', () => { if (view?.root.isConnected) update(); });

  window.wcThemeEditor = { render, discard };
})();
