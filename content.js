// ============================================================
// ChatGPT Exporter — content script
// 1) EXPORT_API      → fetch /backend-api/conversation/{id} (best)
// 2) OBSERVER_*      → MutationObserver auto-capture while user scrolls
// 3) EXPORT_VISIBLE  → snapshot whatever is currently in DOM
// Dedup key everywhere: data-message-id (a real UUID, stable)
// ============================================================

const STORAGE_KEY = "chatgpt_export_scroll_v2";

// ---------- text utils ----------
function cleanText(t) {
  return t.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n").trim();
}

function extractMarkdown(root) {
  let md = "";
  const walk = (node) => {
    if (node.nodeType === 3) {
      const t = node.textContent;
      if (t.trim()) md += t;
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toUpperCase();

    if (tag === "H1") { md += `\n# ${node.innerText.trim()}\n\n`; return; }
    if (tag === "H2") { md += `\n## ${node.innerText.trim()}\n\n`; return; }
    if (tag === "H3") { md += `\n### ${node.innerText.trim()}\n\n`; return; }
    if (tag === "H4") { md += `\n#### ${node.innerText.trim()}\n\n`; return; }
    if (tag === "PRE") {
      const codeEl = node.querySelector("code");
      const lang = (codeEl?.className || "").match(/language-(\w+)/)?.[1] || "";
      const code = (codeEl?.innerText || node.innerText).replace(/\n+$/, "");
      md += `\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
      return;
    }
    if (tag === "CODE" && node.parentElement?.tagName !== "PRE") {
      md += `\`${node.innerText}\``;
      return;
    }
    if (tag === "STRONG" || tag === "B") { md += `**${node.innerText}**`; return; }
    if (tag === "EM" || tag === "I")     { md += `*${node.innerText}*`; return; }
    if (tag === "A") {
      const href = node.getAttribute("href") || "";
      md += href ? `[${node.innerText}](${href})` : node.innerText;
      return;
    }
    if (tag === "LI") { md += `- ${node.innerText.trim()}\n`; return; }
    if (tag === "P")  { node.childNodes.forEach(walk); md += "\n\n"; return; }
    if (tag === "BR") { md += "\n"; return; }

    node.childNodes.forEach(walk);
  };
  walk(root);
  return cleanText(md);
}

// ---------- page localStorage (survives popup close) ----------
function loadStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveStore(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); }
  catch (e) { console.warn("[Exporter] save failed:", e); }
}
function clearStore() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ---------- DOM scraping ----------
function turnIndexOf(node) {
  let el = node;
  while (el && el !== document.body) {
    const t = el.getAttribute && el.getAttribute("data-testid");
    if (t && t.startsWith("conversation-turn-")) {
      const n = parseInt(t.slice("conversation-turn-".length), 10);
      return isNaN(n) ? null : n;
    }
    el = el.parentElement;
  }
  return null;
}

function scrapeVisible() {
  const out = [];
  document.querySelectorAll("[data-message-id]").forEach(node => {
    const id = node.getAttribute("data-message-id");
    const role = node.getAttribute("data-message-author-role");
    if (!id || !role) return;
    if (role === "system" || role === "tool") return;

    const prose =
      node.querySelector(".prose") ||
      node.querySelector("[class*='markdown']") ||
      node;
    const text = cleanText(prose.innerText || "");
    if (!text) return;

    out.push({
      id,
      role,
      turnIndex: turnIndexOf(node),
      text,
      markdown: extractMarkdown(prose),
    });
  });
  return out;
}

function mergeIntoStore(messages) {
  const store = loadStore();
  let added = 0;
  for (const m of messages) {
    if (!store[m.id]) added++;
    // Preserve earliest turnIndex if previously seen
    if (store[m.id] && store[m.id].turnIndex != null && m.turnIndex == null) {
      m.turnIndex = store[m.id].turnIndex;
    }
    store[m.id] = m;
  }
  saveStore(store);
  return { total: Object.keys(store).length, added };
}

function storeToList() {
  const arr = Object.values(loadStore());
  arr.sort((a, b) => {
    if (a.turnIndex != null && b.turnIndex != null) return a.turnIndex - b.turnIndex;
    if (a.turnIndex != null) return -1;
    if (b.turnIndex != null) return 1;
    return 0;
  });
  return arr;
}

// ---------- MutationObserver auto-capture ----------
let observer = null;
let observerActive = false;
let scrapeQueued = false;

function debouncedScrape() {
  if (scrapeQueued) return;
  scrapeQueued = true;
  setTimeout(() => {
    scrapeQueued = false;
    if (observerActive) mergeIntoStore(scrapeVisible());
  }, 250);
}

function startObserver() {
  if (observer) return;
  observerActive = true;
  mergeIntoStore(scrapeVisible());
  observer = new MutationObserver(debouncedScrape);
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
  observerActive = false;
  if (observer) { observer.disconnect(); observer = null; }
}

// ---------- Backend API ----------
async function getAccessToken() {
  const res = await fetch("/api/auth/session", { credentials: "include" });
  if (!res.ok) throw new Error("Auth session HTTP " + res.status);
  const j = await res.json();
  if (!j.accessToken) throw new Error("No access token — are you logged in?");
  return j.accessToken;
}

function conversationIdFromUrl() {
  const m = location.pathname.match(/\/c\/([0-9a-fA-F-]{8,})/);
  return m ? m[1] : null;
}

async function fetchFullConversation() {
  const id = conversationIdFromUrl();
  if (!id) throw new Error("Not on a conversation page (/c/<id>). Open a chat first.");
  const token = await getAccessToken();
  const res = await fetch(`/backend-api/conversation/${id}`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Conversation fetch HTTP ${res.status}`);
  return res.json();
}

function partsToText(parts) {
  if (!Array.isArray(parts)) return "";
  return parts.map(p => {
    if (typeof p === "string") return p;
    if (p && typeof p === "object") {
      if (typeof p.text === "string") return p.text;
      if (p.content_type === "image_asset_pointer") return "[image]";
      if (p.asset_pointer) return "[asset]";
    }
    return "";
  }).filter(Boolean).join("\n");
}

function apiNodeToMessage(node) {
  const msg = node && node.message;
  if (!msg) return null;
  if (msg.metadata?.is_visually_hidden_from_conversation) return null;
  const role = msg.author?.role;
  if (!role || role === "system" || role === "tool") return null;

  const content = msg.content || {};
  let text = "";
  if (content.content_type === "text" || content.content_type === "multimodal_text") {
    text = partsToText(content.parts);
  } else if (content.content_type === "code") {
    const body = content.text || partsToText(content.parts);
    text = "```\n" + body + "\n```";
  } else if (Array.isArray(content.parts)) {
    text = partsToText(content.parts);
  } else if (typeof content.text === "string") {
    text = content.text;
  }
  text = (text || "").trim();
  if (!text) return null;

  return {
    id: msg.id,
    role,
    text,
    markdown: text, // API content is already markdown
    create_time: msg.create_time || null,
  };
}

function apiToOrderedMessages(conv) {
  const mapping = conv.mapping || {};
  let cur = conv.current_node;
  if (!cur || !mapping[cur]) {
    return Object.values(mapping).map(apiNodeToMessage).filter(Boolean);
  }
  const chain = [];
  const seen = new Set();
  while (cur && mapping[cur] && !seen.has(cur)) {
    seen.add(cur);
    chain.push(mapping[cur]);
    cur = mapping[cur].parent;
  }
  chain.reverse(); // root → leaf
  return chain.map(apiNodeToMessage).filter(Boolean);
}

// ---------- output ----------
function buildMarkdown(messages, title) {
  let md = `# ${title || "ChatGPT Conversation"}\n\n`;
  md += `_Exported ${new Date().toISOString()} — ${messages.length} messages_\n\n---\n\n`;
  for (const m of messages) {
    const h = m.role === "user" ? "🧑 You" :
              m.role === "assistant" ? "🤖 ChatGPT" :
              `_${m.role}_`;
    md += `## ${h}\n\n${m.markdown || m.text}\n\n---\n\n`;
  }
  return md;
}

function safeFilename(s) {
  return (s || "chatgpt")
    .replace(/[^a-z0-9_\- ]/gi, "")
    .trim().slice(0, 60)
    .replace(/\s+/g, "_") || "chatgpt";
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ---------- message router ----------
chrome.runtime.onMessage.addListener((req, sender, send) => {
  (async () => {
    try {
      if (req.type === "EXPORT_API") {
        const conv = await fetchFullConversation();
        const msgs = apiToOrderedMessages(conv);
        const title = conv.title || "chatgpt";
        downloadFile(buildMarkdown(msgs, title), safeFilename(title) + ".md");
        return send({ ok: true, count: msgs.length, title });
      }

      if (req.type === "EXPORT_VISIBLE") {
        const msgs = scrapeVisible();
        const title = document.title.replace(/^ChatGPT[\s\-—|:]*/i, "") || "chatgpt";
        downloadFile(buildMarkdown(msgs, title), safeFilename(title) + ".md");
        return send({ ok: true, count: msgs.length });
      }

      if (req.type === "OBSERVER_START") {
        clearStore();
        startObserver();
        const r = mergeIntoStore(scrapeVisible());
        return send({ ok: true, total: r.total });
      }

      if (req.type === "OBSERVER_STATUS") {
        // Re-scrape now too, in case observer missed something
        mergeIntoStore(scrapeVisible());
        return send({ ok: true, total: storeToList().length, active: observerActive });
      }

      if (req.type === "OBSERVER_DOWNLOAD") {
        mergeIntoStore(scrapeVisible());
        stopObserver();
        const list = storeToList();
        const title = document.title.replace(/^ChatGPT[\s\-—|:]*/i, "") || "chatgpt";
        downloadFile(buildMarkdown(list, title), safeFilename(title) + ".md");
        clearStore();
        return send({ ok: true, count: list.length });
      }

      if (req.type === "OBSERVER_CANCEL") {
        stopObserver();
        clearStore();
        return send({ ok: true });
      }

      send({ ok: false, error: "Unknown message type: " + req.type });
    } catch (e) {
      console.error("[Exporter]", e);
      send({ ok: false, error: e.message || String(e) });
    }
  })();
  return true; // async
});

console.log("[ChatGPT Exporter] content script ready");
