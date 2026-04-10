console.log("✅ content.js loaded");

/* -------------------- 🧹 CLEAN TEXT -------------------- */
function cleanText(text) {
  return text
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/* -------------------- 🔥 MARKDOWN EXTRACTOR -------------------- */
function extractCleanMarkdown(root) {
  let md = "";

  const elements = root.querySelectorAll(
    "h1, h2, h3, p, pre, ul, ol, li, blockquote, code"
  );

  elements.forEach((el) => {
    // ❌ جلوگیری duplicate code
    if (el.tagName === "CODE" && el.closest("pre")) return;

    // ✅ HEADINGS
    if (el.tagName === "H1") {
      md += `# ${el.innerText.trim()}\n\n`;
      return;
    }

    if (el.tagName === "H2") {
      md += `## ${el.innerText.trim()}\n\n`;
      return;
    }

    if (el.tagName === "H3") {
      md += `### ${el.innerText.trim()}\n\n`;
      return;
    }

    // ✅ PARAGRAPH
    if (el.tagName === "P") {
      md += `${el.innerText.trim()}\n\n`;
      return;
    }

    // 🔥 CODE BLOCK (MAIN FIX)
  if (el.tagName === "PRE") {
  let code = "";

  const codeEl = el.querySelector("code");

  // ✅ STEP 1: extract raw code safely
  if (codeEl && codeEl.innerText.trim()) {
    code = codeEl.innerText;
  } else {
    code = el.innerText;
  }

  let lang = "text";

  // ✅ STEP 2: split lines
  let lines = code.split("\n").map(l => l.trim());

  // 🔥 STEP 3: detect language from FIRST LINE
  const firstLine = lines[0]?.toLowerCase();

  const langMap = {
    javascript: "js",
    typescript: "ts",
    js: "js",
    ts: "ts",
    html: "html",
    css: "css",
    json: "json",
    bash: "bash",
    shell: "bash",
    sh: "bash"
  };

  if (langMap[firstLine]) {
    lang = langMap[firstLine];

    // 🔥 remove language line from code
    lines.shift();
    code = lines.join("\n");
  } else {
    // ✅ STEP 4: fallback to className
    const className = codeEl?.className || "";
    const match = className.match(/language-(\w+)/);

    if (match) {
      lang = match[1];
    }
  }

  // ✅ FINAL: safe fallback
  if (!lang) lang = "text";

  md += `\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
  return;
}

    // ✅ INLINE CODE
    if (el.tagName === "CODE") {
      md += `\`${el.innerText.trim()}\``;
      return;
    }

    // ✅ LIST
    if (el.tagName === "LI") {
      md += `- ${el.innerText.trim()}\n`;
      return;
    }

    // ✅ BLOCKQUOTE
    if (el.tagName === "BLOCKQUOTE") {
      md += `> ${el.innerText.trim()}\n\n`;
      return;
    }
  });

  return cleanText(md);
}

/* -------------------- 📦 GET CHAT -------------------- */
function getChatMessages() {
  const nodes = document.querySelectorAll(
    '[data-message-author-role]'
  );

  const messages = [];

  const LIMIT = 100; // safety limit
  const start = Math.max(0, nodes.length - LIMIT);

  for (let i = start; i < nodes.length; i++) {
    const node = nodes[i];

    const role = node.getAttribute("data-message-author-role");

    const prose = node.querySelector(".prose");
    if (!prose) continue;

    const text = cleanText(prose.innerText).slice(0, 5000);

    const markdown = extractCleanMarkdown(prose);

    messages.push({
      role,
      text,       // ✅ backward compatibility
      markdown    // 🔥 new (used by popup.js)
    });
  }

  return messages;
}

/* -------------------- ⬇️ DOWNLOAD -------------------- */
function downloadMarkdown(content, filename) {
  console.log("⬇️ Download triggered");

  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "chatgpt.md";

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* -------------------- 🎯 LISTENER -------------------- */
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  try {
    // ✅ GET CHAT
    if (req.type === "GET_CHAT") {
      const data = getChatMessages();
      sendResponse({ success: true, data });
    }

    // ✅ DOWNLOAD
    if (req.type === "DOWNLOAD_MD") {
      downloadMarkdown(req.content, req.filename);
      sendResponse({ success: true });
    }
  } catch (err) {
    console.error("🔥 content.js error:", err);
    sendResponse({ success: false });
  }

  return true; // async safe
});

function detectLanguageFromCode(code) {
  if (!code) return "txt";

  if (code.includes("function") || code.includes("=>")) return "js";
  if (code.includes(": string") || code.includes("interface")) return "ts";
  if (code.includes("<div") || code.includes("</")) return "html";
  if (code.includes("{") && code.includes("}")) return "json";

  return "txt";
}