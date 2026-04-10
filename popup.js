let running = false;

function updateBar(p) {
  const bar = document.getElementById("bar");
  if (bar) bar.style.width = p + "%";
}

document.getElementById("export-md").onclick = async () => {
  if (running) return;
  running = true;

  try {
    updateBar(10);

    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab?.id) {
      console.log("❌ No active tab found");
      running = false;
      return;
    }

    updateBar(20);

    // ✅ GET CHAT DATA FROM CONTENT
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "GET_CHAT",
    });

    if (!response || !response.data || !response.data.length) {
      console.log("❌ No chat messages found");
      running = false;
      return;
    }

    const messages = response.data;

    updateBar(40);

    // ✅ SAFE TITLE GENERATION
    const titleRaw = messages[0]?.text || "chatgpt_export";

    const title = titleRaw
      .slice(0, 40)
      .replace(/[^a-z0-9]/gi, "_")
      .replace(/_+/g, "_")
      .toLowerCase();

    // ✅ BUILD MARKDOWN
    let md = `# ${title}\n\n#chatgpt\n\n---\n\n`;

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];

      if (!m) continue;

      // 👤 USER MESSAGE
      if (m.role === "user") {
        md += `## 👤 You\n${m.text || ""}\n\n`;
      }

      // 🤖 CHATGPT MESSAGE
      else {
        md += `## 🤖 ChatGPT\n`;

        // 🔥 IMPORTANT: use markdown instead of plain text
        md += `${m.markdown || m.text || ""}\n\n`;
      }

      // 🔥 PREVENT UI FREEZE (VERY IMPORTANT)
      if (i % 5 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // optional progress
      const progress = 40 + Math.floor((i / messages.length) * 40);
      updateBar(progress);
    }

    updateBar(85);

    // ✅ SEND DOWNLOAD REQUEST
    const downloadRes = await chrome.tabs.sendMessage(tab.id, {
      type: "DOWNLOAD_MD",
      content: md,
      filename: `${title}.md`,
    });

    console.log("✅ Download response:", downloadRes);

    updateBar(100);
  } catch (err) {
    console.error("🔥 ERROR:", err);
  } finally {
    running = false;

    // reset bar after short delay
    setTimeout(() => updateBar(0), 800);
  }
};