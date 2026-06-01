'use strict';

const { app, BrowserWindow, globalShortcut, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ---- Settings persistence (tiny JSON in userData) -------------------------
const SETTINGS_PATH = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH(), 'utf8'));
  } catch {
    return { theme: 'system' }; // 'system' | 'light' | 'dark'
  }
}
function saveSettings(s) {
  try { fs.writeFileSync(SETTINGS_PATH(), JSON.stringify(s, null, 2)); } catch {}
}

let settings = loadSettings();
let win = null;

// Setting nativeTheme.themeSource makes the whole app (including the guest
// web apps inside the webviews) report this color scheme via
// prefers-color-scheme, so services that follow the system theme flip too.
function applyTheme(theme) {
  nativeTheme.themeSource = theme; // 'system' | 'light' | 'dark'
  settings.theme = theme;
  saveSettings(settings);
}

// ---- Window ----------------------------------------------------------------
function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    title: 'Novex',
    backgroundColor: '#0a0b0d',
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,          // required to use <webview> in the renderer
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  // Don't actually quit on close — just hide, so the global shortcut can
  // re-summon instantly. Real quit happens via Cmd+Q (before-quit below).
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      hideWindow();
    }
  });
}

function showWindow() {
  if (!win) createWindow();
  win.show();
  win.focus();
}

function hideWindow() {
  if (win) win.hide();
  // Return focus to the previously active app so dismissing feels native.
  if (process.platform === 'darwin') app.hide();
}

function toggleWindow() {
  if (win && win.isVisible() && win.isFocused()) {
    hideWindow();
  } else {
    showWindow();
  }
}

// ---- App lifecycle ---------------------------------------------------------
app.whenReady().then(() => {
  applyTheme(settings.theme);
  createWindow();
  showWindow();

  const ok = globalShortcut.register('CommandOrControl+Shift+G', toggleWindow);
  if (!ok) console.warn('Global shortcut registration failed (already in use?)');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    showWindow();
  });
});

app.on('before-quit', () => { app.isQuitting = true; });
app.on('will-quit', () => { globalShortcut.unregisterAll(); });

// Keep running in the background after the window is hidden/closed so the
// global shortcut still works. (Don't quit on window-all-closed.)
app.on('window-all-closed', () => {});

// ---- IPC from the renderer -------------------------------------------------
ipcMain.handle('get-theme', () => settings.theme);
ipcMain.handle('set-theme', (_e, theme) => { applyTheme(theme); return settings.theme; });
ipcMain.handle('hide-window', () => { hideWindow(); });
