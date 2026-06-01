'use strict';

/* ===========================================================================
   SERVICE DEFINITIONS
   ---------------------------------------------------------------------------
   This is the ONLY file you should ever need to edit when a service changes
   its frontend and "send to all" stops working for one panel.

   For each service:
     - inputSelectors:  list of selectors for the prompt box, tried in order.
                        First match wins. Works for <textarea>, <input>, and
                        contenteditable editors (ProseMirror / Quill / Lexical).
     - sendSelectors:   list of selectors for the send button, tried in order.
                        If none is found/enabled, we fall back to pressing Enter.

   To fix a broken panel: open that service in a normal browser, right-click the
   text box -> Inspect, and copy a stable selector into the list below.
   =========================================================================== */
window.SERVICES = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    inputSelectors: [
      '#prompt-textarea',
      'div[contenteditable="true"]#prompt-textarea',
      'textarea[data-id]',
      'div.ProseMirror[contenteditable="true"]',
      'textarea'
    ],
    sendSelectors: [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send" i]',
      'button[type="submit"]'
    ]
  },
  {
    id: 'claude',
    name: 'Claude',
    url: 'https://claude.ai/new',
    inputSelectors: [
      'div.ProseMirror[contenteditable="true"]',
      'div[contenteditable="true"]'
    ],
    sendSelectors: [
      'button[aria-label="Send message"]',
      'button[aria-label*="Send" i]'
    ]
  },
  {
    id: 'gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    inputSelectors: [
      'rich-textarea div.ql-editor[contenteditable="true"]',
      'div.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"]'
    ],
    sendSelectors: [
      'button.send-button',
      'button[aria-label*="Send" i]',
      'button[mattooltip*="Send" i]'
    ]
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
    inputSelectors: [
      'textarea[placeholder]',
      'div[contenteditable="true"]',
      'textarea'
    ],
    sendSelectors: [
      'button[aria-label*="Submit" i]',
      'button[aria-label*="Send" i]'
    ]
  }
];

/* ===========================================================================
   INJECTION ROUTINE
   ---------------------------------------------------------------------------
   This function is stringified and run *inside each guest page* via
   webview.executeJavaScript(). It therefore must be fully self-contained and
   reference nothing from this file's scope except its two arguments.

   It handles the three things that make AI text boxes annoying to drive:
     1. React-controlled <textarea>/<input> ignore a plain `el.value = x`,
        so we use the prototype's native value setter then fire `input`.
     2. Rich editors (ProseMirror/Quill/Lexical) ignore both of the above,
        so we focus, select-all, and use execCommand('insertText'), which
        fires the beforeinput/input events the editor actually listens for.
     3. The send button is usually disabled until the input event lands and
        is re-enabled a tick later, so we poll briefly before clicking.
   =========================================================================== */
window.injectPrompt = async function injectPrompt(text, cfg) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = (selectors) => {
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el && el.offsetParent !== null) return el; // visible match preferred
    }
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  };

  // 1) Wait for the input to exist (page may still be loading / logged out).
  let input = null;
  for (let i = 0; i < 40 && !input; i++) {
    input = find(cfg.inputSelectors);
    if (!input) await sleep(200);
  }
  if (!input) return { ok: false, reason: 'input-not-found' };

  input.focus();
  await sleep(30);

  const tag = input.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'input') {
    const proto =
      tag === 'textarea'
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // contenteditable rich editor
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    sel.removeAllRanges();
    sel.addRange(range);
    let inserted = false;
    try {
      inserted = document.execCommand('insertText', false, text);
    } catch (e) {
      inserted = false;
    }
    if (!inserted) {
      input.textContent = text; // last-resort fallback
    }
    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
    );
  }

  // 2) Give the framework a moment to enable the send button.
  await sleep(350);

  let btn = null;
  for (let i = 0; i < 20; i++) {
    btn = find(cfg.sendSelectors);
    if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') break;
    await sleep(150);
  }

  if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
    btn.click();
    return { ok: true, method: 'button' };
  }

  // 3) Fallback: synthesize an Enter keypress on the input.
  const fire = (type) =>
    input.dispatchEvent(
      new KeyboardEvent(type, {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      })
    );
  fire('keydown');
  fire('keypress');
  fire('keyup');
  return { ok: true, method: 'enter-fallback' };
};
