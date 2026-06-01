# Novex

**One prompt. Every AI. Side by side.**

Novex is a lightweight desktop app that lets you send a single prompt to
**ChatGPT, Claude, Gemini, and Perplexity** at the same time, then toggle
between them to compare each answer. It runs the real, full web apps — so you
stay signed into your own accounts and keep every feature (file uploads, code
tools, image generation, and whatever the providers ship next). There are no
API keys and no middleman.


![interface](<Screenshot 2026-06-01 104842.png>)

---

## Table of contents

- [Features](#features)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Privacy & data](#privacy--data)
- [Configuration](#configuration)
- [Building a distributable app](#building-a-distributable-app)
- [Troubleshooting](#troubleshooting)
- [Limitations & honest notes](#limitations--honest-notes)
- [License](#license)

---

## Features

**Core**
- **Single prompt, all models.** Type once and Novex delivers the same prompt
  to every selected model simultaneously.
- **Real web apps, not APIs.** Each model is the genuine site running in an
  embedded browser view, so you get the latest features the moment providers
  release them — nothing to update on Novex's side.
- **Toggle to compare.** A model stack on the left lets you flip between
  answers instantly. All models stay loaded in the background, so switching is
  immediate and each keeps its place.
- **Welcome screen.** On launch you see a short explanation and the full list
  of available models, so the app explains itself.

**Convenience**
- **Global summon shortcut.** Show or hide Novex from anywhere with a
  system-wide hotkey (default `Ctrl/Cmd + Shift + G`), configurable in Settings.
- **Number hotkeys.** Jump straight to a model with `Ctrl/Cmd + 1...4`.
- **Prompt history.** Press the Up / Down arrows in the input box to recall and
  reuse your recent prompts; history is saved between launches.
- **Per-model targeting.** Choose exactly which models receive a broadcast in
  **Settings -> Send prompts to**, so you can skip ones you aren't signed into.
- **Light / dark / system theme.** Toggle from the top bar or pick a fixed mode
  in Settings; the choice is remembered.
- **Live status indicators.** Each model shows a dot — grey while loading, teal
  when ready or sending, red if a prompt couldn't be delivered (usually means
  you're signed out).
- **Per-model favicons** in the stack, plus an indeterminate loading bar while a
  model is still loading.

**Quality-of-life**
- **Persistent logins.** Sign in to each model once; sessions are saved locally
  and survive restarts.
- **Window memory.** Novex remembers its size and position between launches.
- **Quick controls.** Reload or start a new chat in the model you're viewing
  (or all of them from the welcome screen), with on-screen confirmation.
- **Easy to maintain.** All model definitions and the page selectors that drive
  them live in a single file (`services.js`) with multiple fallbacks each, so
  adapting to a provider's site change is a quick edit, not a rewrite.

---

## How it works

Novex has two parts: a small background **engine** (the Electron *main process*)
that owns the window, the global shortcut, the theme, and saved settings; and
the **window** you see (the *renderer*), which holds one embedded browser view
per model.

When you type a prompt and hit Enter, Novex injects a tiny script into each
model's own page that types your prompt into that site's input box and presses
send exactly what your hands would do. Because these are real browser views
(not iframes), the providers' anti-embedding headers don't apply, and because
you're using the real sites, you keep all of their native features.

Logins work normally: the first time you open a model you sign in on its own
page, and Novex stores that session locally so you stay logged in.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Desktop runtime | [Electron](https://www.electronjs.org/) (`^31`) |
| App engine | Node.js (Electron main process) |
| UI | Plain HTML, CSS, and vanilla JavaScript (no framework) |
| Embedded model views | Electron `<webview>` (Chromium browser context) |
| Cross-process bridge | Electron `contextBridge` / IPC via a `preload` script |
| Local persistence | `settings.json` in the OS user-data folder + `localStorage` (prompt history) + a persistent session partition (`persist:novex`) for logins |
| Packaging (optional) | [electron-builder](https://www.electron.build/) (`^24`) |
| Fonts | Bricolage Grotesque, Hanken Grotesk, JetBrains Mono (Google Fonts) |

No backend, no database, no external service beyond the model websites
themselves.

---

## Prerequisites

- **[Node.js](https://nodejs.org/) LTS** (which includes `npm`). This is the
  only thing you must install. Verify it from a terminal:
  ```bash
  node -v
  npm -v
  ```
  Both should print a version number.
- **An account with each model** you want to use (ChatGPT, Claude, Gemini,
  Perplexity). Free accounts work; you simply sign in inside the app.
- **OS:** built and tested on Windows; runs on macOS as well (use `Cmd` where
  the docs say `Ctrl`). Linux should work via Electron but is untested.
- **For the global shortcut on macOS:** grant Accessibility / Input Monitoring
  permission when prompted (System Settings -> Privacy & Security).

---

## Getting started

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/novex.git
cd novex

# 2. Install dependencies (one time; downloads Electron)
npm install

# 3. Launch
npm start
```

Keep the terminal open while the app runs — closing it (or pressing `Ctrl + C`
there) stops Novex.

On Windows, avoid placing the project inside a OneDrive-synced folder (e.g. the
synced Desktop); use a plain path like `C:\novex` to prevent file-access issues.

---

## Usage

1. **Open each model once and sign in.** Click a model in the left stack and log
   in on its page. You only do this the first time.
2. **Type a prompt** in the box at the bottom and press **Enter** (or click the
   send button). It is delivered to every selected model at once.
3. **Toggle between models** in the left stack to read and compare each answer.

The dot beside each model tells you its state. A red dot after sending almost
always means you're signed out of that model — open it and sign in.

---

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + Shift + G` | Show / hide Novex from anywhere (configurable) |
| `Enter` | Send the prompt to all selected models |
| `Shift + Enter` | New line in the prompt box |
| `Up` / `Down` | Recall previous / next prompt (cursor at start/end of box) |
| `Ctrl/Cmd + 1...4` | Jump to a model by its number |
| `Esc` | Hide the window |

---

## Privacy & data

Novex is designed to keep your data on your machine. There is no Novex server
and no telemetry.

- **Your logins stay local.** Sign-in sessions live in Electron's local session
  storage (the `persist:novex` partition) inside your OS user-data folder.
  Novex never sees, transmits, or stores your passwords — authentication happens
  directly between you and each provider's website, exactly as in a normal
  browser.
- **Your prompts go only to the model sites.** When you send a prompt, it is
  typed into each model's own web page. Novex does not log, collect, or send
  your prompts anywhere else.
- **Settings and history are local files.** Your theme, shortcut, target
  selection, and window size are saved in a small `settings.json` in your
  user-data folder. Prompt history is stored in the app's local storage. You can
  clear either at any time.
- **No analytics, no accounts for Novex itself.** The app has no sign-up of its
  own and makes no network calls except loading the model websites and Google
  Fonts.
- **The model providers see what you send them.** Anything you submit to
  ChatGPT, Claude, Gemini, or Perplexity is governed by that provider's own
  privacy policy and terms just as if you used their site directly.

To wipe local data, sign out inside each model's page, or delete Novex's folder
in your OS user-data directory.

---

## Configuration

Everything user-facing is in **Settings** (the gear icon): theme, global
shortcut, and which models receive a broadcast.

To change the models themselves — add, remove, reorder, or fix a provider after
a site change edit **`services.js`**. Each model entry holds its name, URL,
and the page selectors used to find its input box and send button, with several
fallbacks each. If one model ever stops receiving prompts, update that model's
selector there; no other file needs to change.

---

## Building a distributable app

The repo includes an electron-builder setup. The default `dist` script targets
macOS:

```bash
npm run dist
```

To build a Windows installer, add a Windows target to the `build` section of
`package.json` (electron-builder's `win` / `nsis` options) and run the build on
or for Windows. Note that distributing an installer to other people for a
warning-free experience requires **code signing**, which needs a paid
certificate. For personal use you can run the unsigned build and dismiss the
OS warning.

---

## Troubleshooting

- **A model shows a red dot / "couldn't reach."** You're probably signed out —
  open that model and log in. If you're signed in and it still fails, the site
  likely changed its layout; update that model's selectors in `services.js`.
- **Blank window on launch.** Make sure all files are named correctly (no
  `index (1).html` or `.txt` extensions) and that the project is not inside a
  OneDrive-synced folder. Open DevTools (`Ctrl/Cmd + Shift + I`) -> Console to
  see the specific error.
- **Global shortcut doesn't work.** Another app may already use itch ange it
  in Settings. On macOS, grant Accessibility / Input Monitoring permission.
- **Theme won't switch.** Pick a fixed Light or Dark mode in Settings rather
  than System.

---

## Limitations & honest notes

- Novex automates real, logged-in websites by injecting input into their pages.
  This is great for personal comparison, but it depends on each site's current
  layout, so a provider's redesign can temporarily break delivery to that model
  until its selector is updated in `services.js`.
- Some providers' terms restrict automated interaction with their sites. Using
  Novex for your own accounts and prompts is reasonable personal use;
  distributing it publicly is a different consideration worth reviewing against
  those terms.
- "Bard" is now Google **Gemini**, which is what Novex uses.

---

## License

[MIT](LICENSE) — do what you like; no warranty. See the `LICENSE` file.