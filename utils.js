export function generateTitle(messages) {
  const firstUserMsg = messages.find(m => m.role === "user");
  if (!firstUserMsg) return "Chat Export";

  return firstUserMsg.text.split("\n")[0].slice(0, 60);
}

export function formatMarkdown(messages) {
  let md = "";

  messages.forEach(msg => {
    if (msg.role === "user") {
      md += `## 👤 You\n${msg.text}\n\n`;
    } else {
      md += `## 🤖 ChatGPT\n${msg.text}\n\n`;
    }
  });

  return md;
}

export function addObsidianExtras(md, title) {
  return `# ${title}

#chatgpt #learning

---

${md}
`;
}

export function generateFileName(title) {
  const date = new Date().toISOString().split("T")[0];
  return `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${date}.md`;
}