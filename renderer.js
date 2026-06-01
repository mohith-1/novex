'use strict';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const railEl = document.getElementById('rail');
const viewportEl = document.getElementById('viewport');
const homeEl = document.getElementById('home');
const settingsEl = document.getElementById('settings');
const promptEl = document.getElementById('prompt');
const sendBtn = document.getElementById('send');
const statusEl = document.getElementById('status');

const models = {};       // id -> { service, webview, item, ready }
let activeId = null;      // null = home, 'settings', else model id

const isMac = (navigator.platform || '').toLowerCase().includes('mac');

let settings = {
  theme: 'system',
  shortcut: 'CommandOrControl+Shift+G',
  broadcastTargets: null
};

function targetIds() {
  const all = window.SERVICES.map((s) => s.id);
  if (!Array.isArray(settings.broadcastTargets) || settings.broadcastTargets.length === 0) return all;
  return all.filter((id) => settings.broadcastTargets.includes(id));
}

// ---- Theme (explicit attribute so it always repaints) -----------------------
const sysDark = matchMedia('(prefers-color-scheme: dark)');
function resolvedTheme() {
  if (settings.theme === 'light' || settings.theme === 'dark') return settings.theme;
  return sysDark.matches ? 'dark' : 'light';
}
function paintTheme() { document.documentElement.dataset.theme = resolvedTheme(); }
sysDark.addEventListener('change', () => { if (settings.theme === 'system') paintTheme(); });

async function setTheme(theme) {
  settings.theme = theme;
  paintTheme();
  reflectThemeSeg();
  try { await window.app.setSettings({ theme }); } catch (e) {}
}

// ---- Welcome screen ---------------------------------------------------------
(function fillHome() {
  const names = window.SERVICES.map((s) => s.name);
  const joined =
    names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]
                     : (names[0] || 'your models');
  document.getElementById('home-models').textContent = joined;
  const chipsEl = document.getElementById('home-chips');
  for (const s of window.SERVICES) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = s.name;
    chipsEl.appendChild(chip);
  }
})();

// ---- Build the model stack --------------------------------------------------
window.SERVICES.forEach((service, i) => {
  const item = document.createElement('button');
  item.className = 'rail-item';
  item.dataset.id = service.id;
  const num = i < 9 ? `<span class="hk">${i + 1}</span>` : '';
  item.innerHTML =
    `<span class="dot"></span><img class="fav" alt="" hidden /><span class="name">${service.name}</span>${num}`;
  item.addEventListener('click', () => setActive(service.id));
  railEl.appendChild(item);

  const webview = document.createElement('webview');
  webview.className = 'view';
  webview.setAttribute('src', service.url);
  webview.setAttribute('partition', 'persist:novex');
  webview.setAttribute('useragent', UA);
  webview.setAttribute('allowpopups', 'true');
  viewportEl.appendChild(webview);

  models[service.id] = { service, webview, item, ready: false };

  const fav = item.querySelector('.fav');
  fav.addEventListener('error', () => { fav.hidden = true; });
  webview.addEventListener('page-favicon-updated', (e) => {
    if (e.favicons && e.favicons.length) { fav.src = e.favicons[0]; fav.hidden = false; }
  });
  webview.addEventListener('dom-ready', () => { models[service.id].ready = true; item.classList.add('ready'); updateLoadbar(); });
  webview.addEventListener('did-start-loading', () => { models[service.id].ready = false; item.classList.remove('ready'); updateLoadbar(); });
  webview.addEventListener('did-fail-load', (e) => { if (e.errorCode && e.errorCode !== -3) item.classList.add('error'); });
});

// ---- View switching ---------------------------------------------------------
function updateLoadbar() {
  const m = activeId && models[activeId] ? models[activeId] : null;
  viewportEl.classList.toggle('loading', !!(m && !m.ready));
}
function clearActive() {
  homeEl.classList.remove('active');
  if (settingsEl) settingsEl.classList.remove('active');
  for (const m of Object.values(models)) m.webview.classList.remove('active');
  railEl.querySelectorAll('.rail-item').forEach((b) => b.classList.remove('active'));
}
function showHome() {
  activeId = null; clearActive(); homeEl.classList.add('active');
  promptEl.placeholder = 'Send one prompt to all models…'; updateLoadbar();
}
function showSettings() {
  activeId = 'settings'; clearActive();
  if (settingsEl) settingsEl.classList.add('active');
  updateLoadbar();
}
function setActive(id) {
  if (!models[id]) return;
  activeId = id; clearActive();
  models[id].webview.classList.add('active');
  models[id].item.classList.add('active');
  promptEl.placeholder = 'Send one prompt to all models…'; updateLoadbar();
}

showHome();

// ---- Status toast -----------------------------------------------------------
function showStatus(msg, ms = 2200) {
  statusEl.textContent = msg;
  statusEl.classList.add('show');
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => statusEl.classList.remove('show'), ms);
}

// ---- Prompt history ---------------------------------------------------------
let history = [];
let histIndex = 0;
try { history = JSON.parse(localStorage.getItem('novex.history') || '[]'); } catch (e) { history = []; }
histIndex = history.length;
function pushHistory(text) {
  if (!text) return;
  if (history[history.length - 1] === text) { histIndex = history.length; return; }
  history.push(text);
  if (history.length > 50) history = history.slice(-50);
  histIndex = history.length;
  try { localStorage.setItem('novex.history', JSON.stringify(history)); } catch (e) {}
}

// ---- Send ONE prompt to selected models -------------------------------------
async function sendToAll() {
  const text = promptEl.value.trim();
  if (!text) return;
  const ids = targetIds();
  if (ids.length === 0) { showStatus('No models selected in Settings → Send prompts to', 3200); return; }

  pushHistory(text);
  sendBtn.disabled = true; sendBtn.classList.add('busy');
  showStatus(`Sending to ${ids.length} model${ids.length > 1 ? 's' : ''}…`, 60000);

  const results = await Promise.all(ids.map(async (id) => {
    const { service, webview, item } = models[id];
    item.classList.remove('error'); item.classList.add('sending');
    const cfg = { inputSelectors: service.inputSelectors, sendSelectors: service.sendSelectors };
    const code = `(${window.injectPrompt.toString()})(${JSON.stringify(text)}, ${JSON.stringify(cfg)})`;
    let ok = false;
    try { const res = await webview.executeJavaScript(code, true); ok = !!(res && res.ok); }
    catch (err) { ok = false; }
    item.classList.remove('sending');
    if (!ok) item.classList.add('error');
    return { id, ok };
  }));

  sendBtn.disabled = false; sendBtn.classList.remove('busy');
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) { promptEl.value = ''; autoSize(); showStatus('Sent ✓'); }
  else {
    const names = failed.map((f) => models[f.id].service.name).join(', ');
    showStatus(`Couldn't reach: ${names} — open it and sign in`, 4400);
  }
  const firstOk = results.find((r) => r.ok);
  setActive((firstOk || results[0]).id);
}

// ---- Composer ---------------------------------------------------------------
function autoSize() {
  promptEl.style.height = 'auto';
  promptEl.style.height = Math.min(promptEl.scrollHeight, 168) + 'px';
}
promptEl.addEventListener('input', () => { autoSize(); histIndex = history.length; });
promptEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAll(); return; }
  if (e.key === 'ArrowUp' && promptEl.selectionStart === 0 && promptEl.selectionEnd === 0 && history.length) {
    e.preventDefault();
    histIndex = Math.max(0, histIndex - 1);
    promptEl.value = history[histIndex] || ''; autoSize();
    promptEl.setSelectionRange(0, 0);
  } else if (e.key === 'ArrowDown' && promptEl.selectionStart === promptEl.value.length && history.length) {
    if (histIndex < history.length) {
      e.preventDefault();
      histIndex++;
      promptEl.value = histIndex >= history.length ? '' : history[histIndex];
      autoSize();
    }
  }
});
sendBtn.addEventListener('click', sendToAll);

// ---- Toolbar (acts on the model you're viewing; all models from home) -------
function targetWebviews() {
  if (activeId && models[activeId]) return [models[activeId]];   // a specific model is showing
  return Object.values(models);                                  // home/settings -> all
}
document.getElementById('home-btn').addEventListener('click', showHome);
document.getElementById('reload-all').addEventListener('click', () => {
  const t = targetWebviews();
  t.forEach((m) => m.webview.reload());
  showStatus(t.length === 1 ? `Reloading ${t[0].service.name}…` : 'Reloading all models…');
});
document.getElementById('new-all').addEventListener('click', () => {
  const t = targetWebviews();
  t.forEach((m) => m.webview.loadURL(m.service.url));
  showStatus(t.length === 1 ? `New chat in ${t[0].service.name}` : 'New chat in all models');
});
document.getElementById('dismiss').addEventListener('click', () => window.app.hideWindow());
const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) settingsBtn.addEventListener('click', () => {
  activeId === 'settings' ? showHome() : showSettings();
});
document.getElementById('theme').addEventListener('click', () => {
  setTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
});

// ---- Settings page ----------------------------------------------------------
function reflectThemeSeg() {
  const seg = document.getElementById('theme-seg');
  if (!seg) return;
  seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.theme === settings.theme));
}
function wireThemeSeg() {
  const seg = document.getElementById('theme-seg');
  if (!seg) return;
  seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.theme)));
}
function accelLabel(accel) {
  return accel.replace('CommandOrControl', isMac ? '⌘' : 'Ctrl').replace(/\+/g, ' + ');
}
function buildShortcutOptions() {
  const sel = document.getElementById('shortcut-select');
  if (!sel) return;
  const opts = [
    'CommandOrControl+Shift+G', 'CommandOrControl+Shift+Space',
    'CommandOrControl+Shift+A', 'CommandOrControl+Shift+J', 'Alt+Space'
  ];
  if (!opts.includes(settings.shortcut)) opts.unshift(settings.shortcut);
  sel.innerHTML = '';
  for (const a of opts) {
    const o = document.createElement('option');
    o.value = a; o.textContent = accelLabel(a);
    if (a === settings.shortcut) o.selected = true;
    sel.appendChild(o);
  }
  sel.onchange = async () => {
    settings.shortcut = sel.value;
    try { await window.app.setSettings({ shortcut: sel.value }); } catch (e) {}
    showStatus(`Shortcut set to ${accelLabel(sel.value)}`);
  };
}
function buildTargets() {
  const list = document.getElementById('targets-list');
  if (!list) return;
  const active = targetIds();
  list.innerHTML = '';
  for (const s of window.SERVICES) {
    const label = document.createElement('label');
    label.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.dataset.id = s.id; cb.checked = active.includes(s.id);
    const span = document.createElement('span'); span.textContent = s.name;
    label.appendChild(cb); label.appendChild(span);
    cb.addEventListener('change', async () => {
      const checked = Array.from(list.querySelectorAll('input:checked')).map((i) => i.dataset.id);
      const all = window.SERVICES.map((x) => x.id);
      settings.broadcastTargets = (checked.length === all.length) ? null : checked;
      try { await window.app.setSettings({ broadcastTargets: settings.broadcastTargets }); } catch (e) {}
    });
    list.appendChild(label);
  }
}

// ---- Keyboard ---------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { window.app.hideWindow(); return; }
  if (e.metaKey || e.ctrlKey) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= window.SERVICES.length) { e.preventDefault(); setActive(window.SERVICES[n - 1].id); }
  }
});
window.addEventListener('focus', () => promptEl.focus());

// ---- Init -------------------------------------------------------------------
(async function init() {
  try {
    const s = await window.app.getSettings();
    if (s && typeof s === 'object') settings = Object.assign(settings, s);
  } catch (e) {}
  paintTheme();
  reflectThemeSeg();
  wireThemeSeg();
  buildShortcutOptions();
  buildTargets();
  promptEl.focus();
})();