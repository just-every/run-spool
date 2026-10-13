// Prototype runtime: binds data-proto-* actions, hydrates copy from the content layer, renders dropdowns/modals.
(() => {
  if (document.documentElement.dataset.protoRuntime === 'bound') return;
  document.documentElement.dataset.protoRuntime = 'bound';
  const cfg = JSON.parse(document.getElementById('proto-state').textContent);
  const T = cfg.tokens;
  const qs = new URLSearchParams(location.search);
  const contentSet = qs.get('content') || '';
  const keepQuery = contentSet ? `?content=${encodeURIComponent(contentSet)}` : '';

  // ---- content layer: replace text nodes from content/<state>.json (or content-<set>/)
  async function hydrate() {
    // Direct-file review already carries the same baked-in copy. Browsers do
    // not permit fetch(file://...), and attempting it emits a console error
    // even when the rejected promise is caught.
    if (!cfg.contentFile || location.protocol === 'file:') return;
    const dir = contentSet ? `content-${contentSet}` : 'content';
    try {
      const res = await fetch(`${dir}/${cfg.contentFile}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      let changed = 0;
      for (const [id, text] of Object.entries(data)) {
        const el = document.getElementById(id);
        if (!el || el.textContent === text) continue;
        el.textContent = text; changed++;
      }
      document.documentElement.dataset.protoContent = `${dir}:${changed}`;
    } catch (e) { /* file:// or missing set: keep baked-in copy */ }
  }

  // ---- overlay primitives, styled from the page's own tokens
  const root = document.createElement('div');
  root.id = 'proto-overlay-root';
  document.body.appendChild(root);
  const style = document.documentElement.style;
  style.setProperty('--proto-font', T.bodyFont ? `'${T.bodyFont}', sans-serif` : 'inherit');
  style.setProperty('--proto-text', T.bodyColor || '#222');
  style.setProperty('--proto-muted', T.mutedColor || '#777');
  style.setProperty('--proto-heading', T.headingColor || '#111');
  style.setProperty('--proto-accent', T.accent || '#222');
  style.setProperty('--proto-surface', T.surfaceBg && T.surfaceBg !== 'rgba(0, 0, 0, 0)' ? T.surfaceBg : '#fff');
  style.setProperty('--proto-border', (T.cardBorder || '1px rgb(230,230,230)').replace(/^\S+\s/, ''));
  style.setProperty('--proto-radius', T.cardRadius || '12px');
  style.setProperty('--proto-button', T.buttonBg && T.buttonBg !== 'rgb(255, 255, 255)' ? T.buttonBg : (T.accent || '#222'));

  function closeAll() { root.innerHTML = ''; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

  function openDropdown(trigger, options, labelEl) {
    closeAll();
    const r = trigger.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.className = 'proto-menu';
    menu.style.left = `${r.left + window.scrollX}px`;
    menu.style.top = `${r.bottom + window.scrollY + 6}px`;
    menu.style.minWidth = `${Math.max(160, r.width)}px`;
    for (const opt of options) {
      const item = document.createElement('button');
      item.className = 'proto-menu-item';
      item.textContent = opt;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (labelEl) labelEl.textContent = opt;
        closeAll();
      });
      menu.appendChild(item);
    }
    root.appendChild(menu);
    const backdrop = document.createElement('div');
    backdrop.className = 'proto-backdrop proto-backdrop-clear';
    backdrop.addEventListener('click', closeAll);
    root.insertBefore(backdrop, menu);
  }

  function openModal({ title, body, confirm, detail }) {
    closeAll();
    const backdrop = document.createElement('div');
    backdrop.className = 'proto-backdrop';
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeAll(); });
    const modal = document.createElement('div');
    modal.className = 'proto-modal';
    modal.innerHTML = `
      <h2 class="proto-modal-title"></h2>
      <p class="proto-modal-body"></p>
      ${detail ? '<p class="proto-modal-detail"></p>' : ''}
      <div class="proto-modal-actions">
        <button class="proto-btn proto-btn-ghost" data-act="cancel">Cancel</button>
        <button class="proto-btn proto-btn-primary" data-act="confirm"></button>
      </div>`;
    modal.querySelector('.proto-modal-title').textContent = title || 'Confirm';
    modal.querySelector('.proto-modal-body').textContent = body || '';
    if (detail) modal.querySelector('.proto-modal-detail').textContent = detail;
    modal.querySelector('[data-act="confirm"]').textContent = confirm || 'Confirm';
    modal.querySelector('[data-act="cancel"]').addEventListener('click', closeAll);
    modal.querySelector('[data-act="confirm"]').addEventListener('click', () => {
      toast(`${confirm || 'Done'} — ${title || ''}`.trim());
      closeAll();
    });
    backdrop.appendChild(modal);
    root.appendChild(backdrop);
    modal.querySelector('[data-act="confirm"]').focus();
  }

  function toast(text) {
    const t = document.createElement('div');
    t.className = 'proto-toast';
    t.textContent = text;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('proto-toast-in'));
    setTimeout(() => { t.classList.remove('proto-toast-in'); setTimeout(() => t.remove(), 300); }, 1800);
  }

  // WAI-ARIA 1.2: aria-disabled="true" on an ancestor disables the element
  // and ALL focusable descendants — a nearer descendant's own
  // aria-disabled="false" does not cancel it. closest('[aria-disabled]')
  // stops at the first match regardless of its value, so it can find a
  // descendant's "false" and miss a "true" further up. Walk the whole
  // ancestor chain instead.
  function ariaDisabledAncestor(el) {
    for (let node = el; node; node = node.parentElement) {
      const value = node.getAttribute && node.getAttribute('aria-disabled');
      if (value != null && value.trim().toLowerCase() === 'true') return node;
    }
    return null;
  }

  function sourceInertReason(el) {
    if (el.closest('[disabled]')) return 'disabled';
    if (el.closest('[inert]')) return 'inert';
    if (el.closest('[hidden]')) return 'hidden';
    if (el.closest('[data-proto-demoted]')) return 'demoted';
    // The converter's own marker for a non-native control it deliberately
    // left presentational — must be honored here too, or a real click can
    // reactivate a control the source explicitly declared static.
    if (el.closest('[data-12ui-presentational-control]')) return 'presentational-control';
    if (ariaDisabledAncestor(el)) return 'aria-disabled';
    return null;
  }

  function markBoundAction(el, action) {
    const inertReason = sourceInertReason(el);
    if (inertReason) {
      el.dataset.protoSuppressed = `source-${inertReason}`;
      return false;
    }
    // This must run in the real browser DOM. The build-time Linkedom CSSOM
    // drops declaration priority, while an inline important declaration here
    // outranks every selector-based rule, including #id!important.
    el.style.setProperty('pointer-events', 'auto', 'important');
    el.dataset.protoPointerRestored = 'true';
    el.dataset.protoRuntimeBound = action;
    el.classList.add('proto-clickable');
    return true;
  }

  // ---- bind actions
  const bound = { navigate: 0, dropdown: 0, modal: 0, field: 0 };
  for (const el of document.querySelectorAll('[data-proto-action]')) {
    const action = el.dataset.protoAction;
    if (action === 'navigate') {
      if (!el.dataset.protoTarget) {
        el.dataset.protoSuppressed = 'unresolved-navigation';
        continue;
      }
      if (!markBoundAction(el, action)) continue;
      bound.navigate++;
      el.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const tgt = el.dataset.protoTarget;
        const [file, hash] = tgt.split('#');
        if (hash && location.pathname.endsWith('/' + file)) { const t = document.getElementById(hash); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.pushState({ protoAnchor: hash }, '', '#' + hash); return; } }
        location.href = file + keepQuery + (hash ? '#' + hash : '');
      });
    } else if (action === 'dropdown') {
      const options = JSON.parse(el.dataset.protoOptions || '[]');
      if (new Set(options.map((option) => String(option).trim().toLocaleLowerCase())).size < 3) {
        el.dataset.protoSuppressed = 'invalid-dropdown';
        continue;
      }
      if (!markBoundAction(el, action)) continue;
      bound.dropdown++;
      const labelEl = el.dataset.protoLabel ? document.getElementById(el.dataset.protoLabel) : null;
      el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openDropdown(el, options, labelEl); });
    } else if (action === 'modal') {
      if (!markBoundAction(el, action)) continue;
      bound.modal++;
      const modal = JSON.parse(el.dataset.protoModal || '{}');
      el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openModal(modal); });
    }
  }

  // ---- fields: the placeholder text becomes editable; Enter submits to a modal
  for (const el of document.querySelectorAll('[data-proto-field]')) {
    const textEl = el.dataset.protoField ? document.getElementById(el.dataset.protoField) : null;
    if (!textEl) continue;
    if (!markBoundAction(el, 'field')) continue;
    bound.field++;
    const placeholder = textEl.textContent;
    const submitLabel = el.dataset.protoSubmit || 'Send';
    textEl.contentEditable = 'true';
    textEl.spellcheck = false;
    textEl.classList.add('proto-field-text');
    textEl.dataset.placeholder = placeholder;
    textEl.addEventListener('focus', () => { if (textEl.textContent === placeholder) { textEl.textContent = ''; textEl.classList.add('proto-field-active'); } });
    textEl.addEventListener('blur', () => { if (!textEl.textContent.trim()) { textEl.textContent = placeholder; textEl.classList.remove('proto-field-active'); } });
    textEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const value = textEl.textContent.trim();
      if (!value) return;
      openModal({ title: submitLabel, body: el.dataset.protoSubmitBody || 'Received. This is a prototype, so nothing was sent.', detail: `“${value}”`, confirm: 'OK' });
      textEl.blur();
    });
    el.addEventListener('click', (e) => { if (e.target !== textEl) { textEl.focus(); } });
    for (const btn of document.querySelectorAll(`[data-proto-submit-for="${textEl.id}"]`)) {
      if (!markBoundAction(btn, 'field-submit')) continue;
      btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); textEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    }
  }
  // same-page anchors: scroll to the target viewport section
  if (location.hash) { const t = document.querySelector(location.hash); if (t) t.scrollIntoView({ block: 'start' }); }

  document.documentElement.dataset.protoBound = JSON.stringify(bound);
  hydrate();
})();
