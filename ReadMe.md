# ChatGPT Exporter

> Export your ChatGPT conversations into clean Markdown — even chats with **thousands of messages**.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/version-2.0-34d399.svg)
![Manifest](https://img.shields.io/badge/manifest-v3-3b82f6.svg)

---

## Why I built this

I have **long, deep conversations** with ChatGPT — system design, RabbitMQ deep-dives, architecture decisions, learning notes. Over weeks they grow into thousands of messages, and they're genuinely valuable.

The problem is getting them **out**:

- Copy-paste freezes the browser on long chats
- Sometimes the selection just breaks halfway
- Manual cleanup into Markdown takes hours
- ChatGPT's own export feature emails you a giant ZIP, hours or days later, all-or-nothing

So I built this — a Chrome extension that does it in **one click**, locally, instantly.

---

## How it works

The extension gives you **three export modes**, depending on the situation:

### 1. Export Full Chat *(default — use this)*
Calls ChatGPT's own internal conversation API using your existing login session and pulls the entire conversation in a single request. Works on chats of **any length** — 10 messages or 10,000.

### 2. Export Visible
Snapshots whatever messages are currently rendered on screen. Fast and simple when you only need the part you're looking at.

### 3. Scroll Capture *(fallback)*
Auto-captures messages as you scroll through the chat. Uses each message's **stable UUID** to dedupe, so you can scroll up, down, or jump around freely without losing or duplicating anything.

All three save a clean `.md` file directly to your downloads folder.

---

## Features

- One-click export of entire conversations
- Three modes — full API, visible-only, scroll-capture fallback
- Preserves structure — headings, code blocks (with language tags), bold/italic, lists, links, inline code
- Stable UUID-based deduplication — handles ChatGPT's virtualized DOM correctly
- Keyboard shortcuts in popup (`1` / `2` / `3` / `Enter` / `Esc`)
- Lightweight — no analytics, no telemetry, no remote code
- Works on both `chatgpt.com` and `chat.openai.com`
- Manifest V3, Chrome's current standard

---

## Install

### From the Chrome Web Store
*Coming soon — pending review.*

### From source (developer mode)

```bash
git clone https://github.com/SurajKhonde/chatgpt-exporter.git
```

Then in Chrome:

1. Go to `chrome://extensions`
2. Toggle **Developer mode** on (top-right)
3. Click **Load unpacked** and select the cloned folder
4. Pin the extension to your toolbar

---

## Usage

1. Open any ChatGPT conversation (must be on a `/c/<id>` URL).
2. Click the extension icon in your toolbar.
3. Click **Export Full Chat** — or press `1`.
4. Markdown file downloads instantly.

If the API call fails (rare — usually when ChatGPT changes something), use **Scroll Capture** as fallback: click it, scroll the chat top to bottom, then hit **Stop & Download**.

---

## Privacy

This extension is built with privacy as a first principle:

- **Nothing leaves your browser.** Conversations are read locally and saved directly to your device.
- **No analytics, no telemetry, no tracking.** Not a single network call to any server we control. We don't have a server.
- **No remote code execution.** All JavaScript ships bundled in the extension.
- **Narrow permissions.** Only `activeTab` and `scripting`, only on `chatgpt.com` and `chat.openai.com`.
- **Your existing session.** The API call uses your already-logged-in cookies; we never see or store credentials.

---

## A note on the API approach

The "Export Full Chat" mode calls `chatgpt.com` — ChatGPT's own internal endpoint, the same one its UI calls every time you open a chat. This isn't a documented public API, and OpenAI's terms broadly discourage automated extraction.

In practice, exporting **your own conversations** through **your own browser session** has been universally tolerated for years (see [pionxzh/chatgpt-exporter](https://github.com/pionxzh/chatgpt-exporter) and similar tools). You're reading data you already have access to, with your own credentials, on your own device.

That said: this is a gray area. The endpoint could change anytime, and at scale OpenAI may rate-limit or block. If you need a fully sanctioned route, ChatGPT's built-in **Settings → Data Controls → Export Data** is the official option (slow, ZIP via email, but bulletproof).

---

## Roadmap

- [x] Markdown export (full chat via API)
- [x] Scroll-capture fallback with UUID dedup
- [x] Keyboard shortcuts
- [x] Three-mode UI
- [ ] PDF export
- [ ] Plain TXT export
- [ ] JSON export (raw conversation tree)
- [ ] Batch export (multiple chats at once)
- [ ] Customizable Markdown templates
- [ ] Conversation search across exports

---

## Tech stack

- Manifest V3 Chrome Extension
- Vanilla JavaScript (no build step, no dependencies)
- Single content script + popup
- Total bundle size: under 20 KB

---

## Contributing

PRs welcome.

```text
1. Fork the repo
2. Create a feature branch — git checkout -b feat/something
3. Make your changes
4. Open a Pull Request
```

**Good first issues:**

- Edge cases in the Markdown converter (tables, math, embedded images)
- Settings UI for customizing output format
- PDF export
- i18n for the popup

---

## Project status

Actively maintained. Built out of a real problem the author hits daily.

Found a bug? [Open an issue](https://github.com/SurajKhonde/chatgpt-exporter/issues).

---

## License

[MIT](LICENSE) — do what you want.

---

If this saved you time, a ⭐ goes a long way.